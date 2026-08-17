import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.database import get_db
from app.models import (
    QuizAnswer,
    QuizAttempt,
    StreakEvent,
    StudyItem,
    StudyPlan,
    StudySet,
    StudyTask,
    User,
)
from app.schemas import PlanRequest
from app.services.ai import ai_service
from app.utils import calculate_streak

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
async def dashboard(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> dict:
    attempts = await db.scalar(
        select(func.count())
        .select_from(QuizAttempt)
        .where(QuizAttempt.user_id == user.id, QuizAttempt.completed_at.is_not(None))
    )
    totals = (
        await db.execute(
            select(
                func.coalesce(func.sum(QuizAttempt.score), 0),
                func.coalesce(func.sum(QuizAttempt.total), 0),
            ).where(QuizAttempt.user_id == user.id)
        )
    ).one()
    activity = list(
        await db.scalars(
            select(StreakEvent.activity_date)
            .where(StreakEvent.user_id == user.id)
            .order_by(StreakEvent.activity_date.desc())
            .limit(365)
        )
    )
    recent = list(
        await db.scalars(
            select(StudySet)
            .where(StudySet.user_id == user.id)
            .order_by(StudySet.created_at.desc())
            .limit(4)
        )
    )
    weak_topics = list(
        await db.scalars(
            select(StudyItem.prompt)
            .join(QuizAnswer, QuizAnswer.item_id == StudyItem.id)
            .join(QuizAttempt, QuizAttempt.id == QuizAnswer.attempt_id)
            .where(QuizAttempt.user_id == user.id, QuizAnswer.is_correct.is_(False))
            .group_by(StudyItem.prompt)
            .order_by(func.count(QuizAnswer.id).desc())
            .limit(3)
        )
    )
    plan = await db.scalar(
        select(StudyPlan).where(StudyPlan.user_id == user.id).order_by(StudyPlan.created_at.desc())
    )
    tasks = (
        list(
            await db.scalars(
                select(StudyTask)
                .where(StudyTask.plan_id == plan.id)
                .order_by(StudyTask.due_date)
            )
        )
        if plan
        else []
    )
    accuracy = round((totals[0] / totals[1]) * 100) if totals[1] else 0
    return {
        "name": user.name,
        "streak": calculate_streak(activity),
        "accuracy": accuracy,
        "quizzes_completed": attempts or 0,
        "recent_sets": [
            {"id": str(item.id), "title": item.title, "created_at": item.created_at}
            for item in recent
        ],
        "weak_topics": weak_topics,
        "study_plan": {
            "id": str(plan.id) if plan else None,
            "title": plan.title if plan else "Create your personalized plan",
            "tasks": [
                {
                    "id": str(task.id),
                    "title": task.title,
                    "due_date": task.due_date,
                    "minutes": task.minutes,
                    "completed": task.completed,
                }
                for task in tasks
            ],
        },
    }


@router.post("/study-plans")
async def create_study_plan(
    payload: PlanRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    generated = await ai_service.create_plan(
        payload.goal, payload.exam_date, payload.minutes_per_day
    )
    plan = StudyPlan(
        user_id=user.id,
        title=generated.title,
        tasks=[
            StudyTask(
                title=task.title,
                due_date=date.today() + timedelta(days=task.day_offset),
                minutes=task.minutes,
            )
            for task in generated.tasks
        ],
    )
    db.add(plan)
    await db.commit()
    return {"id": str(plan.id), "title": plan.title}


@router.patch("/study-tasks/{task_id}")
async def toggle_study_task(
    task_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    task = await db.scalar(
        select(StudyTask)
        .join(StudyPlan)
        .where(StudyTask.id == task_id, StudyPlan.user_id == user.id)
    )
    if not task:
        raise HTTPException(404, "Task not found")
    task.completed = not task.completed
    task.completed_at = datetime.now(UTC) if task.completed else None
    await db.commit()
    return {"completed": task.completed}
