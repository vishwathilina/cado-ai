import re
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
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
from app.schemas import (
    GenerationRequest,
    QuizPaperView,
    QuizQuestionView,
    StudyItemView,
    StudySetView,
    TutorCitation,
    TutorDraft,
    TutorImage,
    TutorReply,
    TutorRequest,
)
from app.services.ai import AIResponseError, ai_service
from app.services.embeddings import embed_texts
from app.services.topics import detect_topic_domain
from app.services.web_knowledge import find_reliable_passages
from app.services.wikimedia import find_education_image


def _snippet(text: str, limit: int = 280) -> str:
    return " ".join((text or "").split())[:limit]


def wants_visual(question: str) -> bool:
    text = (question or "").lower()
    return bool(
        re.search(
            r"\b(diagram|picture|image|illustration|visual|draw|photo)\b|show me",
            text,
        )
    )


_COVER_STOP = {
    "what",
    "why",
    "how",
    "does",
    "do",
    "the",
    "a",
    "an",
    "is",
    "are",
    "in",
    "of",
    "to",
    "for",
    "and",
    "or",
    "explain",
    "define",
    "tell",
    "me",
    "about",
    "please",
    "with",
    "from",
    "this",
    "that",
    "simple",
    "simply",
    "more",
    "show",
    "diagram",
    "picture",
    "image",
    "illustration",
    "visual",
    "draw",
    "photo",
}


def notes_cover_question(question: str, chunks: list[DocumentChunk]) -> bool:
    if not chunks:
        return False
    words = [
        word
        for word in re.findall(r"[a-z0-9]+", (question or "").lower())
        if len(word) > 2 and word not in _COVER_STOP
    ]
    if not words:
        return True
    hay = " ".join((chunk.content or "").lower() for chunk in chunks)
    hits = 0
    for word in words:
        if re.search(rf"\b{re.escape(word)}\b", hay):
            hits += 1
            continue
        compact = re.sub(r"[^a-z0-9]+", "", hay)
        if len(word) > 5 and word in compact:
            hits += 1
    return hits >= max(1, (len(words) + 1) // 2)


def note_citations(numbers: list[int], chunks: list[DocumentChunk]) -> list[TutorCitation]:
    picks = numbers or list(range(1, min(3, len(chunks)) + 1))
    found: list[TutorCitation] = []
    for number in picks:
        if number < 1 or number > len(chunks):
            continue
        chunk = chunks[number - 1]
        quote = _snippet(chunk.content, 220)
        found.append(
            TutorCitation(
                n=number,
                kind="notes",
                title=f"Page {chunk.page_number}" if chunk.page_number else "Your notes",
                snippet=_snippet(chunk.content),
                quote=quote,
                page=chunk.page_number,
            )
        )
    return found


def web_citations(numbers: list[int], passages: list[dict]) -> list[TutorCitation]:
    from app.services.web_knowledge import _site_label

    found: list[TutorCitation] = []
    for index, row in enumerate(passages, start=1):
        url = str(row.get("url") or "") or None
        page_title = str(row.get("title") or "Web")[:120]
        label = _site_label(url or "")
        title = page_title if page_title.startswith(label) else f"{label}: {page_title}"
        found.append(
            TutorCitation(
                n=index,
                kind="web",
                title=title[:120],
                snippet=_snippet(str(row.get("snippet") or "")),
                quote=_snippet(str(row.get("snippet") or ""), 220),
                url=url,
            )
        )
    found.sort(
        key=lambda item: (
            "wikipedia.org" in (item.url or ""),
            "google." not in (item.url or ""),
            item.n,
        )
    )
    return found[:6]


async def _answer_from_web(
    question: str,
    source_bits: list[str],
    focus_parts: list[str],
    domain: str,
    passages: list[dict],
) -> TutorDraft:
    web_bits = [
        f"[Source {index}] {row['title']}: {row['snippet']}"
        for index, row in enumerate(passages, start=1)
    ]
    answered = await ai_service.tutor_reply(
        question,
        "\n\n".join(source_bits),
        "\n".join(focus_parts),
        domain,
        "\n\n".join(web_bits)
        if web_bits
        else "(none — notes missed this. Answer from general tutoring knowledge. Keep it practical.)",
    )
    answered.origin = "web"
    if not web_bits:
        answered.sources = []
    return answered


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
        full_explanation=None if hidden else item.full_explanation,
    )


