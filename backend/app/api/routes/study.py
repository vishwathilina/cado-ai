import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import current_user
from app.database import engine, get_db
from app.models import (
    ContentType,
    Document,
    DocumentChunk,
    DocumentStatus,
    StudyItem,
    StudySet,
    User,
)
from app.schemas import GenerationRequest, StudyItemView, StudySetView
from app.services.ai import ai_service
from app.services.embeddings import embed_texts

router = APIRouter(prefix="/study-sets", tags=["study"])


def public_item(item: StudyItem) -> StudyItemView:
    hidden = item.kind == ContentType.MCQ
    return StudyItemView(
        id=item.id,
        kind=item.kind,
        position=item.position,
        prompt=item.prompt,
        answer="" if hidden else item.answer,
        options=item.options,
        explanation=None if hidden else item.explanation,
    )


def public_set(study_set: StudySet) -> StudySetView:
    return StudySetView(
        id=study_set.id,
        title=study_set.title,
        language=study_set.language,
        created_at=study_set.created_at,
        items=[public_item(item) for item in study_set.items],
    )


@router.post("/generate", response_model=StudySetView, status_code=status.HTTP_201_CREATED)
async def generate_study_set(
    payload: GenerationRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> StudySetView:
    document = await db.scalar(
        select(Document).where(Document.id == payload.document_id, Document.user_id == user.id)
    )
    if not document:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    if document.status != DocumentStatus.READY:
        raise HTTPException(status.HTTP_409_CONFLICT, "Document is not ready")
    query_vector = (await embed_texts([payload.title or document.title]))[0]
    ranking = (
        DocumentChunk.embedding.cosine_distance(query_vector)
        if engine.dialect.name == "postgresql"
        else DocumentChunk.position
    )
    chunks = list(
        await db.scalars(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document.id)
            .order_by(ranking)
            .limit(30)
        )
    )
    generated = await ai_service.generate_study_set(
        "\n\n".join(f"[Source {chunk.position}] {chunk.content}" for chunk in chunks),
        payload.language,
        payload.explanation_count,
        payload.mcq_count,
        payload.flashcard_count,
        payload.option_count,
    )
    expected = {
        ContentType.EXPLANATION: payload.explanation_count,
        ContentType.MCQ: payload.mcq_count,
        ContentType.FLASHCARD: payload.flashcard_count,
    }
    for kind, count in expected.items():
        if sum(item.kind == kind for item in generated.items) != count:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "AI returned the wrong item count")
    for item in generated.items:
        if item.kind == ContentType.MCQ and (
            not item.options
            or len(item.options) != payload.option_count
            or item.answer not in item.options
        ):
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "AI returned an invalid MCQ")
    study_set = StudySet(
        user_id=user.id,
        document_id=document.id,
        title=payload.title or generated.title,
        language=payload.language,
        items=[
            StudyItem(
                kind=item.kind,
                position=index,
                prompt=item.prompt,
                answer=item.answer,
                options=item.options,
                explanation=item.explanation,
                source_chunk_ids=[str(chunk.id) for chunk in chunks],
            )
            for index, item in enumerate(generated.items)
        ],
    )
    db.add(study_set)
    await db.commit()
    loaded = await db.scalar(
        select(StudySet)
        .options(selectinload(StudySet.items))
        .where(StudySet.id == study_set.id)
    )
    if not loaded:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not persist study set")
    return public_set(loaded)


@router.get("", response_model=list[StudySetView])
async def list_study_sets(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> list[StudySetView]:
    result = await db.scalars(
        select(StudySet)
        .options(selectinload(StudySet.items))
        .where(StudySet.user_id == user.id)
        .order_by(StudySet.created_at.desc())
    )
    return [public_set(item) for item in result.unique()]


@router.get("/{study_set_id}", response_model=StudySetView)
async def get_study_set(
    study_set_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> StudySetView:
    study_set = await db.scalar(
        select(StudySet)
        .options(selectinload(StudySet.items))
        .where(StudySet.id == study_set_id, StudySet.user_id == user.id)
    )
    if not study_set:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Study set not found")
    return public_set(study_set)
