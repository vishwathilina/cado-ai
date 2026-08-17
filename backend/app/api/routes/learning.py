import uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.database import get_db
from app.models import (
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
    FlashcardReviewRequest,
    VocabularyRequest,
    VocabularyView,
)
from app.services.ai import ai_service

router = APIRouter(tags=["learning"])


async def record_activity(db: AsyncSession, user_id: uuid.UUID) -> None:
    exists = await db.scalar(
        select(StreakEvent).where(
            StreakEvent.user_id == user_id, StreakEvent.activity_date == date.today()
        )
    )
    if not exists:
        db.add(StreakEvent(user_id=user_id))


@router.post("/quiz-attempts", status_code=status.HTTP_201_CREATED)
async def start_attempt(
    payload: AttemptCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str | int]:
    study_set = await db.scalar(
        select(StudySet).where(StudySet.id == payload.study_set_id, StudySet.user_id == user.id)
    )
    if not study_set:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Study set not found")
    attempt = QuizAttempt(user_id=user.id, study_set_id=study_set.id)
    db.add(attempt)
    await db.commit()
    return {"id": str(attempt.id), "score": 0, "answered": 0}


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
        select(StudyItem)
        .join(StudySet)
        .where(
            StudyItem.id == payload.item_id,
            StudyItem.study_set_id == attempt.study_set_id,
            StudySet.user_id == user.id,
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
        raise HTTPException(status.HTTP_409_CONFLICT, "Question already answered")
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
    await record_activity(db, user.id)
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
    attempt.completed_at = datetime.now(UTC)
    await db.commit()
    return {"score": attempt.score, "total": attempt.total}


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
