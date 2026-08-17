from fastapi.testclient import TestClient

from app.main import app


def test_health_and_security_headers() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"


def test_cross_origin_mutation_is_rejected() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/auth/logout",
            headers={"Origin": "https://attacker.example"},
        )
    assert response.status_code == 403
