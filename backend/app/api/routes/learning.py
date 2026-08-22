import uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import current_user
from app.api.routes.study import quiz_questions
from app.database import get_db
from app.models import (
    ContentType,
    FlashcardReview,
    QuizAnswer,
    QuizAttempt,
    StreakEvent,
    StudyItem,
    StudySet,
    User,
    VocabularyLookup,
)
from app.schemas import (
    AnswerRequest,
    AnswerResult,
    AttemptCreate,
    AttemptStartView,
    FlashcardReviewRequest,
    FullExplainView,
    FullWriteupView,
    OptionExplain,
    QuizFinishRequest,
    VocabularyRequest,
    VocabularyView,
)
from app.services.ai import AIResponseError, ai_service

router = APIRouter(tags=["learning"])


async def record_activity(db: AsyncSession, user_id: uuid.UUID) -> None:
    exists = await db.scalar(
        select(StreakEvent).where(
            StreakEvent.user_id == user_id, StreakEvent.activity_date == date.today()
        )
    )
    if not exists:
        db.add(StreakEvent(user_id=user_id))


@router.post("/quiz-attempts", response_model=AttemptStartView, status_code=status.HTTP_201_CREATED)
async def start_attempt(
    payload: AttemptCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptStartView:
    study_set = await db.scalar(
        select(StudySet)
        .options(selectinload(StudySet.items))
        .where(StudySet.id == payload.study_set_id)
    )
    if not study_set:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Study set not found")
    attempt = QuizAttempt(user_id=user.id, study_set_id=study_set.id)
    db.add(attempt)
    await db.commit()
    return AttemptStartView(
        id=attempt.id,
        title=study_set.title,
        questions=quiz_questions(study_set),
    )


@router.post("/quiz-attempts/{attempt_id}/answers", response_model=AnswerResult)
async def submit_answer(
    attempt_id: uuid.UUID,
    payload: AnswerRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> AnswerResult:
    attempt = await db.scalar(
        select(QuizAttempt).where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user.id)
    )
    if not attempt or attempt.completed_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Active attempt not found")
    item = await db.scalar(
        select(StudyItem).where(
            StudyItem.id == payload.item_id,
            StudyItem.study_set_id == attempt.study_set_id,
        )
    )
    if not item or not item.options:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Question not found")
    exists = await db.scalar(
        select(QuizAnswer).where(
            QuizAnswer.attempt_id == attempt.id, QuizAnswer.item_id == item.id
        )
    )
    if exists:
        return AnswerResult(
            is_correct=exists.is_correct,
            correct_answer=item.answer,
            explanation=item.explanation or "Review the source material for this answer.",
            score=attempt.score,
            answered=attempt.total,
        )
    correct = payload.selected_answer == item.answer
    db.add(
        QuizAnswer(
            attempt_id=attempt.id,
            item_id=item.id,
            selected_answer=payload.selected_answer,
            is_correct=correct,
        )
    )
    if correct:
        attempt.score += 1
    attempt.total += 1
    await db.commit()
    return AnswerResult(
        is_correct=correct,
        correct_answer=item.answer,
        explanation=item.explanation or "Review the source material for this answer.",
        score=attempt.score,
        answered=attempt.total,
    )


@router.post("/quiz-attempts/{attempt_id}/complete")
async def complete_attempt(
    attempt_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    attempt = await db.scalar(
        select(QuizAttempt).where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user.id)
    )
    if not attempt:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attempt not found")
    if attempt.completed_at:
        return {"score": attempt.score, "total": attempt.total}
    attempt.completed_at = datetime.now(UTC)
    await record_activity(db, user.id)
    await db.commit()
    return {"score": attempt.score, "total": attempt.total}


@router.post("/quiz-attempts/{attempt_id}/finish")
async def finish_attempt(
    attempt_id: uuid.UUID,
    payload: QuizFinishRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    attempt = await db.scalar(
        select(QuizAttempt)
        .options(selectinload(QuizAttempt.answers))
        .where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user.id)
    )
    if not attempt:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attempt not found")
    if not attempt.completed_at:
        recorded = {answer.item_id for answer in attempt.answers}
        for entry in payload.answers:
            if entry.item_id in recorded:
                continue
            item = await db.scalar(
                select(StudyItem).where(
                    StudyItem.id == entry.item_id,
                    StudyItem.study_set_id == attempt.study_set_id,
                )
            )
            if not item or not item.options:
                continue
            correct = entry.selected_answer == item.answer
            db.add(
                QuizAnswer(
                    attempt_id=attempt.id,
                    item_id=item.id,
                    selected_answer=entry.selected_answer,
                    is_correct=correct,
                )
            )
            recorded.add(item.id)
            if correct:
                attempt.score += 1
            attempt.total += 1
        attempt.completed_at = datetime.now(UTC)
        await record_activity(db, user.id)
        await db.commit()
    return {"score": attempt.score, "total": attempt.total}


def _cached_option_explains(item: StudyItem) -> FullExplainView | None:
    raw = item.option_explanations
    if not isinstance(raw, list) or not raw:
        return None
    try:
        options = [OptionExplain.model_validate(row) for row in raw]
    except Exception:
        return None
    if len(options) != len(item.options or []):
        return None
    return FullExplainView(options=options)


@router.post("/quiz-attempts/{attempt_id}/items/{item_id}/full-explain", response_model=FullExplainView)
async def full_explain_options(
    attempt_id: uuid.UUID,
    item_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> FullExplainView:
    attempt = await db.scalar(
        select(QuizAttempt).where(QuizAttempt.id == attempt_id, QuizAttempt.user_id == user.id)
    )
    if not attempt:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attempt not found")
    item = await db.scalar(
        select(StudyItem).where(StudyItem.id == item_id, StudyItem.study_set_id == attempt.study_set_id)
    )
    if not item or item.kind != ContentType.MCQ or not item.options:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    cached = _cached_option_explains(item)
    if cached:
        return cached
    try:
        rows = await ai_service.explain_options(
            item.prompt, item.options, item.answer, item.explanation or ""
        )
    except AIResponseError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    item.option_explanations = rows
    await db.commit()
    return FullExplainView(options=[OptionExplain.model_validate(row) for row in rows])


@router.post("/study-items/{item_id}/full-explain", response_model=FullWriteupView)
async def full_explain_item(
    item_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> FullWriteupView:
    item = await db.scalar(
        select(StudyItem)
        .join(StudySet)
        .where(StudyItem.id == item_id, StudySet.user_id == user.id)
    )
    if not item or item.kind != ContentType.EXPLANATION:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Explanation not found")
    if item.full_explanation:
        return FullWriteupView(explanation=item.full_explanation)
    try:
        expanded = await ai_service.expand_explanation(item.prompt, item.answer)
    except AIResponseError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    item.full_explanation = expanded
    await db.commit()
    return FullWriteupView(explanation=expanded)


@router.put("/flashcards/{item_id}/review")
async def review_flashcard(
    item_id: uuid.UUID,
    payload: FlashcardReviewRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    item = await db.scalar(
        select(StudyItem)
        .join(StudySet)
        .where(StudyItem.id == item_id, StudySet.user_id == user.id)
    )
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Flashcard not found")
    review = await db.scalar(
        select(FlashcardReview).where(
            FlashcardReview.user_id == user.id, FlashcardReview.item_id == item.id
        )
    )
    if review:
        review.confidence = payload.confidence
        review.review_count += 1
        review.reviewed_at = datetime.now(UTC)
    else:
        review = FlashcardReview(user_id=user.id, item_id=item.id, confidence=payload.confidence)
        db.add(review)
    await record_activity(db, user.id)
    await db.commit()
    return {"review_count": review.review_count, "confidence": review.confidence}


@router.post("/vocabulary", response_model=VocabularyView)
async def define_vocabulary(
    payload: VocabularyRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> VocabularyView:
    word = payload.word.lower().strip()
    cached = await db.scalar(
        select(VocabularyLookup).where(
            VocabularyLookup.user_id == user.id, VocabularyLookup.word == word
        )
    )
    if cached:
        return VocabularyView.model_validate(cached, from_attributes=True)
    definition = await ai_service.define_word(word, payload.context)
    db.add(VocabularyLookup(user_id=user.id, **definition.model_dump()))
    await db.commit()
    return definition
