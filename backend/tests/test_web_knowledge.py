import asyncio

from app.services.web_knowledge import (
    _is_google_js_wall,
    _parse_google_overview,
    _relevant,
    _search_topic,
    find_reliable_passages,
)


def _brave_result(title: str, url: str) -> str:
    return f'<a href="{url}"><div class="title search-snippet-title">{title}</div></a>'


class FakeResponse:
    def __init__(self, payload: dict | None = None, status_code: int = 200, text: str = "") -> None:
        self._payload = payload or {}
        self.status_code = status_code
        self.text = text

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


class FakeClient:
    def __init__(self, pages: dict[str, FakeResponse]) -> None:
        self.pages = pages

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def get(self, url: str, params=None, **_kwargs):
        query = str((params or {}).get("q") or (params or {}).get("srsearch") or "")
        if "google." in url:
            return self.pages.get("google", FakeResponse(status_code=404))
        if "wp-json" in url:
            return self.pages.get("gfg_posts", FakeResponse(status_code=404))
        if "search.brave.com" in url:
            return self.pages.get("brave", FakeResponse(status_code=404))
        if "geeksforgeeks.org" in url or "programiz.com" in url or "baeldung.com" in url:
            return self.pages.get("article", FakeResponse(status_code=404))
        if "en.wikipedia.org/w/api.php" in url:
            if "spring boot" in query.lower() and "wiki_spring" in self.pages:
                return self.pages["wiki_spring"]
            return self.pages.get("wiki_search", FakeResponse({"query": {"search": []}}))
        if "page/summary" in url:
            return self.pages.get("wiki_summary", FakeResponse(status_code=404))
        return FakeResponse(status_code=404)


def test_find_reliable_passages_prefers_geeksforgeeks_over_wikipedia(monkeypatch) -> None:
    pages = {
        "brave": FakeResponse(
            text=_brave_result(
                "Normalization in DBMS - GeeksforGeeks",
                "https://www.geeksforgeeks.org/dbms/normalization-process-in-dbms/",
            )
        ),
        "article": FakeResponse(
            text=(
                '<script type="application/ld+json">'
                '{"@type":"Article","headline":"Normalization in DBMS",'
                '"description":"Normalization organizes a database to reduce redundancy because duplicate data causes insertion and update anomalies."}'
                "</script>"
            )
        ),
        "wiki_search": FakeResponse({"query": {"search": [{"title": "Database normalization"}]}}),
        "wiki_summary": FakeResponse(
            {
                "title": "Database normalization",
                "extract": "Database normalization is the process of structuring a relational database in accordance with a series of normal forms to reduce redundancy.",
                "content_urls": {
                    "desktop": {"page": "https://en.wikipedia.org/wiki/Database_normalization"}
                },
            }
        ),
    }

    class Client(FakeClient):
        def __init__(self, *args, **kwargs) -> None:
            super().__init__(pages)

    monkeypatch.setattr("app.services.web_knowledge.httpx.AsyncClient", Client)
    found = asyncio.run(find_reliable_passages("What is normalization in DBMS?"))
    assert "geeksforgeeks.org" in found[0]["url"]
    assert "redundancy" in found[0]["snippet"]
    wiki_urls = [row["url"] for row in found if "wikipedia.org" in row["url"]]
    if wiki_urls:
        assert "wikipedia.org" in found[-1]["url"]


def test_find_reliable_passages_uses_wikipedia_last(monkeypatch) -> None:
    class Client:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url: str, params=None, **_kwargs):
            if "en.wikipedia.org/w/api.php" in url:
                return FakeResponse({"query": {"search": [{"title": "Cell (biology)"}]}})
            if "page/summary" in url:
                return FakeResponse(
                    {
                        "title": "Cell (biology)",
                        "extract": "The cell is the smallest unit that can live on its own and that makes up all living organisms and the tissues of the body.",
                        "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Cell_(biology)"}},
                    }
                )
            return FakeResponse(status_code=404)

    monkeypatch.setattr("app.services.web_knowledge.httpx.AsyncClient", Client)
    found = asyncio.run(find_reliable_passages("What is a cell?"))
    assert found[0]["url"].startswith("https://")
    assert "cell" in found[0]["snippet"].lower()
    assert any("wikipedia.org" in row["url"] for row in found)


def test_find_reliable_passages_uses_programiz_before_wikipedia(monkeypatch) -> None:
    pages = {
        "brave": FakeResponse(
            text=_brave_result(
                "Python Functions - Programiz",
                "https://www.programiz.com/python-programming/function",
            )
            + _brave_result(
                "Function (computer science) - Wikipedia",
                "https://en.wikipedia.org/wiki/Function_(computer_science)",
            )
        ),
        "wiki_search": FakeResponse({"query": {"search": [{"title": "Function (computer science)"}]}}),
        "wiki_summary": FakeResponse(
            {
                "title": "Function (computer science)",
                "extract": "In computer programming, a function is a sequence of program instructions that performs a specific task.",
                "content_urls": {
                    "desktop": {"page": "https://en.wikipedia.org/wiki/Function_(computer_science)"}
                },
            }
        ),
    }

    class Client(FakeClient):
        def __init__(self, *args, **kwargs) -> None:
            super().__init__(pages)

    monkeypatch.setattr("app.services.web_knowledge.httpx.AsyncClient", Client)
    found = asyncio.run(find_reliable_passages("What is a function in python?"))
    assert "programiz.com" in found[0]["url"]
    if any("wikipedia.org" in row["url"] for row in found):
        assert "wikipedia.org" in found[-1]["url"]


