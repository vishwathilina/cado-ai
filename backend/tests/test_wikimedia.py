import asyncio

from app.services.wikimedia import find_education_image


def test_find_education_image_picks_labeled_diagram(monkeypatch) -> None:
    class FakeResponse:
        def __init__(self, payload: dict, status_code: int = 200) -> None:
            self._payload = payload
            self.status_code = status_code

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return self._payload

    commons = {
        "query": {
            "pages": {
                "1": {
                    "title": "File:Company logo.png",
                    "imageinfo": [
                        {
                            "mime": "image/png",
                            "thumburl": "https://upload.wikimedia.org/logo.png",
                            "extmetadata": {"ObjectName": {"value": "Logo"}},
                        }
                    ],
                },
                "2": {
                    "title": "File:Mitochondrion diagram.svg",
                    "imageinfo": [
                        {
                            "mime": "image/svg+xml",
                            "thumburl": "https://upload.wikimedia.org/wikipedia/commons/thumb/mito.png",
                            "extmetadata": {
                                "ObjectName": {"value": "Mitochondrion diagram"},
                                "Artist": {"value": "<b>Jane Doe</b>"},
                                "LicenseShortName": {"value": "CC BY-SA 4.0"},
                            },
                        }
                    ],
                },
            }
        }
    }

    class FakeClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url: str, params=None, **_kwargs):
            if "commons.wikimedia.org" in url:
                return FakeResponse(commons)
            return FakeResponse({"title": "Mitochondrion"}, status_code=404)

    monkeypatch.setattr("app.services.wikimedia.httpx.AsyncClient", FakeClient)
    found = asyncio.run(find_education_image("mitochondrion diagram"))
    assert found["url"].endswith("mito.png")
    assert found["caption"] == "Mitochondrion diagram"
    assert "Jane Doe" in found["credit"]
    assert "CC BY-SA 4.0" in found["credit"]


def test_find_education_image_falls_back_to_wikipedia(monkeypatch) -> None:
    class FakeResponse:
        def __init__(self, payload: dict, status_code: int = 200) -> None:
            self._payload = payload
            self.status_code = status_code

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return self._payload

    class FakeClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url: str, params=None, **_kwargs):
            if "commons.wikimedia.org" in url:
                return FakeResponse({"query": {"pages": {}}})
            return FakeResponse(
                {
                    "title": "Database normalization",
                    "originalimage": {"source": "https://upload.wikimedia.org/wikipedia/commons/norm.png"},
                }
            )

    monkeypatch.setattr("app.services.wikimedia.httpx.AsyncClient", FakeClient)
    found = asyncio.run(find_education_image("database normalization"))
    assert found["caption"] == "Database normalization"
    assert found["credit"].startswith("Wikipedia")
    assert found["url"].endswith("norm.png")


def test_find_education_image_cs_uses_wikipedia_article_diagram(monkeypatch) -> None:
    class FakeResponse:
        def __init__(self, payload: dict, status_code: int = 200) -> None:
            self._payload = payload
            self.status_code = status_code

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return self._payload

    class FakeClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url: str, params=None, **_kwargs):
            if "commons.wikimedia.org" in url:
                return FakeResponse({"query": {"pages": {}}})
            if "w/api.php" in url and params and params.get("list") == "search":
                return FakeResponse({"query": {"search": [{"title": "Database normalization"}]}})
            if "media-list" in url:
                return FakeResponse(
                    {
                        "items": [
                            {
                                "title": "File:Company logo.png",
                                "type": "image",
                                "caption": {"text": "Site logo"},
                                "srcset": [{"src": "//upload.wikimedia.org/logo.png"}],
                            },
                            {
                                "title": "File:Insertion_anomaly.svg",
                                "type": "image",
                                "caption": {"text": "An insertion anomaly in an unnormalized table"},
                                "srcset": [
                                    {
                                        "src": "//upload.wikimedia.org/wikipedia/commons/thumb/anomaly.png"
                                    }
                                ],
                            },
                        ]
                    }
                )
            return FakeResponse({}, status_code=404)

    monkeypatch.setattr("app.services.wikimedia.httpx.AsyncClient", FakeClient)
    found = asyncio.run(find_education_image("normalization diagram", domain="cs"))
    assert found["url"].endswith("anomaly.png")
    assert "insertion anomaly" in found["caption"].lower()
    assert found["credit"].startswith("Wikipedia")


def test_find_education_image_cs_hotlinks_geeksforgeeks(monkeypatch) -> None:
    class FakeResponse:
        def __init__(self, payload: dict, status_code: int = 200, text: str = "") -> None:
            self._payload = payload
            self.status_code = status_code
            self.text = text

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return self._payload

    class FakeClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url: str, params=None, **_kwargs):
            if "i.js" in url:
                return FakeResponse(
                    {
                        "results": [
                            {
                                "title": "Site logo",
                                "image": "https://media.geeksforgeeks.org/wp-content/cdn-uploads/gfg_200x200-min.png",
                                "url": "https://www.geeksforgeeks.org/",
                                "width": 200,
                                "height": 200,
                                "encoding_format": "png",
                            },
                            {
                                "title": "Normalization Process in DBMS | GeeksforGeeks",
                                "image": "https://media.geeksforgeeks.org/wp-content/uploads/normalization.jpg",
                                "url": "https://www.geeksforgeeks.org/dbms/normalization-process-in-dbms/",
                                "width": 736,
                                "height": 540,
                                "encoding_format": "jpeg",
                            },
                        ]
                    }
                )
            if "duckduckgo.com" in url:
                return FakeResponse({}, text="vqd=4-123456789")
            return FakeResponse({}, status_code=404)

    monkeypatch.setattr("app.services.wikimedia.httpx.AsyncClient", FakeClient)
    found = asyncio.run(find_education_image("normalization diagram"))
    assert found["url"].endswith("normalization.jpg")
    assert found["credit"] == "GeeksforGeeks"
    assert "Normalization" in found["caption"]


def test_find_education_image_prefers_other_websites_over_wikipedia(monkeypatch) -> None:
    class FakeResponse:
        def __init__(self, payload: dict, status_code: int = 200, text: str = "") -> None:
            self._payload = payload
            self.status_code = status_code
            self.text = text

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return self._payload

    class FakeClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url: str, params=None, **_kwargs):
            if "i.js" in url:
                return FakeResponse(
                    {
                        "results": [
                            {
                                "title": "Mitochondrion - Wikipedia",
                                "image": "https://upload.wikimedia.org/wikipedia/commons/wiki-mito.png",
                                "url": "https://en.wikipedia.org/wiki/Mitochondrion",
                                "width": 800,
                                "height": 500,
                                "encoding_format": "png",
                            },
                            {
                                "title": "Mitochondria structure labeled - BYJU'S",
                                "image": "https://cdn1.byjus.com/wp-content/uploads/mito.png",
                                "url": "https://byjus.com/biology/mitochondria/",
                                "width": 720,
                                "height": 480,
                                "encoding_format": "png",
                            },
                        ]
                    }
                )
            if "duckduckgo.com" in url:
                return FakeResponse({}, text="vqd=4-123456789")
            return FakeResponse(
                {
                    "title": "Mitochondrion",
                    "originalimage": {"source": "https://upload.wikimedia.org/wikipedia/commons/wiki-mito.png"},
                }
            )

    monkeypatch.setattr("app.services.wikimedia.httpx.AsyncClient", FakeClient)
    found = asyncio.run(find_education_image("mitochondrion diagram"))
    assert found["url"].endswith("mito.png")
    assert found["credit"] == "byjus.com"
    assert "Wikipedia" not in found["credit"]

