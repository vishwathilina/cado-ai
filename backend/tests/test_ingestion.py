import asyncio
import uuid

import pymupdf
from sqlalchemy import func, select

from app.config import normalize_database_url, settings
from app.database import SessionLocal
from app.models import Document, DocumentChunk, DocumentStatus, User
from app.services.ingestion import OcrUnavailable, extract_content, ingest_document
from tests.conftest import register


def test_normalize_database_url_adds_asyncpg_and_drops_channel_binding() -> None:
    url = normalize_database_url(
        "postgresql://user:pass@host/neondb?sslmode=require&channel_binding=require"
    )
    assert url.startswith("postgresql+asyncpg://")
    assert "channel_binding" not in url
    assert "ssl=require" in url
    assert "sslmode" not in url
    assert normalize_database_url("sqlite+aiosqlite:///:memory:").startswith("sqlite+aiosqlite:///")


def test_extracts_text_from_generated_pdf() -> None:
    document = pymupdf.open()
    page = document.new_page()
    page.insert_text((72, 72), "Chloroplasts capture sunlight for photosynthesis.")
    data = document.tobytes()
    pages = extract_content(data, "application/pdf")
    assert pages
    assert "photosynthesis" in pages[0][1].lower()


def test_extracts_text_from_txt_notes() -> None:
    pages = extract_content("Mitochondria produce ATP.\n".encode("utf-8"), "text/plain")
    assert pages[0][0] == 1
    assert "ATP" in pages[0][1]


def test_extracts_text_from_pptx_slides() -> None:
    import io
    import zipfile

    slide = """<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Osmosis moves water across a membrane.</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>"""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("ppt/slides/slide1.xml", slide)
    pages = extract_content(
        buffer.getvalue(),
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )
    assert pages[0][0] == 1
    assert "Osmosis" in pages[0][1]


def test_rejects_unsupported_mime_type() -> None:
    try:
        extract_content(b"not-a-file", "application/zip")
    except ValueError as exc:
        assert "PDF, PPTX, TXT" in str(exc)
    else:
        raise AssertionError("Expected ValueError")


def test_ingest_document_persists_chunks_without_lazy_io(client, monkeypatch) -> None:
    register(client)
    pdf = pymupdf.open()
    pdf.new_page().insert_text((72, 72), "Mitochondria produce ATP.")
    payload = pdf.tobytes()

    class FakeResponse:
        content = payload

        def raise_for_status(self) -> None:
            return None

    class FakeClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, _url: str):
            return FakeResponse()

    async def fake_embed(texts: list[str]) -> list[list[float]]:
        return [[0.01] * settings.embedding_dimensions for _ in texts]

    monkeypatch.setattr("app.services.ingestion.httpx.AsyncClient", FakeClient)
    monkeypatch.setattr("app.services.ingestion.embed_texts", fake_embed)

    async def run() -> tuple[str, int]:
        async with SessionLocal() as db:
            user = await db.scalar(select(User).where(User.email == "ada@example.com"))
            document = Document(
                user_id=user.id,
                title="Notes",
                file_url="https://files.example/notes.pdf",
                file_key=f"notes-{uuid.uuid4()}",
                mime_type="application/pdf",
            )
            db.add(document)
            await db.commit()
            document_id = document.id
        await ingest_document(document_id)
        async with SessionLocal() as db:
            saved = await db.get(Document, document_id)
            count = await db.scalar(
                select(func.count()).select_from(DocumentChunk).where(
                    DocumentChunk.document_id == document_id
                )
            )
            return saved.status.value, count or 0

    status, chunk_count = asyncio.run(run())
    assert status == DocumentStatus.READY.value
    assert chunk_count >= 1


def test_ingest_image_uses_vision_when_ocr_missing(client, monkeypatch) -> None:
    register(client)

    class FakeResponse:
        content = b"fake-image-bytes"

        def raise_for_status(self) -> None:
            return None

    class FakeClient:
        def __init__(self, *args, **kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, _url: str):
            return FakeResponse()

    async def fake_embed(texts: list[str]) -> list[list[float]]:
        return [[0.01] * settings.embedding_dimensions for _ in texts]

    async def fake_transcribe(_data: bytes, _mime: str) -> str:
        return "Chloroplasts capture sunlight for photosynthesis."

    def fail_ocr(_data: bytes, _mime: str):
        raise OcrUnavailable("no tesseract")

    monkeypatch.setattr("app.services.ingestion.httpx.AsyncClient", FakeClient)
    monkeypatch.setattr("app.services.ingestion.embed_texts", fake_embed)
    monkeypatch.setattr("app.services.ingestion.extract_content", fail_ocr)
    monkeypatch.setattr("app.services.ingestion.ai_service.transcribe_image", fake_transcribe)

    async def run() -> str:
        async with SessionLocal() as db:
            user = await db.scalar(select(User).where(User.email == "ada@example.com"))
            document = Document(
                user_id=user.id,
                title="Photo notes",
                file_url="https://files.example/notes.jpg",
                file_key=f"notes-{uuid.uuid4()}",
                mime_type="image/jpeg",
            )
            db.add(document)
            await db.commit()
            document_id = document.id
        await ingest_document(document_id)
        async with SessionLocal() as db:
            saved = await db.get(Document, document_id)
            return saved.status.value

    assert asyncio.run(run()) == DocumentStatus.READY.value
