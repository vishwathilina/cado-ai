import re
from urllib.parse import quote, urlparse

import httpx

WIKIMEDIA_API = "https://commons.wikimedia.org/w/api.php"
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
WIKIPEDIA_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/"
WIKIPEDIA_MEDIA = "https://en.wikipedia.org/api/rest_v1/page/media-list/"
DDG_HOME = "https://duckduckgo.com/"
DDG_IMAGES = "https://duckduckgo.com/i.js"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json,text/html,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
VQD_RE = re.compile(r"vqd=([0-9-]+)")
SKIP_IMAGE_HOSTS = (
    "chegg.com",
    "cheggcdn.com",
    "pinterest.",
    "shutterstock.",
    "gettyimages.",
    "alamy.",
    "istockphoto.",
    "encrypted-tbn",
    "gstatic.com",
    "bing.net",
)
WIKI_HOSTS = ("wikipedia.org", "wikimedia.org", "wikimediafoundation.org")
REFERENCE_HOSTS = (
    "geeksforgeeks.org",
    "programiz.com",
    "javatpoint.com",
    "tutorialspoint.com",
    "w3schools.com",
    "simplilearn.com",
    "guru99.com",
    "interviewbit.com",
    "freecodecamp.org",
    "techopedia.com",
    "byjus.com",
    "vedantu.com",
    "khanacademy.org",
    "britannica.com",
    "thoughtco.com",
    "sciencefacts.net",
    "biologydictionary.net",
    "lumenlearning.com",
    "openstax.org",
    "ck12.org",
    "sparknotes.com",
    "history.com",
    "worldhistory.org",
    "nationalgeographic.com",
    "physicsclassroom.com",
    "chemguide.co.uk",
    "mathsisfun.com",
    "brilliant.org",
    "investopedia.com",
    "osmosis.org",
    "nasa.gov",
    "nih.gov",
)
SAFE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
DIAGRAM_HINTS = (
    "diagram",
    "illustration",
    "schematic",
    "overview",
    "labeled",
    "labelled",
    "flowchart",
    "architecture",
    "structure",
    "cycle",
    "model",
    "normalization",
    "network",
    "anomaly",
    "uml",
    "schema",
    "handshake",
    "pipeline",
    "protocol",
    "stack",
    "layer",
)
SKIP_HINTS = ("logo", "icon", "flag", "coat of arms", "signature", "selfie", "portrait", "mascot")


