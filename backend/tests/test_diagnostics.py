from app.config import settings
from tests.conftest import register


def test_diagnostics_requires_login(client) -> None:
    response = client.get("/diagnostics")
    assert response.status_code == 401


def test_diagnostics_reports_each_service(client, monkeypatch) -> None:
    register(client)

    async def fake_embed(texts: list[str]) -> list[list[float]]:
        return [[0.01] * settings.embedding_dimensions for _ in texts]

    async def fake_ping() -> str:
        return "OK"

    async def fake_network_check() -> dict:
        return {"ok": True, "detail": "DNS ok; TCP connect ok", "duration_ms": 1.0}

    monkeypatch.setattr("app.services.diagnostics.embed_texts", fake_embed)
    monkeypatch.setattr("app.services.diagnostics.ai_service.ping", fake_ping)
    monkeypatch.setattr("app.services.diagnostics.check_ai_network", fake_network_check)

    response = client.get("/diagnostics")
    assert response.status_code == 200
    body = response.json()
    # OCR depends on Tesseract being installed on the host, which varies by
    # environment (present in Docker/HF, not necessarily in every dev shell).
    assert set(body["services"]) == {"database", "embeddings", "ocr", "ai_network", "ai_service"}
    assert body["services"]["database"]["ok"] is True
    assert body["services"]["embeddings"]["ok"] is True
    assert body["services"]["ai_service"]["ok"] is True
    assert body["ok"] == all(service["ok"] for service in body["services"].values())


def test_diagnostics_surfaces_a_failing_service(client, monkeypatch) -> None:
    register(client)

    async def broken_ping() -> str:
        raise RuntimeError("AI_API_KEY is not configured")

    async def fake_network_check() -> dict:
        return {"ok": True, "detail": "DNS ok; TCP connect ok", "duration_ms": 1.0}

    monkeypatch.setattr("app.services.diagnostics.ai_service.ping", broken_ping)
    monkeypatch.setattr("app.services.diagnostics.check_ai_network", fake_network_check)

    response = client.get("/diagnostics")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert body["services"]["ai_service"]["ok"] is False
    assert "AI_API_KEY" in body["services"]["ai_service"]["error"]
