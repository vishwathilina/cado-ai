import asyncio
import io
import uuid

import httpx
import pymupdf

from app.database import SessionLocal
from app.models import Document, DocumentChunk, DocumentStatus
from app.services.embeddings import embed_texts
from app.utils import chunk_text


def extract_content(data: bytes, mime_type: str) -> list[tuple[int | None, str]]:
    if mime_type == "application/pdf":
        document = pymupdf.open(stream=data, filetype="pdf")
        pages = [(index + 1, page.get_text("text").strip()) for index, page in enumerate(document)]
        if any(text for _, text in pages):
            return pages
        try:
            import pytesseract
        except ImportError as exc:
            raise RuntimeError("Scanned PDFs require the 'ocr' backend extra and Tesseract") from exc
        return [
            (index + 1, pytesseract.image_to_string(page.get_pixmap(dpi=200).pil_image()))
            for index, page in enumerate(document)
        ]
    if mime_type.startswith("image/"):
        try:
            import pytesseract
            from PIL import Image
        except ImportError as exc:
            raise RuntimeError("Images require the 'ocr' backend extra and Tesseract") from exc
        return [(1, pytesseract.image_to_string(Image.open(io.BytesIO(data))))]
    raise ValueError("Only PDF and image files are supported")


async def ingest_document(document_id: uuid.UUID) -> None:
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
            pages = await asyncio.to_thread(extract_content, response.content, document.mime_type)
            chunks_with_pages = [
                (page, chunk) for page, text in pages for chunk in chunk_text(text)
            ]
            if not chunks_with_pages:
                raise ValueError("No readable text was found in this file")
            vectors = await embed_texts([chunk for _, chunk in chunks_with_pages])
            document.chunks = [
                DocumentChunk(
                    position=index,
                    page_number=page,
                    content=content,
                    embedding=vectors[index],
                )
                for index, (page, content) in enumerate(chunks_with_pages)
            ]
            document.status = DocumentStatus.READY
        except Exception as exc:
            document.status = DocumentStatus.FAILED
            document.error = str(exc)[:1000]
        await db.commit()