def _plain(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", text).strip()


def _meta(info: dict, key: str) -> str:
    raw = (info.get("extmetadata") or {}).get(key) or {}
    return _plain(str(raw.get("value") or ""))


def _topic(query: str) -> str:
    cleaned = re.sub(
        r"\b(diagram|illustration|photo|picture|image|labeled|labelled|schematic|simple)\b",
        "",
        query,
        flags=re.IGNORECASE,
    )
    return " ".join(cleaned.split())[:80]


def _score(title: str, query: str) -> int:
    hay = title.lower()
    if any(skip in hay for skip in SKIP_HINTS):
        return -50
    score = 0
    for word in query.lower().split():
        if len(word) > 2 and word in hay:
            score += 3
    for hint in DIAGRAM_HINTS:
        if hint in hay:
            score += 8
    if hay.endswith(".svg") or "svg" in hay:
        score += 4
    return score


def _https(url: str) -> str | None:
    if url.startswith("//"):
        url = f"https:{url}"
    if not url.startswith("https://"):
        return None
    return url.split("?", 1)[0]


def _host(url: str) -> str:
    return urlparse(url).netloc.lower().removeprefix("www.")


def _is_wiki_host(host: str) -> bool:
    return any(name in host for name in WIKI_HOSTS)


def _web_queries(phrase: str, domain: str) -> list[str]:
    topic = _topic(phrase) or phrase
    queries = [f"{topic} diagram", f"{topic} labeled diagram"]
    unique: list[str] = []
    for item in queries:
        cleaned = " ".join(item.split())
        if cleaned and cleaned not in unique:
            unique.append(cleaned)
    return unique


def _web_score(item: dict, topic: str, domain: str) -> int:
    image = str(item.get("image") or "")
    title = str(item.get("title") or "")
    page = str(item.get("url") or "")
    hay = f"{title} {image} {page}".lower()
    if any(skip in hay for skip in (*SKIP_HINTS, "favicon", "sprite", "gfg_200", "gfg_complete_logo")):
        return -100
    image_host = _host(image)
    page_host = _host(page)
    if _is_wiki_host(image_host) or _is_wiki_host(page_host):
        return -100
    if any(bad in image_host or bad in page_host for bad in SKIP_IMAGE_HOSTS):
        return -100
    width = int(item.get("width") or 0)
    height = int(item.get("height") or 0)
    if width and height and (width < 240 or height < 180):
        return -20
    fmt = str(item.get("encoding_format") or "").lower()
    if fmt and fmt not in {"jpeg", "jpg", "png", "webp", "gif"}:
        return -40
    score = 6
    if any(host in image_host or host in page_host for host in REFERENCE_HOSTS):
        score += 30
    if "geeksforgeeks" in image_host or "geeksforgeeks" in page_host:
        score += 12
    for word in topic.lower().split():
        if len(word) > 2 and word in hay:
            score += 3
    for hint in DIAGRAM_HINTS:
        if hint in hay:
            score += 6
    return score


def _web_credit(url: str, page: str) -> str:
    image_host = _host(url)
    page_host = _host(page)
    blob = f"{image_host} {page_host}"
    if "geeksforgeeks" in blob:
        return "GeeksforGeeks"
    for ref in REFERENCE_HOSTS:
        if ref in blob:
            return ref
    return (page_host or image_host)[:80] or "web"


def _web_hit(item: dict, topic: str, domain: str) -> dict | None:
    url = _https(str(item.get("image") or ""))
    if not url:
        return None
    score = _web_score({**item, "image": url}, topic, domain)
    if score < 8:
        return None
    caption = _plain(str(item.get("title") or topic)) or topic
    return {
        "url": url,
        "caption": caption[:180],
        "credit": _web_credit(url, str(item.get("url") or "")),
        "score": score,
    }


async def _ddg_images(client: httpx.AsyncClient, query: str) -> list[dict]:
    try:
        home = await client.get(DDG_HOME, params={"q": query, "iax": "images", "ia": "images"})
        if home.status_code != 200:
            return []
        match = VQD_RE.search(getattr(home, "text", "") or "")
        if not match:
            return []
        response = await client.get(
            DDG_IMAGES,
            params={"l": "us-en", "o": "json", "q": query, "vqd": match.group(1), "f": ",,,"},
            headers={**HEADERS, "Referer": "https://duckduckgo.com/", "Accept": "application/json"},
        )
        if response.status_code != 200:
            return []
        payload = response.json()
    except (httpx.HTTPError, ValueError, TypeError):
        return []
    results = payload.get("results") if isinstance(payload, dict) else None
    return results if isinstance(results, list) else []


async def _web_diagram(client: httpx.AsyncClient, phrase: str, domain: str) -> dict | None:
    topic = _topic(phrase) or phrase
    best: dict | None = None
    best_score = -1
    for query in _web_queries(phrase, domain):
        for item in await _ddg_images(client, query):
            if not isinstance(item, dict):
                continue
            hit = _web_hit(item, topic, domain)
            if not hit:
                continue
            score = int(hit.pop("score"))
            if score > best_score:
                best = hit
                best_score = score
        if best and best_score >= 12:
            return best
    return best


def _usable_url(info: dict) -> str | None:
    mime = str(info.get("mime") or "").lower()
    thumb = info.get("thumburl")
    raw = info.get("url")
    if mime in SAFE_TYPES:
        url = thumb or raw
    elif mime == "image/svg+xml" and isinstance(thumb, str):
        url = thumb
    else:
        return None
    if not isinstance(url, str):
        return None
    return _https(url)


def _commons_hit(page: dict) -> dict | None:
    infos = page.get("imageinfo") or []
    if not infos:
        return None
    info = infos[0]
    url = _usable_url(info)
    if not url:
        return None
    title = str(page.get("title") or "").removeprefix("File:")
    caption = _meta(info, "ObjectName") or _meta(info, "ImageDescription") or title
    artist = _meta(info, "Artist")
    license_name = _meta(info, "LicenseShortName") or "Wikimedia Commons"
    source = artist[:80] if artist else "Wikimedia Commons"
    return {
        "url": url,
        "caption": caption[:180] or title[:180],
        "credit": f"{source} · {license_name}"[:180],
        "title": title,
    }


def _commons_phrases(phrase: str, domain: str) -> list[str]:
    topic = _topic(phrase) or phrase
    unique: list[str] = []
    for item in (f"{topic} diagram", phrase):
        cleaned = " ".join(item.split())
        if cleaned and cleaned not in unique:
            unique.append(cleaned)
    return unique


async def _commons_diagram(client: httpx.AsyncClient, phrase: str, domain: str = "general") -> dict | None:
    topic = _topic(phrase) or phrase
    best: tuple[int, dict] | None = None
    for search in _commons_phrases(phrase, domain):
        params = {
            "action": "query",
            "generator": "search",
            "gsrsearch": search,
            "gsrnamespace": 6,
            "gsrlimit": 12,
            "prop": "imageinfo",
            "iiprop": "url|mime|extmetadata|size",
            "iiurlwidth": 960,
            "format": "json",
            "origin": "*",
        }
        try:
            response = await client.get(WIKIMEDIA_API, params=params)
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError):
            continue
        pages = (payload.get("query") or {}).get("pages") or {}
        for page in pages.values():
            hit = _commons_hit(page)
            if not hit:
                continue
            score = _score(hit.pop("title"), topic)
            if score < 0:
                continue
            if not best or score > best[0]:
                best = (score, hit)
        if best and best[0] >= 8:
            return best[1]
    return best[1] if best else None


