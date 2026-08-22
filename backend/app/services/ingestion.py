import asyncio
import io
import os
import re
import uuid
import zipfile
from xml.etree import ElementTree as ET

import httpx
import pymupdf
from sqlalchemy import delete

from app.database import SessionLocal
from app.models import Document, DocumentChunk, DocumentStatus
from app.services.ai import AIResponseError, ai_service
from app.services.embeddings import embed_texts
from app.utils import chunk_text

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

_ingesting: set[uuid.UUID] = set()
PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "text/plain",
    PPTX_MIME,
}
MIME_ALIASES = {
    "text/txt": "text/plain",
    "application/text": "text/plain",
    "application/pptx": PPTX_MIME,
}
SUFFIX_MIME = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".pptx": PPTX_MIME,
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}
A_NS = "{http://schemas.openxmlformats.org/drawingml/2006/main}"


def canonical_mime(mime_type: str, filename: str = "") -> str:
    raw = (mime_type or "").split(";")[0].strip().lower()
    raw = MIME_ALIASES.get(raw, raw)
    if raw in ALLOWED_MIME_TYPES:
        return raw
    name = (filename or "").lower()
    for suffix, mapped in SUFFIX_MIME.items():
        if name.endswith(suffix):
            return mapped
    return raw


class OcrUnavailable(RuntimeError):
    """Local Tesseract OCR is missing or failed."""


def _ocr_image(data: bytes) -> str:
    try:
        import pytesseract
        from PIL import Image
    except ImportError as exc:
        raise OcrUnavailable("Images require the 'ocr' backend extra and Tesseract") from exc
    try:
        return pytesseract.image_to_string(Image.open(io.BytesIO(data)))
    except pytesseract.TesseractNotFoundError as exc:
        raise OcrUnavailable("Tesseract is not installed on this machine") from exc


def _ocr_pdf_pages(document: pymupdf.Document) -> list[tuple[int | None, str]]:
    try:
        import pytesseract
    except ImportError as exc:
        raise OcrUnavailable("Scanned PDFs require the 'ocr' backend extra and Tesseract") from exc
    try:
        return [
            (index + 1, pytesseract.image_to_string(page.get_pixmap(dpi=200).pil_image()))
            for index, page in enumerate(document)
        ]
    except pytesseract.TesseractNotFoundError as exc:
        raise OcrUnavailable("Tesseract is not installed on this machine") from exc


def _extract_txt(data: bytes) -> list[tuple[int | None, str]]:
    text = ""
    for encoding in ("utf-8-sig", "utf-8", "utf-16", "latin-1"):
        try:
            text = data.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if not text:
        text = data.decode("utf-8", errors="replace")
    return [(1, text.strip())]


def _slide_number(name: str) -> int:
    match = re.search(r"slide(\d+)\.xml$", name)
    return int(match.group(1)) if match else 0


def _extract_pptx(data: bytes) -> list[tuple[int | None, str]]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as extra:
        raise ValueError("This PowerPoint file could not be read") from extra
    names = [
        name
        for name in archive.namelist()
        if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)
    ]
    names.sort(key=_slide_number)
    pages: list[tuple[int | None, str]] = []
    for index, name in enumerate(names, start=1):
        root = ET.fromstring(archive.read(name))
        parts = [
            node.text.strip()
            for node in root.iter(f"{A_NS}t")
            if node.text and node.text.strip()
        ]
        text = "\n".join(parts).strip()
        if text:
            pages.append((index, text))
    return pages


def extract_content(data: bytes, mime_type: str) -> list[tuple[int | None, str]]:
    mime = canonical_mime(mime_type)
    if mime == "application/pdf":
        document = pymupdf.open(stream=data, filetype="pdf")
        pages = [(index + 1, page.get_text("text").strip()) for index, page in enumerate(document)]
        if any(text for _, text in pages):
            return pages
        return _ocr_pdf_pages(document)
    if mime.startswith("image/"):
        return [(1, _ocr_image(data))]
    if mime == "text/plain":
        return _extract_txt(data)
    if mime == PPTX_MIME:
        return _extract_pptx(data)
    raise ValueError("Only PDF, PPTX, TXT, and image files are supported")


async def ingest_document(document_id: uuid.UUID) -> None:
    if document_id in _ingesting:
        return
    _ingesting.add(document_id)
    try:
        await _ingest_document(document_id)
    finally:
        _ingesting.discard(document_id)


async def _ingest_document(document_id: uuid.UUID) -> None:
    async with SessionLocal() as db:
        document = await db.get(Document, document_id)
        if not document:
            return
        document.status = DocumentStatus.PROCESSING
        document.error = None
        await db.commit()
        try:
            async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
                response = await client.get(document.file_url)
                response.raise_for_status()
            try:
                pages = await asyncio.to_thread(extract_content, response.content, document.mime_type)
            except OcrUnavailable:
                if not document.mime_type.startswith("image/"):
                    raise
                text = await ai_service.transcribe_image(response.content, document.mime_type)
                pages = [(1, text)]
            if document.mime_type.startswith("image/") and not any(text.strip() for _, text in pages):
                try:
                    text = await ai_service.transcribe_image(response.content, document.mime_type)
                    pages = [(1, text)]
                except AIResponseError:
                    raise ValueError("No readable text was found in this file") from None
            chunks_with_pages = [
                (page, chunk) for page, text in pages for chunk in chunk_text(text)
            ]
            if not chunks_with_pages:
                raise ValueError("No readable text was found in this file")
            vectors = await embed_texts([chunk for _, chunk in chunks_with_pages])
            await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
            db.add_all(
                [
                    DocumentChunk(
                        document_id=document.id,
                        position=index,
                        page_number=page,
                        content=content,
                        embedding=vectors[index],
                    )
                    for index, (page, content) in enumerate(chunks_with_pages)
                ]
            )
            document.status = DocumentStatus.READY
        except Exception as exc:
            document.status = DocumentStatus.FAILED
            document.error = str(exc)[:1000]
        await db.commit()