def public_set(study_set: StudySet) -> StudySetView:
    items = list(study_set.items)
    return StudySetView(
        id=study_set.id,
        title=study_set.title,
        language=study_set.language,
        created_at=study_set.created_at,
        items=[public_item(item) for item in items],
        explanation_count=sum(1 for item in items if item.kind == ContentType.EXPLANATION),
        flashcard_count=sum(1 for item in items if item.kind == ContentType.FLASHCARD),
        mcq_count=sum(1 for item in items if item.kind == ContentType.MCQ),
    )


router = APIRouter(prefix="/study-sets", tags=["study"])


_WHOLE_FOCUS = {"", "whole", "all", "whole notes", "the whole notes", "entire notes", "everything"}


def _focus_query(focus: str | None, fallback: str) -> tuple[str, bool]:
    text = (focus or "").strip()
    if not text or text.lower() in _WHOLE_FOCUS:
        return fallback, True
    return text, False


async def _source_chunks(
    db: AsyncSession,
    document_id: uuid.UUID,
    query_text: str,
    whole: bool,
    budget: int,
) -> list[DocumentChunk]:
    query_vector = (await embed_texts([query_text]))[0]
    ranking = (
        DocumentChunk.embedding.cosine_distance(query_vector)
        if engine.dialect.name == "postgresql"
        else DocumentChunk.position
    )
    sequential = list(
        await db.scalars(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document_id)
            .order_by(DocumentChunk.position)
            .limit(10 if whole else 4)
        )
    )
    semantic = list(
        await db.scalars(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == document_id)
            .order_by(ranking)
            .limit(max(budget, 18))
        )
    )
    chunks: list[DocumentChunk] = []
    seen: set[uuid.UUID] = set()
    ordered = sequential + semantic if whole else semantic + sequential
    for chunk in ordered:
        if chunk.id in seen:
            continue
        seen.add(chunk.id)
        chunks.append(chunk)
    chunks.sort(key=lambda item: item.position)
    if len(chunks) > budget:
        step = len(chunks) / budget
        chunks = [chunks[min(len(chunks) - 1, int(index * step))] for index in range(budget)]
    return chunks


