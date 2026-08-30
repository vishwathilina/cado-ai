"""Google Images fetcher — mimics browser, parses ischj JSON, picks best https image.

Implements the flow user described:
 AI writes imageSearchQuery -> fetchSectionImages (2 workers, 350ms pause) -> findGoogleImageUrl
 -> fetch https://www.google.com/search?q=...&tbm=isch -> parse {"ischj":...} -> pickHttpsImage -> save sections.imageUrl
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
)

_GOOGLE_URL = "https://www.google.com/search"

# Regex to find ischj block: {"ischj": ... }  — capture up to matching brace depth is hard,
# so we grab the whole ischj metadata array via a simpler approach: find '"ischj":' then
# extract the next balanced JSON object.
_ISCHJ_RE = re.compile(r'"ischj"\s*:\s*\{', re.MULTILINE)


def _build_google_url(query: str) -> str:
    # tbm=isch = image search, safe=active, plus generic params to look like browser
    q = quote_plus(query.strip()[:80])
    return (
        f"{_GOOGLE_URL}?q={q}&tbm=isch&safe=active&hl=en&gl=us"
        "&udm=2&source=hp&biw=1280&bih=720&ei=1"
    )


def _extract_ischj_json(text: str) -> dict | None:
    """Find first {"ischj": {...}} in HTML and return the inner dict."""
    m = _ISCHJ_RE.search(text)
    if not m:
        return None
    start = m.start()
    # Find the JSON object starting at the opening brace of the outer object that contains ischj
    # Walk backwards to find the '{' that starts the object containing ischj, then parse forward with counting
    # Simpler: start at m.start()-1 and find opening brace, then count braces to extract
    # The pattern in Google HTML is often: ...,"ischj":{"metadata":[...]}...
    # So the value of ischj is a JSON object; we can extract it by counting braces from m.end()-1
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
    # data is expected to have metadata: list
    meta = data.get("metadata") if isinstance(data, dict) else None
    if not isinstance(meta, list):
        # Sometimes ischj contains "metadata" inside nested, or directly list under ischj
        # Try alternative: look for lists inside data
        candidates: list[dict] = []
        for v in data.values() if isinstance(data, dict) else []:
            if isinstance(v, list):
                candidates.extend([x for x in v if isinstance(x, dict)])
        return candidates
    return [x for x in meta if isinstance(x, dict)]


def _score_candidate(item: dict) -> int:
    """Score per user rules, returns -1 to reject."""
    url = str(item.get("original_image", {}).get("url") or item.get("url") or item.get("ou") or "").strip()
    if not url.startswith("https://"):
        return -1
    low = url.lower()
    if "encrypted-tbn" in low:
        return -1
    if any(skip in low for skip in _SKIP_SUBSTRS):
        return -1
    # Extract dimensions
    w = 0
    h = 0
    try:
        w = int(item.get("original_image", {}).get("width") or item.get("ow") or item.get("width") or 0)
        h = int(item.get("original_image", {}).get("height") or item.get("oh") or item.get("height") or 0)
        if not w:
            w = int(item.get("width") or 0)
        if not h:
            h = int(item.get("height") or 0)
    except (ValueError, TypeError):
        pass
    score = 10
    # Prefer 640x360+
    if w >= 640 and h >= 360:
        score += 20
    elif w >= 400 and h >= 300:
        score += 10
    elif w and h and (w < 200 or h < 150):
        score -= 15
    # Prefer non-svg, common formats
    if low.endswith((".jpg", ".jpeg", ".png", ".webp")):
        score += 3
    # Prefer educational hosts
    if any(edu in low for edu in ("britannica", "wikipedia", "wikimedia", "khanacademy", "openstax", "ck12", "byjus", "vedantu", "nasa.gov", "nih.gov", "geeksforgeeks", "tutorialspoint", "w3schools")):
        score += 25
    # Deprioritize obvious stock/paywalled hosts (but don't hard-reject all, keep as fallback)
    if any(stock in low for stock in ("dreamstime", "adobestock", "123rf")):
        score -= 12
    # Longer URLs often more direct?
    score += min(len(url) // 60, 3)
    return score


def pick_https_image(candidates: list[dict]) -> str | None:
    """Pick highest-scoring https URL, per spec."""
    best_url: str | None = None
    best_score = -1
    for item in candidates:
        # Normalize item shape: Google ischj metadata entries often have original_image.url
        url = None
        orig = item.get("original_image")
        if isinstance(orig, dict):
            url = orig.get("url")
        if not url:
            url = item.get("url") or item.get("ou")
        if not isinstance(url, str):
            continue
        score = _score_candidate(item)
        if score < 0:
            continue
        if score > best_score:
            best_score = score
            best_url = url
    return best_url


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
                cands.append({"url": raw_url, "width": ow, "height": oh})
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
            return pick_https_image(cands)
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
                        "width": int(r.get("width") or 640),
                        "height": int(r.get("height") or 360),
                    }
                )
            return pick_https_image(cands)
    except (httpx.HTTPError, ValueError, TypeError, json.JSONDecodeError):
        return None


async def find_google_image_url(query: str, *, timeout: float = 8.0) -> str | None:
    """Fetch Google Images search page like a browser, parse JSON, pick best https image.
    Tries Google (ischj) first, then Bing, then DuckDuckGo. Retries once after 800ms.
    """
    clean = " ".join((query or "").split())[:80].strip()
    if not clean or clean.lower() in {"none", "n/a", "null"}:
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
                picked = pick_https_image(candidates)
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
    Returns same list with added "imageUrl" (or None).
    Mirrors the TS behavior: 2 workers parallel, ~350ms pause between requests, progress.
    """
    total = len(sections)
    if total == 0:
        return sections

    sem = asyncio.Semaphore(2)
    results: list[dict] = [dict(s) for s in sections]
    # Track order for staggering
    lock = asyncio.Lock()
    counter = {"done": 0}

    async def _one(idx: int):
        async with sem:
            # Stagger: 350ms * (idx % 2) essentially, but to avoid burst we sleep 350ms before each except first two
            if idx >= 2:
                await asyncio.sleep(0.35)
            else:
                # small stagger for first batch too
                await asyncio.sleep(0.05 * idx)
            query = str(results[idx].get("imageSearchQuery") or results[idx].get("image_search_query") or "").strip()
            url = await find_google_image_url(query) if query else None
            results[idx]["imageUrl"] = url
            results[idx]["image_url"] = url
            async with lock:
                counter["done"] += 1
                if progress_cb:
                    try:
                        # support both sync and async callbacks
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

    sections = [{"id": str(r.id), "imageSearchQuery": r.image_search_query} for r in targets]

    # We don't need progress_cb for background; could log
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
