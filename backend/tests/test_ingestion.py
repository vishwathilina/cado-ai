import pymupdf

from app.config import normalize_database_url
from app.services.ingestion import extract_content


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


def test_rejects_unsupported_mime_type() -> None:
    try:
        extract_content(b"not-a-file", "text/plain")
    except ValueError as exc:
        assert "PDF and image" in str(exc)
    else:
        raise AssertionError("Expected ValueError")
