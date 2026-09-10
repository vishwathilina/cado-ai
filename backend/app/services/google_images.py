"""Google Images fetcher — mimics browser, parses ischj JSON, picks best https image.

Implements the flow:
 AI writes imageSearchQuery -> enrich query -> fetchSectionImages (2 workers, 350ms pause)
 -> findGoogleImageUrl -> parse candidates -> score by size + query relevance -> save image_url
"""

from __future__ import annotations

import asyncio
import json
import re
from urllib.parse import quote_plus

import httpx

# Browser-like UAs — Android first, then Chrome fallback
_UAS = [
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
]

# Reject junk — mirrors wikimedia SKIP hosts but also Google thumbs
_SKIP_SUBSTRS = (
    "logo",
    "icon",
    "clipart",
    "encrypted-tbn",
    "gstatic",
    "shutterstock",
    "gettyimages",
    "alamy",
    "istockphoto",
    "pinterest",
    "chegg",
    "depositphotos",
    "vectorstock",
    "freepik",
)

_VAGUE_QUERY_RE = re.compile(
    r"\b("
    r"person reading|students? studying|open books?|books? on desk|library interior|"
    r"classroom|students? in classroom|study notes|person by window|ancient library|"
    r"happy student|people working|desk setup|notebook and pen"
    r")\b",
    re.IGNORECASE,
)

_VISUAL_HINTS = (
    "diagram",
    "illustration",
    "labeled",
    "chart",
    "map",
    "schematic",
    "infographic",
    "cross section",
    "cross-section",
    "architecture",
    "photograph",
    "photo of",
)

_CLOUD_CONTEXT_RE = re.compile(
    r"\b(azure|bicep|aws|amazon web services|gcp|google cloud|kubernetes|terraform|"
    r"devops|cloud|microsoft|resource manager|arm template|iac|infrastructure as code)\b",
    re.IGNORECASE,
)

_ANATOMY_NOISE = (
    "anatomy",
    "anatomical",
    "muscle",
    "muscles",
    "brachial",
    "ulnar",
    "deltoid",
    "humerus",
    "skeleton",
    "tendon",
    "nerves",
    "shoulder joint",
    "human arm",
    "supraspinatus",
    "triceps",
)

_COURSE_BANNER_NOISE = (
    "coursera",
    "udemy",
    "edx.org",
    "skillshare",
    "deep learning engineering",
    "course certificate",
    "online course",
    "linkedin learning",
)

_STOP_TOKENS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "into",
    "onto",
    "over",
    "under",
    "about",
    "image",
    "images",
    "picture",
    "photo",
    "of",
    "a",
    "an",
    "to",
    "in",
    "on",
    "or",
}

_GOOGLE_URL = "https://www.google.com/search"

# Regex to find ischj block: {"ischj": ... }
_ISCHJ_RE = re.compile(r'"ischj"\s*:\s*\{', re.MULTILINE)


def enrich_image_query(query: str, heading: str | None = None, context: str | None = None) -> str:
    """Turn vague/ambiguous AI queries into educational, disambiguated search phrases."""
    clean = " ".join((query or "").split()).strip()
    head = " ".join((heading or "").split()).strip()
    extra = " ".join((context or "").split()).strip()
    domain = f"{clean} {head} {extra}".strip()
    if not clean or clean.lower() in {"none", "n/a", "na", "null"}:
        clean = head
    if not clean:
        return ""
    if _VAGUE_QUERY_RE.search(clean) and head:
        clean = head

    # Disambiguate tech acronyms using surrounding explanation/heading text.
    if _CLOUD_CONTEXT_RE.search(domain):
        if re.search(r"\bARM\b", clean) and "resource manager" not in clean.lower():
            clean = re.sub(r"\bARM\b", "Azure Resource Manager", clean)
        if "azure" not in clean.lower() and re.search(r"\bazure\b", domain, re.I):
            clean = f"Azure {clean}"
        if "microsoft" not in clean.lower() and re.search(r"\bportal\b", clean, re.I):
            clean = f"Microsoft {clean}"

    low = clean.lower()
    if not any(hint in low for hint in _VISUAL_HINTS):
        # Prefer textbook-style hits over lifestyle stock / course banners.
        if _CLOUD_CONTEXT_RE.search(domain):
            clean = f"{clean} architecture diagram"
        else:
            clean = f"{clean} diagram"
    return " ".join(clean.split())[:100]


