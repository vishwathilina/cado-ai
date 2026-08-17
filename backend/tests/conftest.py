import os

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["JWT_SECRET"] = "test-secret-key-that-is-long-enough-32"
os.environ["FRONTEND_URL"] = "http://testserver"
os.environ["AI_API_KEY"] = "test-key"
os.environ["AI_MODEL"] = "test-model"
os.environ["COOKIE_SECURE"] = "false"
os.environ["ENVIRONMENT"] = "test"

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


@pytest.fixture(autouse=True)
def reset_database() -> None:
    async def reset() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
            await connection.run_sync(Base.metadata.create_all)

    asyncio.run(reset())


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def register(
    client: TestClient,
    email: str = "ada@example.com",
    name: str = "Ada",
    password: str = "password123",
) -> TestClient:
    response = client.post(
        "/auth/register",
        json={"email": email, "name": name, "password": password},
    )
    assert response.status_code == 201, response.text
    return client


def csrf_headers(client: TestClient) -> dict[str, str]:
    token = client.cookies.get("csrf_token") or ""
    return {"X-CSRF-Token": token, "Origin": "http://testserver"}
