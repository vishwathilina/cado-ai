import uuid
from urllib.parse import urlparse

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.database import get_db
from app.models import Document, DocumentStatus, User
from app.schemas import DocumentView, UploadComplete
from app.services.ingestion import ALLOWED_MIME_TYPES, canonical_mime, ingest_document

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentView])
async def list_documents(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> list[Document]:
    result = await db.scalars(
        select(Document).where(Document.user_id == user.id).order_by(Document.created_at.desc())
    )
    return list(result)


@router.post("/upload-complete", response_model=DocumentView, status_code=status.HTTP_201_CREATED)
async def upload_complete(
    payload: UploadComplete,
    background: BackgroundTasks,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Document:
    mime_type = canonical_mime(payload.mime_type, payload.title)
    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Unsupported file type")
    parsed = urlparse(payload.file_url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid upload URL")
    existing = await db.scalar(select(Document).where(Document.file_key == payload.file_key))
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Upload already registered")
    fields = payload.model_dump()
    fields["mime_type"] = mime_type
    document = Document(user_id=user.id, **fields)
    db.add(document)
    await db.commit()
    await db.refresh(document)
    background.add_task(ingest_document, document.id)
    return document


@router.get("/{document_id}", response_model=DocumentView)
async def get_document(
    document_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Document:
    document = await db.scalar(
        select(Document).where(Document.id == document_id, Document.user_id == user.id)
    )
    if not document:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return document


@router.post("/{document_id}/retry", response_model=DocumentView)
async def retry_document(
    document_id: uuid.UUID,
    background: BackgroundTasks,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Document:
    document = await db.scalar(
        select(Document).where(Document.id == document_id, Document.user_id == user.id)
    )
    if not document:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    if document.status == DocumentStatus.READY:
        return document
    background.add_task(ingest_document, document.id)
    return document