def test_find_reliable_passages_maps_springboot_to_wikipedia(monkeypatch) -> None:
    pages = {
        "brave": FakeResponse(status_code=404),
        "wiki_spring": FakeResponse({"query": {"search": [{"title": "Spring Boot"}]}}),
        "wiki_summary": FakeResponse(
            {
                "title": "Spring Boot",
                "extract": "Spring Boot is an open-source Java framework used to create standalone production-grade Spring applications.",
                "content_urls": {"desktop": {"page": "https://en.wikipedia.org/wiki/Spring_Boot"}},
            }
        ),
    }

    class Client(FakeClient):
        def __init__(self, *args, **kwargs) -> None:
            super().__init__(pages)

    monkeypatch.setattr("app.services.web_knowledge.httpx.AsyncClient", Client)
    found = asyncio.run(find_reliable_passages("what is springboot"))
    assert found
    assert "Spring Boot" in found[0]["title"]
    assert "wikipedia.org" in found[0]["url"]


def test_find_reliable_passages_uses_gfg_json_without_wikipedia(monkeypatch) -> None:
    pages = {
        "gfg_posts": FakeResponse(
            payload=[
                {
                    "link": "https://www.geeksforgeeks.org/docker-tutorial/",
                    "title": {"rendered": "Docker Tutorial"},
                    "excerpt": {
                        "rendered": (
                            "Docker is a platform that packages an application and its dependencies "
                            "into a container so it can run the same way on any machine."
                        )
                    },
                }
            ]
        ),
        "wiki_search": FakeResponse({"query": {"search": [{"title": "Docker (software)"}]}}),
        "wiki_summary": FakeResponse(
            {
                "title": "Docker (software)",
                "extract": "Docker is a set of platform as a service products that use OS-level virtualization to deliver software in packages called containers.",
                "content_urls": {
                    "desktop": {"page": "https://en.wikipedia.org/wiki/Docker_(software)"}
                },
            }
        ),
    }

    class Client(FakeClient):
        def __init__(self, *args, **kwargs) -> None:
            super().__init__(pages)

    monkeypatch.setattr("app.services.web_knowledge.httpx.AsyncClient", Client)
    found = asyncio.run(find_reliable_passages("what is docker"))
    assert found
    assert "geeksforgeeks.org" in found[0]["url"]
    assert all("wikipedia.org" not in row["url"] for row in found)


def test_search_topic_keeps_docker_ps_flag() -> None:
    assert _search_topic(
        "docker ps -a used to check howmany container runing and what are they am i right"
    ) == "docker ps -a container"


def test_search_topic_keeps_ai_and_health() -> None:
    topic = _search_topic(
        "i wanna make new project AI human health something valuable things what should i do"
    )
    assert "health" in topic
    assert "wanna" not in topic
    assert "artificial intelligence" in topic or "ai" in topic


def test_google_js_wall_is_not_an_overview() -> None:
    html = (
        "<title>Google Search</title><noscript><style>div{display:none}</style>"
        '<meta content="0;url=/httpservice/retry/enablejs?sei=abc">'
    )
    assert _is_google_js_wall(html)
    assert _parse_google_overview(html, "ai health") == []


def test_parse_google_overview_reads_ai_overview_text() -> None:
    html = (
        "<div>AI Overview</div>"
        '<div class="BNeawe s3v9rd AP7Wnd">'
        "The docker ps -a command lists all containers, running and stopped, "
        "because the -a flag means all, not only running ones."
        "</div>"
    )
    found = _parse_google_overview(html, "docker ps -a")
    assert found
    assert "lists all containers" in found[0]["snippet"]
    assert "google.com/search" in found[0]["url"]
    assert found[0]["title"] == "Google AI Overview"


def test_find_reliable_passages_uses_google_overview_first(monkeypatch) -> None:
    pages = {
        "google": FakeResponse(
            text=(
                "<div>AI Overview</div>"
                '<div class="BNeawe s3v9rd AP7Wnd">'
                "The docker ps -a command lists all containers, running and stopped, "
                "because -a means all."
                "</div>"
            )
        ),
        "wiki_search": FakeResponse({"query": {"search": [{"title": "Docker (software)"}]}}),
        "wiki_summary": FakeResponse(
            {
                "title": "Docker (software)",
                "extract": "Docker is a set of platform as a service products that use OS-level virtualization to deliver software in packages called containers.",
                "content_urls": {
                    "desktop": {"page": "https://en.wikipedia.org/wiki/Docker_(software)"}
                },
            }
        ),
    }

    class Client(FakeClient):
        def __init__(self, *args, **kwargs) -> None:
            super().__init__(pages)

    monkeypatch.setattr("app.services.web_knowledge.httpx.AsyncClient", Client)
    found = asyncio.run(
        find_reliable_passages(
            "docker ps -a used to check howmany container runing and what are they am i right"
        )
    )
    assert found
    assert "google.com/search" in found[0]["url"]
    assert "lists all containers" in found[0]["snippet"]
    if any("wikipedia.org" in row["url"] for row in found):
        assert "wikipedia.org" in found[-1]["url"]


def test_springboot_matches_spring_boot_passage() -> None:
    assert _relevant(
        "what is springboot",
        "Spring Boot",
        "Spring Boot is an open-source Java-based framework used to create microservices.",
    )