def _query_is_cloud(query: str) -> bool:
    return bool(_CLOUD_CONTEXT_RE.search(query or ""))


def _wants_diagram(query: str) -> bool:
    low = (query or "").lower()
    return any(word in low for word in ("diagram", "architecture", "schematic", "chart", "comparison", "infographic"))


def _is_off_topic(query: str, item: dict) -> bool:
    """Reject common wrong-sense hits (human arm for Azure ARM, Coursera banners for charts)."""
    blob = _candidate_text(item)
    if not blob.strip():
        return False
    if _query_is_cloud(query) and any(noise in blob for noise in _ANATOMY_NOISE):
        return True
    if _wants_diagram(query) and any(noise in blob for noise in _COURSE_BANNER_NOISE):
        return True
    return False


def _candidate_text(item: dict) -> str:
    parts: list[str] = []

    def push(value: object) -> None:
        if isinstance(value, str) and value.strip():
            parts.append(value)
        elif isinstance(value, dict):
            for nested in value.values():
                push(nested)
        elif isinstance(value, list):
            for nested in value[:8]:
                push(nested)

    for key in (
        "title",
        "pt",
        "st",
        "alt",
        "text",
        "snippet",
        "name",
        "caption",
        "ru",
        "rh",
        "id",
    ):
        push(item.get(key))
    push(item.get("original_image"))
    push(item.get("image"))
    push(item.get("text_in_grid"))
    orig = item.get("original_image")
    url = str(orig.get("url") or "") if isinstance(orig, dict) else ""
    if not url:
        url = str(item.get("url") or item.get("ou") or "")
    parts.append(url)
    return " ".join(parts).lower()


def _query_tokens(query: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-z0-9]+", (query or "").lower())
        if len(token) > 2 and token not in _STOP_TOKENS
    ]


def _relevance_score(query: str, item: dict) -> int:
    tokens = _query_tokens(query)
    if not tokens:
        return 0
    blob = _candidate_text(item)
    if not blob.strip():
        return 0
    hits = sum(1 for token in tokens if token in blob)
    # Strongly prefer images whose title/url mention the same concept words.
    return int(40 * hits / len(tokens))


def _build_google_url(query: str) -> str:
    # tbm=isch = image search; isz:m prefers medium+ (less tiny icons)
    q = quote_plus(query.strip()[:100])
    return (
        f"{_GOOGLE_URL}?q={q}&tbm=isch&safe=active&hl=en&gl=us"
        "&tbs=isz:m&udm=2&source=hp&biw=1280&bih=720&ei=1"
    )


def _extract_ischj_json(text: str) -> dict | None:
    """Find first {"ischj": {...}} in HTML and return the inner dict."""
    m = _ISCHJ_RE.search(text)
    if not m:
        return None
    brace_start = m.end() - 1  # at '{'
    depth = 0
    in_str = False
    esc = False
    for idx in range(brace_start, len(text)):
        ch = text[idx]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        else:
            if ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    raw = text[brace_start : idx + 1]
                    try:
                        return json.loads(raw)
                    except json.JSONDecodeError:
                        return None
    return None


def _parse_ischj_candidates(text: str) -> list[dict]:
    data = _extract_ischj_json(text)
    if not data:
        return []
    meta = data.get("metadata") if isinstance(data, dict) else None
    if not isinstance(meta, list):
        candidates: list[dict] = []
        for v in data.values() if isinstance(data, dict) else []:
            if isinstance(v, list):
                candidates.extend([x for x in v if isinstance(x, dict)])
        return candidates
    return [x for x in meta if isinstance(x, dict)]


