import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import current_user
from app.database import get_db
from app.models import (
    Achievement,
    ContentType,
    Countdown,
    QuizAnswer,
    QuizAttempt,
    StreakEvent,
    StudyItem,
    StudyPlan,
    StudySet,
    StudyTask,
    User,
)
from app.schemas import (
    AchievementCreate,
    BlankPlanRequest,
    CountdownCreate,
    PlanRequest,
    PlanTitleUpdate,
    TaskCreate,
    TaskReorder,
    TaskUpdate,
)
from app.services.ai import AIResponseError, ai_service
from app.utils import calculate_streak

router = APIRouter(tags=["dashboard"])


def plan_payload(plan: StudyPlan) -> dict:
    tasks = sorted(plan.tasks, key=lambda item: (item.position, item.due_date, item.title))
    return {
        "id": str(plan.id),
        "title": plan.title,
        "start_date": plan.start_date,
        "created_at": plan.created_at,
        "tasks": [
            {
                "id": str(task.id),
                "title": task.title,
                "due_date": task.due_date,
                "minutes": task.minutes,
                "completed": task.completed,
                "position": task.position,
            }
            for task in tasks
        ],
    }


async def load_user_plans(db: AsyncSession, user_id) -> list[StudyPlan]:
    return list(
        await db.scalars(
            select(StudyPlan)
            .where(StudyPlan.user_id == user_id)
            .options(selectinload(StudyPlan.tasks))
            .order_by(StudyPlan.created_at.desc())
        )
    )


async def load_owned_plan(db: AsyncSession, plan_id: uuid.UUID, user_id) -> StudyPlan:
    plan = await db.scalar(
        select(StudyPlan)
        .where(StudyPlan.id == plan_id, StudyPlan.user_id == user_id)
        .options(selectinload(StudyPlan.tasks))
        .execution_options(populate_existing=True)
    )
    if not plan:
        raise HTTPException(404, "Plan not found")
    return plan


async def _quiz_stats(db: AsyncSession, user_id):
    return (
        await db.execute(
            select(
                func.count(QuizAttempt.completed_at),
                func.coalesce(func.sum(QuizAttempt.score), 0),
                func.coalesce(func.sum(QuizAttempt.total), 0),
            )
            .select_from(QuizAttempt)
            .where(QuizAttempt.user_id == user_id)
        )
    ).one()


async def _streak_dates(db: AsyncSession, user_id):
    return list(
        await db.scalars(
            select(StreakEvent.activity_date)
            .where(StreakEvent.user_id == user_id)
            .order_by(StreakEvent.activity_date.desc())
            .limit(365)
        )
    )


async def _recent_sets(db: AsyncSession, user_id):
    return list(
        await db.scalars(
            select(StudySet)
            .where(StudySet.user_id == user_id)
            .order_by(StudySet.created_at.desc())
            .limit(6)
        )
    )


async def _question_counts(db: AsyncSession, set_ids: list):
    if not set_ids:
        return {}
    return dict(
        (
            await db.execute(
                select(StudyItem.study_set_id, func.count())
                .where(
                    StudyItem.study_set_id.in_(set_ids),
                    StudyItem.kind == ContentType.MCQ,
                )
                .group_by(StudyItem.study_set_id)
            )
        ).all()
    )


async def _latest_attempts(db: AsyncSession, user_id, set_ids: list) -> dict:
    if not set_ids:
        return {}
    latest_at = (
        select(
            QuizAttempt.study_set_id,
            func.max(QuizAttempt.completed_at).label("completed_at"),
        )
        .where(
            QuizAttempt.user_id == user_id,
            QuizAttempt.study_set_id.in_(set_ids),
            QuizAttempt.completed_at.is_not(None),
        )
        .group_by(QuizAttempt.study_set_id)
        .subquery()
    )
    latest: dict = {}
    for attempt in await db.scalars(
        select(QuizAttempt)
        .join(
            latest_at,
            (QuizAttempt.study_set_id == latest_at.c.study_set_id)
            & (QuizAttempt.completed_at == latest_at.c.completed_at),
        )
        .where(QuizAttempt.user_id == user_id)
    ):
        latest.setdefault(attempt.study_set_id, attempt)
    return latest


