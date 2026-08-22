import asyncio
import html as html_module
import json
import re
from urllib.parse import parse_qs, quote, unquote, urlparse

import httpx

WIKI_SEARCH = "https://en.wikipedia.org/w/api.php"
WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/"
BRAVE = "https://search.brave.com/search"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
TEACHING_HOSTS = (
    "geeksforgeeks.org",
    "programiz.com",
    "w3schools.com",
    "developer.mozilla.org",
    "javatpoint.com",
    "tutorialspoint.com",
    "baeldung.com",
    "spring.io",
    "freecodecamp.org",
    "khanacademy.org",
    "britannica.com",
    "byjus.com",
    "vedantu.com",
    "simplilearn.com",
    "guru99.com",
    "interviewbit.com",
    "mathsisfun.com",
    "physicsclassroom.com",
    "chemguide.co.uk",
    "lumenlearning.com",
    "openstax.org",
    "ck12.org",
    "biologydictionary.net",
    "thoughtco.com",
    "sparknotes.com",
    "worldhistory.org",
    "nationalgeographic.com",
    "investopedia.com",
    "brilliant.org",
    "osmosis.org",
    "nasa.gov",
    "nih.gov",
    "docs.docker.com",
    "docker.com",
)
WIKI_HOSTS = ("wikipedia.org", "wikimedia.org", "wikibooks.org", "wiktionary.org")
SKIP_HOSTS = (
    "pinterest.",
    "quora.com",
    "reddit.com",
    "chegg.com",
    "coursehero.",
    "youtube.com",
    "tiktok.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "medium.com",
    "duckduckgo.com",
    "udemy.com",
    "bing.com",
)
STOP = {
    "what",
    "why",
    "how",
    "does",
    "do",
    "the",
    "a",
    "an",
    "is",
    "are",
    "in",
    "of",
    "to",
    "for",
    "and",
    "or",
    "explain",
    "define",
    "tell",
    "me",
    "about",
    "please",
    "with",
    "from",
}
COMPOUND_TAILS = ("boot", "script", "native", "framework", "studio", "cloud")
SHORT_COMMANDS = {"ps", "ls", "cd", "rm", "cp", "mv", "os", "ip", "js", "ui", "db", "id", "vm", "gc", "ai", "ml"}
FILLER = STOP | {
    "used",
    "check",
    "they",
    "right",
    "many",
    "howmany",
    "running",
    "runing",
    "can",
    "could",
    "would",
    "should",
    "just",
    "like",
    "also",
    "into",
    "your",
    "my",
    "its",
    "was",
    "were",
    "been",
    "have",
    "has",
    "had",
    "will",
    "than",
    "then",
    "when",
    "where",
    "which",
    "who",
    "some",
    "any",
    "all",
    "each",
    "both",
    "only",
    "same",
    "such",
    "too",
    "very",
    "still",
    "already",
    "correct",
    "wrong",
    "true",
    "false",
    "yes",
    "something",
    "anything",
    "wanna",
    "want",
    "make",
    "making",
    "new",
    "things",
    "thing",
    "stuff",
    "idea",
    "ideas",
    "build",
    "building",
    "start",
    "starting",
    "valuable",
    "give",
    "looking",
    "need",
    "needs",
    "good",
    "best",
    "help",
}
SKIP_PATHS = ("/videos/", "/courses/", "/premium", "/wp-content", "/search", "/page/")
SITE_LABELS = {
    "geeksforgeeks.org": "GeeksforGeeks",
    "programiz.com": "Programiz",
    "baeldung.com": "Baeldung",
    "javatpoint.com": "Javatpoint",
    "w3schools.com": "W3Schools",
    "tutorialspoint.com": "TutorialsPoint",
    "developer.mozilla.org": "MDN",
    "freecodecamp.org": "freeCodeCamp",
    "khanacademy.org": "Khan Academy",
    "britannica.com": "Britannica",
    "wikipedia.org": "Wikipedia",
    "google.com": "Google",
    "docs.docker.com": "Docker Docs",
}
BRAVE_TITLE_RE = re.compile(
    r'<a href="(https://[^"]+)"[^>]*>.*?class="title search-snippet-title[^"]*"[^>]*>(.*?)</div>',
    re.I | re.S,
)
LD_RE = re.compile(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', re.I | re.S)


def _plain(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", html_module.unescape(text)).strip()


def _compact(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def _host(url: str) -> str:
    return urlparse(url).netloc.lower().removeprefix("www.")


def _is_wiki(url: str) -> bool:
    host = _host(url)
    return any(name in host for name in WIKI_HOSTS)


def _site_label(url: str) -> str:
    host = _host(url)
    for name, label in SITE_LABELS.items():
        if name in host:
            return label
    return host or "Web"


def _path_ok(url: str) -> bool:
    path = urlparse(url).path.lower()
    return not any(part in path for part in SKIP_PATHS)


def _is_teaching(url: str) -> bool:
    host = _host(url)
    return any(name in host for name in TEACHING_HOSTS)


def _rank(url: str) -> int:
    host = _host(url)
    if "google." in host:
        return -10
    if any(name in host for name in WIKI_HOSTS):
        return 10_000
    for index, name in enumerate(TEACHING_HOSTS):
        if name in host:
            return index
    if host.endswith(".edu") or host.endswith(".gov"):
        return 80
    return 400


def _usable(url: str) -> bool:
    if not url.startswith("https://"):
        return False
    host = _host(url)
    if "google." in host:
        return True
    if not host or any(bad in host for bad in SKIP_HOSTS):
        return False
    return _path_ok(url)


def _space_compound(text: str) -> str:
    pieces: list[str] = []
    for word in (text or "").split():
        split = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", word)
        low = split.lower()
        for tail in COMPOUND_TAILS:
            if low.endswith(tail) and " " not in split and len(split) > len(tail) + 2:
                split = f"{split[: -len(tail)]} {split[-len(tail) :]}"
                break
        pieces.append(split)
    return " ".join(pieces).strip()


def _topic_queries(phrase: str) -> list[str]:
    raw = " ".join((phrase or "").split())
    stripped = " ".join(word for word in raw.split() if word.lower() not in STOP) or raw
    found: list[str] = []
    for item in (stripped, raw):
        if item and item not in found:
            found.append(item)
        spaced = _space_compound(item)
        if spaced and spaced not in found:
            found.append(spaced)
    preferred = [item for item in found if " " in item]
    rest = [item for item in found if item not in preferred]
    return (preferred + rest)[:4]


def _search_topic(phrase: str) -> str:
    tokens: list[str] = []
    for raw in (phrase or "").split():
        word = raw.strip().lower()
        if word.startswith("-") and 2 <= len(word) <= 5:
            tokens.append(word)
            continue
        clean = re.sub(r"[^a-z0-9+]", "", word)
        if not clean or clean in FILLER:
            continue
        if len(clean) <= 2 and clean not in SHORT_COMMANDS:
            continue
        tokens.append(clean)
        if len(tokens) >= 6:
            break
    low = [token.lower() for token in tokens]
    if "ai" in low and any(word in low for word in ("health", "healthcare", "medical", "medicine")):
        return "artificial intelligence in healthcare"
    topic = _space_compound(" ".join(tokens)).strip()
    return topic[:80] or " ".join((phrase or "").split())[:80]


def _relevant(phrase: str, title: str, snippet: str) -> bool:
    hay = f"{title} {snippet}".lower()
    compact_hay = _compact(hay)
    tokens: list[str] = []
    for word in _search_topic(phrase).lower().split():
        if word not in tokens and word not in FILLER:
            tokens.append(word)
    if not tokens:
        return True
    hits = sum(1 for word in tokens if word in hay or _compact(word) in compact_hay)
    return hits >= max(1, (len(tokens) + 1) // 2)


def _unwrap(href: str) -> str:
    raw = html_module.unescape(href or "").strip()
    if raw.startswith("//"):
        raw = f"https:{raw}"
    parsed = urlparse(raw)
    encoded = parse_qs(parsed.query).get("uddg")
    if encoded:
        raw = unquote(encoded[0])
    if raw.startswith("//"):
        raw = f"https:{raw}"
    return raw.split("?", 1)[0].split("#", 1)[0]


def _parse_brave_html(markup: str) -> list[dict]:
    found: list[dict] = []
    seen: set[str] = set()
    for match in BRAVE_TITLE_RE.finditer(markup or ""):
        url = _unwrap(match.group(1))
        title = _plain(match.group(2))[:120]
        if not _usable(url) or not _is_teaching(url) or url in seen or len(title) < 8:
            continue
        seen.add(url)
        snippet = f"{title}. Teaching article from {_site_label(url)}."
        found.append({"title": title, "url": url, "snippet": snippet})
        if len(found) >= 6:
            break
    return found


GOOGLE_OVERVIEW_RES = (
    re.compile(r"AI Overview.{0,500}?<div[^>]*>(.{50,800}?)</div>", re.I | re.S),
    re.compile(
        r'class="[^"]*kno-rdesc[^"]*"[^>]*>.{0,120}?<span[^>]*>(.{50,800}?)</span>',
        re.I | re.S,
    ),
    re.compile(r'<div class="BNeawe s3v9rd AP7Wnd">(.{50,800}?)</div>', re.I | re.S),
    re.compile(r'class="[^"]*hgKElc[^"]*"[^>]*>(.{50,800}?)</(?:div|span)>', re.I | re.S),
    re.compile(r'data-attrid="wa:/description"[^>]*>(.{50,800}?)</div>', re.I | re.S),
    re.compile(r'<div class="VwiC3b[^"]*"[^>]*>(.{50,800}?)</div>', re.I | re.S),
)


def _is_google_js_wall(html: str) -> bool:
    low = (html or "").lower()
    if "enablejs" in low or "httpservice/retry/enablejs" in low:
        return True
    if "ai overview" in low or "bnewe" in low or "vwic3b" in low or "hgkelc" in low:
        return False
    return "<noscript>" in low and "display:none" in low


def _google_candidate(text: str) -> str:
    cleaned = _plain(text)
    if len(cleaned) < 50 or len(cleaned) > 900:
        return ""
    low = cleaned.lower()
    if "before you continue to google" in low or "unusual traffic" in low:
        return ""
    if "accept all" in low and "cookie" in low:
        return ""
    return cleaned


def _parse_google_overview(markup: str, query: str) -> list[dict]:
    texts: list[str] = []
    for pattern in GOOGLE_OVERVIEW_RES:
        for match in pattern.finditer(markup or ""):
            text = _google_candidate(match.group(1))
            if text and text not in texts:
                texts.append(text)
            if len(texts) >= 3:
                break
        if texts:
            break
    if not texts:
        return []
    snippet = texts[0]
    if len(texts) > 1 and len(snippet) < 160:
        snippet = f"{snippet} {texts[1]}"
    return [
        {
            "title": "Google AI Overview",
            "url": f"https://www.google.com/search?q={quote(query)}",
            "snippet": snippet[:700],
        }
    ]


async def _google_overview(client: httpx.AsyncClient, topic: str) -> list[dict]:
    try:
        response = await client.get(
            "https://www.google.com/search",
            params={"q": topic, "hl": "en", "gl": "us"},
            headers={**HEADERS, "Referer": "https://www.google.com/"},
        )
        if response.status_code != 200:
            return []
        if _is_google_js_wall(response.text):
            return []
        low = response.text.lower()
        if "unusual traffic" in low or "before you continue to google" in low:
            return []
        return _parse_google_overview(response.text, topic)
    except (httpx.HTTPError, ValueError, TypeError):
        return []


async def _brave_teaching(client: httpx.AsyncClient, topic: str) -> list[dict]:
    query = (
        f"{topic} (site:geeksforgeeks.org OR site:programiz.com OR site:baeldung.com "
        f"OR site:javatpoint.com OR site:w3schools.com OR site:tutorialspoint.com)"
    )
    try:
        response = await client.get(BRAVE, params={"q": query})
        if response.status_code != 200:
            return []
        return _parse_brave_html(response.text)
    except (httpx.HTTPError, ValueError, TypeError):
        return []


async def _article_snippet(client: httpx.AsyncClient, url: str) -> str:
    try:
        response = await client.get(url)
        if response.status_code != 200:
            return ""
        for match in LD_RE.finditer(response.text):
            try:
                payload = json.loads(match.group(1))
            except ValueError:
                continue
            if not isinstance(payload, dict):
                continue
            kind = str(payload.get("@type") or "")
            if "article" not in kind.lower():
                continue
            text = _plain(str(payload.get("description") or payload.get("articleBody") or ""))
            if len(text) >= 40:
                return text[:500]
    except (httpx.HTTPError, ValueError, TypeError):
        return ""
    return ""


def _wp_text(value) -> str:
    if isinstance(value, dict):
        return _plain(str(value.get("rendered") or ""))
    return _plain(str(value or ""))


async def _gfg_posts(client: httpx.AsyncClient, topic: str) -> list[dict]:
    try:
        response = await client.get(
            "https://www.geeksforgeeks.org/wp-json/wp/v2/posts",
            params={"search": topic, "per_page": 2, "_fields": "link,title,excerpt"},
        )
        if response.status_code != 200:
            return []
        payload = response.json()
    except (httpx.HTTPError, ValueError, TypeError):
        return []
    rows = payload if isinstance(payload, list) else []
    found: list[dict] = []
    seen: set[str] = set()
    for item in rows:
        if not isinstance(item, dict):
            continue
        url = str(item.get("link") or "").split("?", 1)[0]
        title = _wp_text(item.get("title"))[:120]
        snippet = _wp_text(item.get("excerpt"))[:500]
        if not _usable(url) or not _is_teaching(url) or url in seen or len(title) < 8:
            continue
        if len(snippet) < 40:
            snippet = f"{title}. Teaching article from GeeksforGeeks."
        seen.add(url)
        found.append({"title": title, "url": url, "snippet": snippet})
    return found[:2]


async def _race_teaching(client: httpx.AsyncClient, topic: str, phrase: str) -> list[dict]:
    tasks = [
        asyncio.create_task(_gfg_posts(client, topic)),
        asyncio.create_task(_brave_teaching(client, topic)),
    ]
    found: list[dict] = []
    pending: set[asyncio.Task] = set(tasks)
    while pending:
        done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            try:
                rows = task.result()
            except (asyncio.CancelledError, Exception):
                rows = []
            if isinstance(rows, list):
                found.extend(rows)
        teaching, _wiki = _pick(phrase, found)
        if teaching:
            for task in pending:
                task.cancel()
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)
            return teaching
    return []


async def _fill_snippets(client: httpx.AsyncClient, rows: list[dict], phrase: str) -> list[dict]:
    thin = [
        row
        for row in rows[:2]
        if "Teaching article from" in str(row.get("snippet") or "") or len(str(row.get("snippet") or "")) < 80
    ]
    if not thin:
        return rows
    extras = await asyncio.gather(*[_article_snippet(client, row["url"]) for row in thin])
    for row, extra in zip(thin, extras):
        if len(extra) >= 40 and _relevant(phrase, row["title"], extra):
            row["snippet"] = extra
    return rows


async def _discard(task: asyncio.Task) -> None:
    if task.done():
        return
    task.cancel()
    await asyncio.gather(task, return_exceptions=True)


def _task_rows(task: asyncio.Task) -> list[dict]:
    if not task.done() or task.cancelled() or task.exception() is not None:
        return []
    rows = task.result()
    return rows if isinstance(rows, list) else []


async def find_reliable_passages(query: str) -> list[dict]:
    phrase = " ".join((query or "").split())[:80].strip()
    if not phrase:
        return []
    topic = _search_topic(phrase) or (_topic_queries(phrase)[0] if _topic_queries(phrase) else phrase)
    timeout = httpx.Timeout(2.0, connect=1.2)
    async with httpx.AsyncClient(timeout=timeout, headers=HEADERS, follow_redirects=True) as client:
        google_task = asyncio.create_task(_google_overview(client, topic))
        gfg_task = asyncio.create_task(_gfg_posts(client, topic))
        brave_task = asyncio.create_task(_brave_teaching(client, topic))
        wiki_task = asyncio.create_task(_wiki_passages(client, [topic]))
        try:
            google = await google_task
        except (asyncio.CancelledError, Exception):
            google = []
        if not isinstance(google, list):
            google = []
        extras = _task_rows(gfg_task) + _task_rows(brave_task)
        if google:
            await _discard(gfg_task)
            await _discard(brave_task)
            wiki_rows = [
                row
                for row in _task_rows(wiki_task)
                if _relevant(phrase, str(row.get("title") or ""), str(row.get("snippet") or ""))
            ]
            await _discard(wiki_task)
            extras = await _fill_snippets(client, extras, phrase)
            teaching, _wiki = _pick(phrase, extras)
            return _dedupe(google + teaching + wiki_rows)[:4]
        leftover: list[dict] = []
        for task in (gfg_task, brave_task):
            try:
                rows = await task
            except (asyncio.CancelledError, Exception):
                rows = []
            if isinstance(rows, list):
                leftover.extend(rows)
        leftover = await _fill_snippets(client, leftover, phrase)
        teaching, _wiki = _pick(phrase, leftover)
        if teaching:
            await _discard(wiki_task)
            return _dedupe(teaching)[:3]
        try:
            wiki_rows = await wiki_task
        except (asyncio.CancelledError, Exception):
            wiki_rows = []
        if not isinstance(wiki_rows, list):
            wiki_rows = []
        wiki_rows = [
            row
            for row in wiki_rows
            if _relevant(phrase, str(row.get("title") or ""), str(row.get("snippet") or ""))
        ]
    return _dedupe(wiki_rows)[:4]


def _pick(phrase: str, hits: list[dict]) -> tuple[list[dict], list[dict]]:
    teaching: list[dict] = []
    wiki: list[dict] = []
    ranked = sorted(hits, key=lambda row: _rank(str(row.get("url") or "")))
    for row in ranked:
        url = str(row.get("url") or "")
        title = str(row.get("title") or "")
        snippet = str(row.get("snippet") or "")
        if not _usable(url) or not _relevant(phrase, title, snippet):
            continue
        if len(snippet) < 40 and _is_teaching(url) and len(title) >= 8:
            snippet = f"{title}. Teaching article from {_host(url)}."
        if len(snippet) < 40:
            continue
        item = {"title": title[:120], "url": url, "snippet": snippet[:500]}
        if _is_wiki(url):
            wiki.append(item)
        else:
            teaching.append(item)
    return _dedupe(teaching), _dedupe(wiki)


def _dedupe(rows: list[dict]) -> list[dict]:
    found: list[dict] = []
    seen: set[str] = set()
    for row in rows:
        url = str(row.get("url") or "")
        if url in seen:
            continue
        seen.add(url)
        found.append(row)
    return found


async def _wiki_passages(client: httpx.AsyncClient, queries: list[str]) -> list[dict]:
    if not queries:
        return []
    titles = await _wiki_titles(client, queries[0])
    if not titles:
        return []
    summaries = await asyncio.gather(
        *[_wiki_summary(client, title) for title in titles[:2]],
        return_exceptions=True,
    )
    found: list[dict] = []
    for summary in summaries:
        if isinstance(summary, dict):
            found.append(summary)
        if len(found) >= 2:
            break
    return found


async def _wiki_titles(client: httpx.AsyncClient, phrase: str) -> list[str]:
    try:
        response = await client.get(
            WIKI_SEARCH,
            params={
                "action": "query",
                "list": "search",
                "srsearch": phrase,
                "srlimit": 4,
                "srnamespace": 0,
                "format": "json",
                "origin": "*",
            },
        )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError, TypeError):
        return []
    hits = (payload.get("query") or {}).get("search") or []
    return [str(hit.get("title") or "").strip() for hit in hits if hit.get("title")][:3]


async def _wiki_summary(client: httpx.AsyncClient, title: str) -> dict | None:
    slug = quote(title.replace(" ", "_"), safe="()_")
    try:
        response = await client.get(f"{WIKI_SUMMARY}{slug}")
        if response.status_code != 200:
            return None
        payload = response.json()
    except (httpx.HTTPError, ValueError, TypeError):
        return None
    extract = _plain(str(payload.get("extract") or ""))
    desktop = (payload.get("content_urls") or {}).get("desktop") or {}
    url = str(desktop.get("page") or "") if isinstance(desktop, dict) else ""
    if not url.startswith("https://"):
        url = f"https://en.wikipedia.org/wiki/{slug}"
    if len(extract) < 40:
        return None
    return {
        "title": str(payload.get("title") or title)[:120],
        "url": url,
        "snippet": extract[:500],
    }