async def _wikipedia_titles(client: httpx.AsyncClient, phrase: str, domain: str) -> list[str]:
    topic = _topic(phrase) or phrase
    params = {
        "action": "query",
        "list": "search",
        "srsearch": topic,
        "srlimit": 5,
        "srnamespace": 0,
        "format": "json",
        "origin": "*",
    }
    try:
        response = await client.get(WIKIPEDIA_API, params=params)
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError):
        return [topic]
    hits = (payload.get("query") or {}).get("search") or []
    titles = [str(hit.get("title") or "").strip() for hit in hits if hit.get("title")]
    return titles[:3] or [topic]


def _media_src(item: dict) -> str | None:
    srcset = item.get("srcset") or []
    urls: list[str] = []
    for entry in srcset:
        src = entry.get("src") if isinstance(entry, dict) else None
        if isinstance(src, str):
            urls.append(src)
    if not urls:
        return None
    return _https(urls[-1])


async def _wikipedia_article_diagram(client: httpx.AsyncClient, phrase: str, domain: str) -> dict | None:
    topic = _topic(phrase) or phrase
    best: tuple[int, dict] | None = None
    for title in await _wikipedia_titles(client, phrase, domain):
        slug = quote(title.replace(" ", "_"), safe="()_")
        try:
            response = await client.get(f"{WIKIPEDIA_MEDIA}{slug}")
            if response.status_code != 200:
                continue
            payload = response.json()
        except (httpx.HTTPError, ValueError):
            continue
        for item in payload.get("items") or []:
            if not isinstance(item, dict) or item.get("type") != "image":
                continue
            file_title = str(item.get("title") or "").removeprefix("File:")
            url = _media_src(item)
            if not url:
                continue
            caption = str((item.get("caption") or {}).get("text") or file_title)
            hay = f"{file_title} {caption}"
            score = _score(hay, topic)
            if score < 4:
                continue
            hit = {
                "url": url,
                "caption": _plain(caption)[:180] or file_title[:180],
                "credit": "Wikipedia · labeled diagram",
            }
            if not best or score > best[0]:
                best = (score, hit)
        if best and best[0] >= 8:
            return best[1]
    return best[1] if best else None


async def _wikipedia_diagram(client: httpx.AsyncClient, phrase: str) -> dict | None:
    topic = _topic(phrase) or phrase
    titles = [topic, topic.replace(" ", "_")]
    for title in titles:
        slug = quote(title.replace(" ", "_"), safe="()_")
        try:
            response = await client.get(f"{WIKIPEDIA_SUMMARY}{slug}")
            if response.status_code != 200:
                continue
            payload = response.json()
        except (httpx.HTTPError, ValueError):
            continue
        image = (payload.get("originalimage") or {}).get("source") or (payload.get("thumbnail") or {}).get(
            "source"
        )
        if not isinstance(image, str):
            continue
        url = _https(image)
        if not url:
            continue
        page_title = str(payload.get("title") or topic)
        if _score(page_title, topic) < 0:
            continue
        return {
            "url": url,
            "caption": page_title[:180],
            "credit": "Wikipedia · educational diagram",
        }
    return None


async def find_education_image(query: str, domain: str = "general") -> dict | None:
    phrase = " ".join((query or "").split())[:80].strip()
    if not phrase:
        return None
    try:
        async with httpx.AsyncClient(timeout=6, headers=HEADERS, follow_redirects=True) as client:
            web = await _web_diagram(client, phrase, domain)
            if web:
                return web
            article = await _wikipedia_article_diagram(client, phrase, domain)
            if article:
                return article
            diagram = await _commons_diagram(client, phrase, domain)
            if diagram:
                return diagram
            return await _wikipedia_diagram(client, phrase)
    except (httpx.HTTPError, ValueError):
        return None
