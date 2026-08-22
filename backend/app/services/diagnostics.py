"""End-to-end checks for every external service the app depends on.

Used by the `/diagnostics` route and `scripts/e2e_check.py` so a broken
database, embeddings model, OCR install, or AI provider shows up as a clear
pass/fail instead of a stuck progress bar somewhere in the product.
"""

import asyncio
import socket
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any
from urllib.parse import urlsplit

from sqlalchemy import text

from app.config import settings
from app.database import SessionLocal
from app.services.ai import ai_service
from app.services.embeddings import embed_texts


async def _timed(fn: Callable[[], Awaitable[str]]) -> dict[str, Any]:
    started = time.monotonic()
    try:
        detail = await fn()
        ok = True
        payload: dict[str, Any] = {"detail": detail}
    except Exception as exc:  # noqa: BLE001 - any failure is a diagnostic result, not a crash
        ok = False
        payload = {"error": str(exc)[:500]}
    payload["ok"] = ok
    payload["duration_ms"] = round((time.monotonic() - started) * 1000, 1)
    return payload


async def check_database() -> dict[str, Any]:
    async def run() -> str:
        async with SessionLocal() as db:
            await db.execute(text("SELECT 1"))
        return f"connected ({settings.database_url.split('@')[-1].split('?')[0]})"

    return await _timed(run)


async def check_embeddings() -> dict[str, Any]:
    async def run() -> str:
        vectors = await embed_texts([f"diagnostics-ping-{uuid.uuid4()}"])
        dims = len(vectors[0]) if vectors else 0
        if dims != settings.embedding_dimensions:
            raise RuntimeError(
                f"expected {settings.embedding_dimensions}-dim vector, got {dims}"
            )
        return f"{dims}-dim vector from {settings.embedding_model}"

    return await _timed(run)


async def check_ocr() -> dict[str, Any]:
    async def run() -> str:
        try:
            import pytesseract
        except ImportError as exc:
            raise RuntimeError("pytesseract is not installed (backend 'ocr' extra)") from exc
        version = await asyncio.to_thread(pytesseract.get_tesseract_version)
        return f"tesseract {version}"

    return await _timed(run)


async def check_ai_network() -> dict[str, Any]:
    """Raw DNS + TCP check to the AI host, independent of the OpenAI SDK.

    Pinpoints whether a failure is DNS resolution, a blocked/refused TCP
    connection, or something above the transport layer (auth, TLS, HTTP).
    """

    async def run() -> str:
        parsed = urlsplit(settings.ai_base_url)
        host = parsed.hostname or ""
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        if not host:
            raise RuntimeError(f"AI_BASE_URL has no hostname: {settings.ai_base_url!r}")
        loop = asyncio.get_running_loop()
        infos = await asyncio.wait_for(loop.getaddrinfo(host, port), timeout=10)
        address = infos[0][4][0] if infos else "?"
        _reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=10)
        writer.close()
        await writer.wait_closed()
        return f"DNS {host} -> {address}; TCP connect to {host}:{port} ok"

    return await _timed(run)


async def check_ai_service() -> dict[str, Any]:
    async def run() -> str:
        reply = await ai_service.ping()
        return f"model={settings.ai_model} base_url={settings.ai_base_url} reply={reply!r}"

    return await _timed(run)


async def run_diagnostics(*, include_ai: bool = True, include_ocr: bool = True) -> dict[str, Any]:
    services: dict[str, Any] = {
        "database": await check_database(),
        "embeddings": await check_embeddings(),
    }
    if include_ocr:
        services["ocr"] = await check_ocr()
    if include_ai:
        services["ai_network"] = await check_ai_network()
        services["ai_service"] = await check_ai_service()
    return {"ok": all(service["ok"] for service in services.values()), "services": services}