def _score_candidate(item: dict, query: str = "") -> int:
    """Score per size/host rules plus query relevance. Returns -1 to reject."""
    if query and _is_off_topic(query, item):
        return -1
    orig = item.get("original_image")
    url = ""
    if isinstance(orig, dict):
        url = str(orig.get("url") or "").strip()
        try:
            w = int(orig.get("width") or 0)
            h = int(orig.get("height") or 0)
        except (ValueError, TypeError):
            w = h = 0
    else:
        w = h = 0
    if not url:
        url = str(item.get("url") or item.get("ou") or "").strip()
    if not url.startswith("https://"):
        return -1
    low = url.lower()
    if "encrypted-tbn" in low:
        return -1
    if any(skip in low for skip in _SKIP_SUBSTRS):
        return -1
    if any(noise in low for noise in _COURSE_BANNER_NOISE):
        return -1
    try:
        if not w:
            w = int(item.get("ow") or item.get("width") or 0)
        if not h:
            h = int(item.get("oh") or item.get("height") or 0)
    except (ValueError, TypeError):
        pass
    score = 10
    if w >= 640 and h >= 360:
        score += 20
    elif w >= 400 and h >= 300:
        score += 10
    elif w and h and (w < 200 or h < 150):
        score -= 15
    if low.endswith((".jpg", ".jpeg", ".png", ".webp")):
        score += 3
    if any(
        edu in low
        for edu in (
            "britannica",
            "wikipedia",
            "wikimedia",
            "khanacademy",
            "openstax",
            "ck12",
            "byjus",
            "vedantu",
            "nasa.gov",
            "nih.gov",
            "geeksforgeeks",
            "tutorialspoint",
            "learn.microsoft.com",
            "microsoft.com/en-us/azure",
            "docs.microsoft",
            "edu/",
            ".edu/",
        )
    ):
        score += 25
    if any(stock in low for stock in ("dreamstime", "adobestock", "123rf")):
        score -= 12
    compact = low.replace("-", "").replace("_", "")
    if any(hint.replace(" ", "") in compact for hint in ("diagram", "chart", "schematic", "labeled", "architecture")):
        score += 12
    if any(word in low for word in ("stock", "shutter", "lifestyle", "workspace", "mockup", "coursera", "udemy")):
        score -= 10
    relevance = _relevance_score(query, item)
    score += relevance
    # Prefer real concept overlap when title/url text exists.
    if query and _candidate_text(item).strip() and relevance == 0 and _wants_diagram(query):
        score -= 18
    score += min(len(url) // 60, 3)
    return score


def pick_https_image(candidates: list[dict], query: str = "") -> str | None:
    """Pick highest-scoring https URL, favoring query relevance when metadata exists."""
    ranked: list[tuple[int, int, str]] = []
    for item in candidates:
        url = None
        orig = item.get("original_image")
        if isinstance(orig, dict):
            url = orig.get("url")
        if not url:
            url = item.get("url") or item.get("ou")
        if not isinstance(url, str):
            continue
        score = _score_candidate(item, query)
        if score < 0:
            continue
        relevance = _relevance_score(query, item)
        ranked.append((score, relevance, url))
    if not ranked:
        return None
    ranked.sort(key=lambda row: (row[0], row[1]), reverse=True)
    with_overlap = [row for row in ranked if row[1] > 0]
    # For diagram searches, require some title/url overlap when any overlap exists in the pool.
    if _wants_diagram(query) and with_overlap:
        return with_overlap[0][2]
    pool = with_overlap if with_overlap else ranked
    return pool[0][2]


async def _fetch_bing_image(query: str, *, timeout: float = 7.0) -> str | None:
    """Fallback: Bing Images (murl) — easy to parse, handles &quot; encoding."""
    try:
        url = f"https://www.bing.com/images/search?q={quote_plus(query)}&form=HDRSC2&first=1"
        headers = {
            "User-Agent": _UAS[1],
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.bing.com/",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Upgrade-Insecure-Requests": "1",
        }
        async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            text = resp.text
            cands: list[dict] = []
            # Bing encodes quotes as &quot; — handle both
            # Find murl with either " or &quot; delimiters
            for m in re.finditer(r"murl.*?https://", text, re.IGNORECASE):
                start = m.end() - 8  # at https://
                # Find URL end: either &quot; or " or '
                end = len(text)
                for delim in ("&quot;", '"', "'"):
                    idx = text.find(delim, start)
                    if idx != -1:
                        end = min(end, idx)
                raw_url = text[start:end]
                # Decode HTML entities
                raw_url = raw_url.replace("&amp;", "&").replace("\\u002f", "/").replace("\\/", "/").strip()
                # Clean up trailing chars
                raw_url = raw_url.split("&quot;")[0].split('"')[0].split("'")[0]
                if not raw_url.startswith("https://"):
                    continue
                # Skip thumbnails
                if "th?id=" in raw_url or "encrypted" in raw_url:
                    continue
                # Try to find dimensions nearby
                snippet = text[max(0, m.start() - 600) : start + 900]
                ow = 640
                oh = 360
                ow_m = re.search(r'"ow":\s*(\d+)', snippet)
                oh_m = re.search(r'"oh":\s*(\d+)', snippet)
                if ow_m:
                    try:
                        ow = int(ow_m.group(1))
                    except:  # noqa: E722
                        pass
                if oh_m:
                    try:
                        oh = int(oh_m.group(1))
                    except:  # noqa: E722
                        pass
                # Alternative HTML encoded dimensions: &quot;ow&quot;:640
                if ow == 640:
                    ow_m2 = re.search(r"ow(?:\\?\"|&quot;)\s*:\s*(\d+)", snippet)
                    if ow_m2:
                        try:
                            ow = int(ow_m2.group(1))
                        except:  # noqa: E722
                            pass
                cands.append({"url": raw_url, "width": ow, "height": oh, "title": snippet[:240]})
                if len(cands) >= 20:
                    break
            # Also try direct regex for murl with captured URL
            if not cands:
                for m in re.finditer(r'"murl"\s*:\s*"(https://[^"]+)"', text):
                    cands.append({"url": m.group(1).replace("\\/", "/"), "width": 640, "height": 360})
            if not cands:
                # Last resort: any https image URL near "murl"
                for m in re.finditer(r"https://[^\"'&\\]+\.(?:jpg|jpeg|png|webp)", text, re.IGNORECASE):
                    url_cand = m.group(0)
                    if "bing.net/th" in url_cand or "encrypted" in url_cand:
                        continue
                    cands.append({"url": url_cand, "width": 640, "height": 360})
                    if len(cands) >= 15:
                        break
            return pick_https_image(cands, query)
    except (httpx.HTTPError, ValueError, TypeError):
        return None


async def _fetch_duckduckgo_image(query: str, *, timeout: float = 7.0) -> str | None:
    """Fallback: DuckDuckGo i.js — reliable JSON, uses vqd token."""
    try:
        headers = {
            "User-Agent": _UAS[1],
            "Accept": "application/json,text/html,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://duckduckgo.com/",
        }
        async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
            home = await client.get("https://duckduckgo.com/", params={"q": query, "iax": "images", "ia": "images"})
            if home.status_code != 200:
                return None
            vqd_m = re.search(r"vqd=([0-9-]+)", home.text or "")
            if not vqd_m:
                return None
            vqd = vqd_m.group(1)
            resp = await client.get(
                "https://duckduckgo.com/i.js",
                params={"l": "us-en", "o": "json", "q": query, "vqd": vqd, "f": ",,,"},
                headers={**headers, "Accept": "application/json"},
            )
            if resp.status_code != 200:
                return None
            payload = resp.json()
            results = payload.get("results") if isinstance(payload, dict) else None
            if not isinstance(results, list):
                return None
            cands: list[dict] = []
            for r in results[:20]:
                if not isinstance(r, dict):
                    continue
                img = r.get("image")
                if not isinstance(img, str) or not img.startswith("https://"):
                    continue
                cands.append(
                    {
                        "url": img,
                        "title": str(r.get("title") or r.get("name") or ""),
                        "width": int(r.get("width") or 640),
                        "height": int(r.get("height") or 360),
                    }
                )
            return pick_https_image(cands, query)
    except (httpx.HTTPError, ValueError, TypeError, json.JSONDecodeError):
        return None


async def find_google_image_url(
    query: str,
    *,
    heading: str | None = None,
    context: str | None = None,
    timeout: float = 8.0,
) -> str | None:
    """Fetch Google Images search page like a browser, parse JSON, pick best https image.
    Tries Google (ischj) first, then Bing, then DuckDuckGo. Retries once after 800ms.
    """
    clean = enrich_image_query(query, heading, context)
    if not clean:
        return None

    url = _build_google_url(clean)
    headers_base = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://www.google.com/",
    }

    # --- Google (ischj) ---
    for attempt in range(2):
        ua = _UAS[attempt % len(_UAS)]
        headers = {**headers_base, "User-Agent": ua}
        try:
            async with httpx.AsyncClient(
                timeout=timeout,
                headers=headers,
                follow_redirects=True,
            ) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    await asyncio.sleep(0.8 if attempt == 0 else 0)
                    continue
                text = resp.text
                candidates = _parse_ischj_candidates(text)
                if not candidates:
                    for m in re.finditer(r"https://[^\"'\\]+\.(?:jpg|jpeg|png|webp)", text, re.IGNORECASE):
                        candidates.append({"url": m.group(0), "width": 640, "height": 360})
                        if len(candidates) >= 20:
                            break
                picked = pick_https_image(candidates, clean)
                if picked:
                    return picked
        except (httpx.HTTPError, ValueError, TypeError, json.JSONDecodeError):
            pass
        if attempt == 0:
            await asyncio.sleep(0.8)

    # --- Bing fallback (often works when Google blocks) ---
    bing = await _fetch_bing_image(clean, timeout=timeout)
    if bing:
        return bing

    # --- DuckDuckGo fallback (very reliable) ---
    ddg = await _fetch_duckduckgo_image(clean, timeout=timeout)
    if ddg:
        return ddg

    return None


