import asyncio

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import Document, DocumentStatus, User
from tests.conftest import csrf_headers, register


def test_register_login_me_and_logout(client) -> None:
    register(client)
    me = client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "ada@example.com"

    logout = client.post("/auth/logout", headers=csrf_headers(client))
    assert logout.status_code == 204
    assert client.get("/auth/me").status_code == 401

    login = client.post(
        "/auth/login",
        json={"email": "ada@example.com", "password": "password123"},
    )
    assert login.status_code == 200
    assert client.get("/auth/me").status_code == 200


def test_refresh_rotates_token_and_rejects_reuse(client) -> None:
    register(client)
    first_refresh = client.cookies.get("refresh_token")
    rotated = client.post("/auth/refresh", headers=csrf_headers(client))
    assert rotated.status_code == 200
    assert client.cookies.get("refresh_token") != first_refresh

    client.cookies.set("refresh_token", first_refresh)
    reused = client.post("/auth/refresh", headers=csrf_headers(client))
    assert reused.status_code == 401


def test_csrf_is_required_for_mutations(client) -> None:
    register(client)
    response = client.post("/auth/logout")
    assert response.status_code == 403
    assert response.json()["detail"] == "CSRF check failed"


def test_documents_are_isolated_by_owner(client) -> None:
    register(client, email="owner@example.com")

    async def seed() -> str:
        async with SessionLocal() as db:
            owner = await db.scalar(select(User).where(User.email == "owner@example.com"))
            document = Document(
                user_id=owner.id,
                title="Owner notes",
                file_url="https://files.example/notes.pdf",
                file_key="owner-key",
                mime_type="application/pdf",
                status=DocumentStatus.READY,
            )
            db.add(document)
            await db.commit()
            return str(document.id)

    document_id = asyncio.run(seed())
    assert client.get(f"/documents/{document_id}").status_code == 200
    retry = client.post(f"/documents/{document_id}/retry", headers=csrf_headers(client))
    assert retry.status_code == 200
    assert retry.json()["status"] == "ready"

    with TestClient(app) as outsider:
        register(outsider, email="other@example.com")
        assert outsider.get(f"/documents/{document_id}").status_code == 404