def _rotate_chunks(chunks: list[DocumentChunk], batch_index: int, window: int) -> list[DocumentChunk]:
    if len(chunks) <= window:
        return chunks
    start = (batch_index * max(1, window // 2)) % len(chunks)
    return [chunks[(start + index) % len(chunks)] for index in range(window)]


def _source_text(chunks: list[DocumentChunk]) -> str:
    return "\n\n".join(f"[Source {chunk.position}] {chunk.content}" for chunk in chunks)


def _of_kind(items: list, kind: ContentType, limit: int) -> list:
    if limit <= 0:
        return []
    picked = []
    seen: set[str] = set()
    for item in items:
        if item.kind != kind:
            continue
        key = item.prompt.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        picked.append(item)
        if len(picked) >= limit:
            break
    return picked


def _need(items: list, kind: ContentType, wanted: int) -> None:
    if wanted > 0 and not any(item.kind == kind for item in items):
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Cado could not finish that mix. Try generate again, or ask for fewer items.",
        )


def _validate_mcqs(items: list, option_count: int) -> None:
    for item in items:
        if item.kind != ContentType.MCQ:
            continue
        if (
            not item.options
            or len(item.options) != option_count
            or item.answer not in item.options
            or len({option.lower() for option in item.options}) != len(item.options)
        ):
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "AI returned an invalid MCQ")


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
    query_text, whole = _focus_query(payload.focus, payload.title or document.title)
    budget = min(80, 22 + max(0, payload.mcq_count - 10) // 5)
    chunks = await _source_chunks(db, document.id, query_text, whole, budget)
    if payload.explanation_mode == "full":
        explanation_count = min(10, max(3, min(len(chunks) or 3, 8)))
    else:
        explanation_count = payload.explanation_count
    source = _source_text(chunks[:22] if len(chunks) > 22 else chunks)
    collected: list = []
    title = payload.title or document.title

    async def call_model(expl: int, mcq: int, flash: int, context: str, avoid: list[str] | None = None):
        try:
            return await ai_service.generate_study_set(
                context,
                payload.language,
                expl,
                mcq,
                flash,
                payload.option_count,
                explanation_style=payload.explanation_mode,
                avoid_prompts=avoid,
            )
        except AIResponseError as exc:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc

    if explanation_count:
        first = await call_model(explanation_count, 0, 0, source)
        title = payload.title or first.title
        picked = _of_kind(first.items, ContentType.EXPLANATION, explanation_count)
        _need(picked, ContentType.EXPLANATION, explanation_count)
        collected.extend(picked)
    if payload.flashcard_count:
        cards = await call_model(0, 0, payload.flashcard_count, source)
        title = payload.title or cards.title or title
        picked = _of_kind(cards.items, ContentType.FLASHCARD, payload.flashcard_count)
        _need(picked, ContentType.FLASHCARD, payload.flashcard_count)
        collected.extend(picked)

    leftover = payload.mcq_count
    batch_index = 0
    seen_prompts: set[str] = set()
    while leftover > 0:
        batch = min(10, leftover)
        window = source if batch_index == 0 else _source_text(
            _rotate_chunks(chunks, batch_index, min(22, max(8, len(chunks))))
        )
        paper = await call_model(0, batch, 0, window, list(seen_prompts) or None)
        title = payload.title or paper.title or title
        unique = []
        for item in _of_kind(paper.items, ContentType.MCQ, batch):
            key = item.prompt.strip().lower()
            if key in seen_prompts:
                continue
            seen_prompts.add(key)
            unique.append(item)
        _validate_mcqs(unique, payload.option_count)
        if not unique:
            break
        collected.extend(unique)
        leftover -= len(unique)
        if len(unique) < batch:
            leftover = 0
        batch_index += 1
    _need(collected, ContentType.MCQ, payload.mcq_count)
    full_mode = payload.explanation_mode == "full"
    study_set = StudySet(
        user_id=user.id,
        document_id=document.id,
        title=title,
        language=payload.language,
        items=[
            StudyItem(
                kind=item.kind,
                position=index,
                prompt=item.prompt,
                answer=item.answer,
                options=item.options,
                explanation=item.explanation,
                full_explanation=item.answer if full_mode and item.kind == ContentType.EXPLANATION else None,
                source_chunk_ids=[str(chunk.id) for chunk in chunks],
            )
            for index, item in enumerate(collected)
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


def quiz_questions(study_set: StudySet) -> list[QuizQuestionView]:
    return [
        QuizQuestionView(
            id=item.id,
            prompt=item.prompt,
            options=item.options or [],
            answer=item.answer,
            explanation=item.explanation,
        )
        for item in study_set.items
        if item.kind == ContentType.MCQ
    ]


@router.get("/{study_set_id}/quiz", response_model=QuizPaperView)
async def get_quiz(
    study_set_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> QuizPaperView:
    study_set = await db.scalar(
        select(StudySet)
        .options(selectinload(StudySet.items))
        .where(StudySet.id == study_set_id)
    )
    if not study_set:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Study set not found")
    return QuizPaperView(
        title=study_set.title,
        questions=quiz_questions(study_set),
        owned=study_set.user_id == user.id,
    )


@router.get("", response_model=list[StudySetView])
async def list_study_sets(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> list[StudySetView]:
    sets = list(
        await db.scalars(
            select(StudySet)
            .where(StudySet.user_id == user.id)
            .order_by(StudySet.created_at.desc())
        )
    )
    counts: dict[tuple, int] = {}
    if sets:
        for set_id, kind, total in (
            await db.execute(
                select(StudyItem.study_set_id, StudyItem.kind, func.count())
                .where(StudyItem.study_set_id.in_([item.id for item in sets]))
                .group_by(StudyItem.study_set_id, StudyItem.kind)
            )
        ).all():
            counts[(set_id, kind)] = int(total)
    return [
        StudySetView(
            id=item.id,
            title=item.title,
            language=item.language,
            created_at=item.created_at,
            items=[],
            explanation_count=counts.get((item.id, ContentType.EXPLANATION), 0),
            flashcard_count=counts.get((item.id, ContentType.FLASHCARD), 0),
            mcq_count=counts.get((item.id, ContentType.MCQ), 0),
        )
        for item in sets
    ]


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


@router.post("/{study_set_id}/tutor", response_model=TutorReply)
async def ask_tutor(
    study_set_id: uuid.UUID,
    payload: TutorRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> TutorReply:
    started = time.perf_counter()
    question = payload.question.strip()
    if len(question) < 3:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Ask a slightly longer question")
    study_set = await db.scalar(
        select(StudySet)
        .options(selectinload(StudySet.items))
        .where(StudySet.id == study_set_id, StudySet.user_id == user.id)
    )
    if not study_set:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Study set not found")
    focus_parts: list[str] = []
    if payload.item_id:
        item = next((row for row in study_set.items if row.id == payload.item_id), None)
        if not item or item.study_set_id != study_set.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Study item not found")
        focus_parts.append(item.prompt)
        if item.kind != ContentType.MCQ:
            focus_parts.append(item.answer)
            if item.explanation:
                focus_parts.append(item.explanation)
    query_vector = None
    if engine.dialect.name == "postgresql":
        query_vector = (await embed_texts([question]))[0]
    ranking = (
        DocumentChunk.embedding.cosine_distance(query_vector)
        if query_vector is not None
        else DocumentChunk.position
    )
    chunks = list(
        await db.scalars(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == study_set.document_id)
            .order_by(ranking)
            .limit(5)
        )
    )
    source_bits = [
        f"[Source {index}] (page {chunk.page_number or '?'}) {_snippet(chunk.content, 500)}"
        for index, chunk in enumerate(chunks, start=1)
    ]
    if not source_bits:
        source_bits = [
            f"{item.prompt}: {item.answer}"
            for item in study_set.items
            if item.kind != ContentType.MCQ
        ]
    document = await db.get(Document, study_set.document_id)
    domain = detect_topic_domain(
        study_set.title,
        document.title if document else "",
        question,
        " ".join(focus_parts),
        " ".join(chunk.content[:500] for chunk in chunks[:5]),
    )
    try:
        passages: list[dict] = []
        if notes_cover_question(question, chunks):
            draft = await ai_service.tutor_reply(
                question, "\n\n".join(source_bits), "\n".join(focus_parts), domain
            )
            if draft.origin == "web":
                passages = await find_reliable_passages(question)
                draft = await _answer_from_web(
                    question, source_bits, focus_parts, domain, passages
                )
        else:
            passages = await find_reliable_passages(question)
            draft = await _answer_from_web(
                question, source_bits, focus_parts, domain, passages
            )
    except AIResponseError as extra:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(extra)) from extra
    image = None
    if draft.image_query and wants_visual(question):
        found = await find_education_image(draft.image_query, domain=domain)
        if found:
            image = TutorImage.model_validate(found)
    citations = (
        web_citations(draft.sources, passages)
        if draft.origin == "web"
        else note_citations(draft.sources, chunks)
    )
    elapsed_ms = max(1, round((time.perf_counter() - started) * 1000))
    return TutorReply(
        reply=draft.reply,
        image=image,
        origin=draft.origin,
        citations=citations,
        document_url=document.file_url if document else None,
        document_title=document.title if document else study_set.title,
        mime_type=document.mime_type if document else "",
        elapsed_ms=elapsed_ms,
    )