async def fetch_section_images(
    sections: list[dict],
    *,
    progress_cb=None,  # async def progress_cb(done: int, total: int)
) -> list[dict]:
    """Fetch images for all sections concurrently with 2 workers and 350ms stagger.
    sections: list of dicts with at least {"id": str, "imageSearchQuery": str}
    Optional "prompt" / "heading" is used when the AI query is vague.
    Returns same list with added "imageUrl" (or None).
    """
    total = len(sections)
    if total == 0:
        return sections

    sem = asyncio.Semaphore(2)
    results: list[dict] = [dict(s) for s in sections]
    lock = asyncio.Lock()
    counter = {"done": 0}

    async def _one(idx: int):
        async with sem:
            if idx >= 2:
                await asyncio.sleep(0.35)
            else:
                await asyncio.sleep(0.05 * idx)
            query = str(results[idx].get("imageSearchQuery") or results[idx].get("image_search_query") or "").strip()
            heading = str(results[idx].get("prompt") or results[idx].get("heading") or "").strip()
            context = str(results[idx].get("answer") or results[idx].get("context") or "").strip()
            url = (
                await find_google_image_url(query, heading=heading or None, context=context or None)
                if (query or heading)
                else None
            )
            results[idx]["imageUrl"] = url
            results[idx]["image_url"] = url
            async with lock:
                counter["done"] += 1
                if progress_cb:
                    try:
                        maybe = progress_cb(counter["done"], total)
                        if asyncio.iscoroutine(maybe):
                            await maybe
                    except Exception:
                        pass

    await asyncio.gather(*[_one(i) for i in range(total)])
    return results


# Convenience for DB: fetch and persist StudyItems
async def fetch_and_persist_study_item_images(db, study_set_id) -> int:
    """Fetch images for all explanation items of a study set that have a search query but no URL yet.
    Updates study_items.image_url in place. Returns count of updated items.
    """
    from sqlalchemy import select

    from app.models import StudyItem

    rows = list(
        await db.scalars(select(StudyItem).where(StudyItem.study_set_id == study_set_id).order_by(StudyItem.position))
    )
    targets = [r for r in rows if r.kind.value == "explanation" and r.image_search_query and not r.image_url]
    if not targets:
        return 0

    sections = [
        {
            "id": str(r.id),
            "imageSearchQuery": r.image_search_query,
            "prompt": r.prompt,
            "answer": (r.answer or "")[:240],
        }
        for r in targets
    ]

    fetched = await fetch_section_images(sections)

    url_by_id = {s["id"]: s.get("imageUrl") for s in fetched}
    updated = 0
    for row in targets:
        url = url_by_id.get(str(row.id))
        if url:
            row.image_url = url
            updated += 1
    if updated:
        await db.commit()
    return updated