async def _weak_topics(db: AsyncSession, user_id):
    rows = (
        await db.execute(
            select(
                StudyItem.id,
                StudyItem.prompt,
                StudyItem.study_set_id,
                StudySet.title,
                func.count(QuizAnswer.id).label("misses"),
            )
            .join(QuizAnswer, QuizAnswer.item_id == StudyItem.id)
            .join(QuizAttempt, QuizAttempt.id == QuizAnswer.attempt_id)
            .join(StudySet, StudySet.id == StudyItem.study_set_id)
            .where(QuizAttempt.user_id == user_id, QuizAnswer.is_correct.is_(False))
            .group_by(StudyItem.id, StudyItem.prompt, StudyItem.study_set_id, StudySet.title)
            .order_by(func.count(QuizAnswer.id).desc())
            .limit(3)
        )
    ).all()
    return [
        {
            "id": str(row.id),
            "title": row.prompt,
            "set_id": str(row.study_set_id),
            "set_title": row.title,
            "misses": int(row.misses),
        }
        for row in rows
    ]


async def _month_achievements(db: AsyncSession, user_id):
    month_start = date.today().replace(day=1)
    if month_start.month == 12:
        month_end = date(month_start.year + 1, 1, 1)
    else:
        month_end = date(month_start.year, month_start.month + 1, 1)
    return list(
        await db.scalars(
            select(Achievement)
            .where(
                Achievement.user_id == user_id,
                Achievement.achieved_on >= month_start,
                Achievement.achieved_on < month_end,
            )
            .order_by(Achievement.achieved_on.desc(), Achievement.created_at.desc())
        )
    )


async def _countdowns(db: AsyncSession, user_id):
    return list(
        await db.scalars(
            select(Countdown).where(Countdown.user_id == user_id).order_by(Countdown.ends_at)
        )
    )


