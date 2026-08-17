import asyncio
import uuid
from datetime import date

from sqlalchemy import select

from app.config import settings
from app.database import SessionLocal
from app.models import (
    ContentType,
    Document,
    DocumentChunk,
    DocumentStatus,
    StudyItem,
    StudySet,
    User,
)
from app.schemas import GeneratedItem, GeneratedPayload
from tests.conftest import csrf_headers, register


def _seed_ready_set() -> tuple[str, str, str]:
    async def seed() -> tuple[str, str, str]:
        async with SessionLocal() as db:
            user = await db.scalar(select(User).where(User.email == "ada@example.com"))
            document = Document(
                user_id=user.id,
                title="Biology notes",
                file_url="https://files.example/bio.pdf",
                file_key=f"bio-{uuid.uuid4()}",
                mime_type="application/pdf",
                status=DocumentStatus.READY,
            )
            db.add(document)
            await db.flush()
            db.add(
                DocumentChunk(
                    document_id=document.id,
                    position=0,
                    content="Mitochondria produce ATP through cellular respiration.",
                    page_number=1,
                    embedding=[0.01] * settings.embedding_dimensions,
                )
            )
            study_set = StudySet(
                user_id=user.id,
                document_id=document.id,
                title="Cell energy",
                items=[
                    StudyItem(
                        kind=ContentType.MCQ,
                        position=0,
                        prompt="What do mitochondria produce?",
                        answer="ATP",
                        options=["ATP", "DNA", "Glucose", "Oxygen"],
                        explanation="Mitochondria generate ATP, the cell's energy currency.",
                    ),
                    StudyItem(
                        kind=ContentType.FLASHCARD,
                        position=1,
                        prompt="Powerhouse of the cell",
                        answer="Mitochondrion",
                    ),
                    StudyItem(
                        kind=ContentType.EXPLANATION,
                        position=2,
                        prompt="Cellular respiration",
                        answer="Cells convert glucose into ATP.",
                    ),
                ],
            )
            db.add(study_set)
            await db.commit()
            mcq_id = str(study_set.items[0].id)
            card_id = str(study_set.items[1].id)
            return str(study_set.id), mcq_id, card_id

    return asyncio.run(seed())


def test_quiz_scoring_is_immutable_and_tracks_score(client) -> None:
    register(client)
    set_id, item_id, _ = _seed_ready_set()
    headers = csrf_headers(client)
    attempt = client.post("/quiz-attempts", json={"study_set_id": set_id}, headers=headers)
    assert attempt.status_code == 201
    attempt_id = attempt.json()["id"]

    wrong = client.post(
        f"/quiz-attempts/{attempt_id}/answers",
        json={"item_id": item_id, "selected_answer": "DNA"},
        headers=headers,
    )
    assert wrong.status_code == 200
    assert wrong.json()["is_correct"] is False
    assert wrong.json()["score"] == 0
    assert wrong.json()["correct_answer"] == "ATP"

    replay = client.post(
        f"/quiz-attempts/{attempt_id}/answers",
        json={"item_id": item_id, "selected_answer": "ATP"},
        headers=headers,
    )
    assert replay.status_code == 409

    finished = client.post(f"/quiz-attempts/{attempt_id}/complete", headers=headers)
    assert finished.status_code == 200
    assert finished.json() == {"score": 0, "total": 1}

    dashboard = client.get("/dashboard")
    assert dashboard.status_code == 200
    assert dashboard.json()["quizzes_completed"] == 1
    assert dashboard.json()["streak"] >= 1


def test_study_set_hides_mcq_answers(client) -> None:
    register(client)
    set_id, _, _ = _seed_ready_set()
    payload = client.get(f"/study-sets/{set_id}").json()
    mcq = next(item for item in payload["items"] if item["kind"] == "mcq")
    flashcard = next(item for item in payload["items"] if item["kind"] == "flashcard")
    assert mcq["answer"] == ""
    assert mcq["explanation"] is None
    assert flashcard["answer"] == "Mitochondrion"


def test_flashcard_review_and_plan_progress(client, monkeypatch) -> None:
    register(client)
    set_id, _, card_id = _seed_ready_set()
    headers = csrf_headers(client)
    review = client.put(f"/flashcards/{card_id}/review", json={"confidence": 3}, headers=headers)
    assert review.status_code == 200
    assert review.json()["review_count"] == 1

    async def fake_plan(goal: str, exam_date: date | None, minutes_per_day: int):
        from app.services.ai import PlanPayload, PlanTaskPayload

        return PlanPayload(
            title="Biology week",
            tasks=[PlanTaskPayload(title="Review mitochondria", day_offset=0, minutes=minutes_per_day)],
        )

    monkeypatch.setattr("app.api.routes.dashboard.ai_service.create_plan", fake_plan)
    created = client.post(
        "/study-plans",
        json={"goal": "Master cell biology", "minutes_per_day": 25},
        headers=headers,
    )
    assert created.status_code == 200
    dashboard = client.get("/dashboard").json()
    task_id = dashboard["study_plan"]["tasks"][0]["id"]
    toggled = client.patch(f"/study-tasks/{task_id}", headers=headers)
    assert toggled.json()["completed"] is True
    assert client.get("/dashboard").json()["study_plan"]["tasks"][0]["completed"] is True


def test_generate_validates_ai_payload(client, monkeypatch) -> None:
    register(client)
    headers = csrf_headers(client)

    async def seed_document() -> str:
        async with SessionLocal() as db:
            user = await db.scalar(select(User).where(User.email == "ada@example.com"))
            document = Document(
                user_id=user.id,
                title="Notes",
                file_url="https://files.example/notes.pdf",
                file_key=f"notes-{uuid.uuid4()}",
                mime_type="application/pdf",
                status=DocumentStatus.READY,
            )
            db.add(document)
            await db.flush()
            db.add(
                DocumentChunk(
                    document_id=document.id,
                    position=0,
                    content="Photosynthesis converts light into chemical energy.",
                    embedding=[0.02] * settings.embedding_dimensions,
                )
            )
            await db.commit()
            return str(document.id)

    document_id = asyncio.run(seed_document())

    async def fake_embed(texts: list[str]) -> list[list[float]]:
        return [[0.02] * settings.embedding_dimensions for _ in texts]

    async def fake_generate(*_args, **_kwargs) -> GeneratedPayload:
        return GeneratedPayload(
            title="Photosynthesis",
            items=[
                GeneratedItem(
                    kind=ContentType.MCQ,
                    prompt="What does photosynthesis convert?",
                    answer="Light energy",
                    options=["Light energy", "Sound", "Gravity", "Magnetism"],
                    explanation="Light energy is stored as chemical energy.",
                )
            ],
        )

    monkeypatch.setattr("app.api.routes.study.embed_texts", fake_embed)
    monkeypatch.setattr("app.api.routes.study.ai_service.generate_study_set", fake_generate)
    response = client.post(
        "/study-sets/generate",
        json={
            "document_id": document_id,
            "explanation_count": 0,
            "mcq_count": 1,
            "flashcard_count": 0,
            "option_count": 4,
        },
        headers=headers,
    )
    assert response.status_code == 201
    item = response.json()["items"][0]
    assert item["kind"] == "mcq"
    assert item["answer"] == ""
    assert len(item["options"]) == 4