@router.get("/dashboard")
async def dashboard(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> dict:
    user_id = user.id
    totals = await _quiz_stats(db, user_id)
    activity = await _streak_dates(db, user_id)
    recent = await _recent_sets(db, user_id)
    plans = await load_user_plans(db, user_id)
    achievements = await _month_achievements(db, user_id)
    countdowns = await _countdowns(db, user_id)
    weak_topics = await _weak_topics(db, user_id)
    set_ids = [item.id for item in recent]
    question_counts = await _question_counts(db, set_ids)
    latest_attempts = await _latest_attempts(db, user_id, set_ids)

    latest = plans[0] if plans else None
    completed, score_sum, total_sum = totals
    accuracy = round((score_sum / total_sum) * 100) if total_sum else 0
    return {
        "name": user.name,
        "email": user.email,
        "streak": calculate_streak(activity),
        "accuracy": accuracy,
        "quizzes_completed": completed or 0,
        "recent_sets": [
            {
                "id": str(item.id),
                "title": item.title,
                "language": item.language,
                "created_at": item.created_at,
                "question_count": int(question_counts.get(item.id, 0)),
                "last_score": latest_attempts[item.id].score if item.id in latest_attempts else None,
                "last_total": latest_attempts[item.id].total if item.id in latest_attempts else None,
            }
            for item in recent
        ],
        "weak_topics": weak_topics,
        "study_plans": [plan_payload(item) for item in plans],
        "study_plan": plan_payload(latest)
        if latest
        else {"id": None, "title": "Create your personalized plan", "tasks": []},
        "achievements": [
            {
                "id": str(item.id),
                "title": item.title,
                "achieved_on": item.achieved_on,
            }
            for item in achievements
        ],
        "countdowns": [
            {
                "id": str(item.id),
                "title": item.title,
                "ends_at": item.ends_at,
            }
            for item in countdowns
        ],
    }


@router.post("/study-plans")
async def create_study_plan(
    payload: PlanRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        generated = await ai_service.create_plan(
            payload.goal, payload.exam_date, payload.minutes_per_day
        )
    except AIResponseError as exc:
        raise HTTPException(502, str(exc)) from exc
    start = payload.start_date or date.today()
    plan = StudyPlan(
        user_id=user.id,
        title=generated.title,
        start_date=start,
        tasks=[
            StudyTask(
                title=task.title,
                due_date=start + timedelta(days=task.day_offset),
                minutes=task.minutes,
                position=index,
            )
            for index, task in enumerate(generated.tasks)
        ],
    )
    db.add(plan)
    await db.commit()
    return plan_payload(await load_owned_plan(db, plan.id, user.id))


@router.post("/study-plans/blank")
async def create_blank_plan(
    payload: BlankPlanRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    plan = StudyPlan(user_id=user.id, title=payload.title, start_date=payload.start_date or date.today())
    db.add(plan)
    await db.commit()
    return plan_payload(await load_owned_plan(db, plan.id, user.id))


@router.patch("/study-plans/{plan_id}")
async def rename_study_plan(
    plan_id: uuid.UUID,
    payload: PlanTitleUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    plan = await load_owned_plan(db, plan_id, user.id)
    plan.title = payload.title
    await db.commit()
    return plan_payload(await load_owned_plan(db, plan.id, user.id))


@router.delete("/study-plans/{plan_id}")
async def delete_study_plan(
    plan_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    plan = await load_owned_plan(db, plan_id, user.id)
    await db.delete(plan)
    await db.commit()
    return Response(status_code=204)


@router.post("/study-plans/{plan_id}/tasks")
async def add_study_task(
    plan_id: uuid.UUID,
    payload: TaskCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    plan = await load_owned_plan(db, plan_id, user.id)
    next_position = max((item.position for item in plan.tasks), default=-1) + 1
    task = StudyTask(
        plan_id=plan.id,
        title=payload.title,
        due_date=payload.due_date or date.today(),
        minutes=payload.minutes,
        position=next_position,
    )
    db.add(task)
    await db.commit()
    return plan_payload(await load_owned_plan(db, plan.id, user.id))


@router.put("/study-plans/{plan_id}/tasks/reorder")
async def reorder_study_tasks(
    plan_id: uuid.UUID,
    payload: TaskReorder,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    plan = await load_owned_plan(db, plan_id, user.id)
    current_ids = {task.id for task in plan.tasks}
    incoming = payload.task_ids
    if len(incoming) != len(current_ids) or set(incoming) != current_ids:
        raise HTTPException(400, "Task list does not match this plan")
    lookup = {task.id: task for task in plan.tasks}
    for index, task_id in enumerate(incoming):
        lookup[task_id].position = index
    await db.commit()
    return plan_payload(plan)


@router.put("/study-tasks/{task_id}")
async def update_study_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    task = await owned_task(db, task_id, user.id)
    if payload.title is not None:
        task.title = payload.title
    if payload.due_date is not None:
        task.due_date = payload.due_date
    if payload.minutes is not None:
        task.minutes = payload.minutes
    await db.commit()
    return {
        "id": str(task.id),
        "title": task.title,
        "due_date": task.due_date,
        "minutes": task.minutes,
        "completed": task.completed,
    }


@router.delete("/study-tasks/{task_id}")
async def delete_study_task(
    task_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    task = await owned_task(db, task_id, user.id)
    await db.delete(task)
    await db.commit()
    return Response(status_code=204)


@router.patch("/study-tasks/{task_id}")
async def toggle_study_task(
    task_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    task = await owned_task(db, task_id, user.id)
    task.completed = not task.completed
    task.completed_at = datetime.now(UTC) if task.completed else None
    await db.commit()
    return {"completed": task.completed}


async def owned_task(db: AsyncSession, task_id: uuid.UUID, user_id) -> StudyTask:
    task = await db.scalar(
        select(StudyTask)
        .join(StudyPlan)
        .where(StudyTask.id == task_id, StudyPlan.user_id == user_id)
    )
    if not task:
        raise HTTPException(404, "Task not found")
    return task


@router.post("/achievements")
async def create_achievement(
    payload: AchievementCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    item = Achievement(
        user_id=user.id,
        title=payload.title.strip(),
        achieved_on=payload.achieved_on or date.today(),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {"id": str(item.id), "title": item.title, "achieved_on": item.achieved_on}


@router.delete("/achievements/{achievement_id}")
async def delete_achievement(
    achievement_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    item = await db.scalar(
        select(Achievement).where(Achievement.id == achievement_id, Achievement.user_id == user.id)
    )
    if not item:
        raise HTTPException(404, "Achievement not found")
    await db.delete(item)
    await db.commit()
    return Response(status_code=204)


@router.post("/countdowns")
async def create_countdown(
    payload: CountdownCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if payload.ends_on < date.today():
        raise HTTPException(400, "Pick today or a later date")
    item = Countdown(
        user_id=user.id,
        title=payload.title.strip(),
        ends_at=datetime(
            payload.ends_on.year,
            payload.ends_on.month,
            payload.ends_on.day,
            23,
            59,
            59,
            tzinfo=UTC,
        ),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {"id": str(item.id), "title": item.title, "ends_at": item.ends_at}


@router.delete("/countdowns/{countdown_id}")
async def delete_countdown(
    countdown_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    item = await db.scalar(
        select(Countdown).where(Countdown.id == countdown_id, Countdown.user_id == user.id)
    )
    if not item:
        raise HTTPException(404, "Countdown not found")
    await db.delete(item)
    await db.commit()
    return Response(status_code=204)
