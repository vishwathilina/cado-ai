import asyncio
import time
import uuid
from datetime import date, datetime, timedelta, timezone

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
    assert attempt.json()["questions"][0]["answer"] == "ATP"

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
    assert replay.status_code == 200
    assert replay.json()["is_correct"] is False
    assert replay.json()["score"] == 0

    paper = client.get(f"/study-sets/{set_id}/quiz")
    assert paper.status_code == 200
    assert paper.json()["questions"][0]["answer"] == "ATP"

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


def test_study_set_list_returns_counts_without_items(client) -> None:
    register(client)
    _seed_ready_set()
    listed = client.get("/study-sets").json()
    assert listed[0]["items"] == []
    assert listed[0]["mcq_count"] == 1
    assert listed[0]["flashcard_count"] == 1
    assert listed[0]["explanation_count"] == 1


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


def test_manage_multiple_plans(client, monkeypatch) -> None:
    register(client)
    headers = csrf_headers(client)

    async def fake_plan(goal: str, exam_date: date | None, minutes_per_day: int):
        from app.services.ai import PlanPayload, PlanTaskPayload

        return PlanPayload(
            title="Generated plan",
            tasks=[PlanTaskPayload(title="Review notes", day_offset=0, minutes=minutes_per_day)],
        )

    monkeypatch.setattr("app.api.routes.dashboard.ai_service.create_plan", fake_plan)
    generated = client.post(
        "/study-plans",
        json={"goal": "Pass biology", "minutes_per_day": 20},
        headers=headers,
    )
    assert generated.status_code == 200
    blank = client.post("/study-plans/blank", json={"title": "Manual week"}, headers=headers)
    assert blank.status_code == 200
    plan_id = blank.json()["id"]
    added = client.post(
        f"/study-plans/{plan_id}/tasks",
        json={"title": "Read chapter 2", "minutes": 25},
        headers=headers,
    )
    assert added.status_code == 200
    assert added.json()["tasks"][0]["title"] == "Read chapter 2"
    task_id = added.json()["tasks"][0]["id"]
    renamed = client.put(f"/study-tasks/{task_id}", json={"title": "Read chapter 3"}, headers=headers)
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Read chapter 3"
    renamed_plan = client.patch(f"/study-plans/{plan_id}", json={"title": "Exam week"}, headers=headers)
    assert renamed_plan.json()["title"] == "Exam week"
    dashboard = client.get("/dashboard").json()
    assert len(dashboard["study_plans"]) == 2
    deleted = client.delete(f"/study-tasks/{task_id}", headers=headers)
    assert deleted.status_code == 204
    removed_plan = client.delete(f"/study-plans/{plan_id}", headers=headers)
    assert removed_plan.status_code == 204
    assert len(client.get("/dashboard").json()["study_plans"]) == 1


def test_study_sessions_sum_today_and_store_note(client) -> None:
    register(client)
    headers = csrf_headers(client)
    blank = client.post("/study-plans/blank", json={"title": "Focus week"}, headers=headers)
    plan_id = blank.json()["id"]
    added = client.post(
        f"/study-plans/{plan_id}/tasks",
        json={"title": "Pomodoro", "minutes": 25},
        headers=headers,
    )
    task_id = added.json()["tasks"][0]["id"]
    today = date.today().isoformat()
    start = datetime(2026, 8, 28, 10, 0, tzinfo=timezone.utc)
    first = client.post(
        "/study-sessions",
        json={
            "task_id": task_id,
            "started_at": start.isoformat(),
            "ended_at": start.replace(minute=25).isoformat(),
            "day": today,
            "note": "Covered mitochondria.",
        },
        headers=headers,
    )
    assert first.status_code == 200, first.text
    assert first.json()["minutes"] == 25
    assert first.json()["note"] == "Covered mitochondria."
    second = client.post(
        "/study-sessions",
        json={
            "task_id": task_id,
            "started_at": start.replace(hour=14).isoformat(),
            "ended_at": start.replace(hour=14, minute=20).isoformat(),
            "day": today,
        },
        headers=headers,
    )
    assert second.status_code == 200
    assert second.json()["minutes"] == 20
    listed = client.get(f"/study-sessions/today?day={today}", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["minutes"] == 45
    assert listed.json()["sessions"][0]["note"] == "Covered mitochondria."
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    other_day = client.get(f"/study-sessions/today?day={yesterday}", headers=headers)
    assert other_day.json()["minutes"] == 0
    dashboard = client.get("/dashboard").json()
    assert dashboard["studied_today_minutes"] == 45
    task = next(item for plan in dashboard["study_plans"] for item in plan["tasks"] if item["id"] == task_id)
    assert task["note"] == "Covered mitochondria."


def test_plan_dates_and_achievements(client) -> None:
    register(client)
    headers = csrf_headers(client)
    blank = client.post(
        "/study-plans/blank",
        json={"title": "Dated plan", "start_date": "2026-08-20"},
        headers=headers,
    )
    assert blank.status_code == 200
    assert blank.json()["start_date"] == "2026-08-20"
    plan_id = blank.json()["id"]
    added = client.post(
        f"/study-plans/{plan_id}/tasks",
        json={"title": "Read chapter 2", "minutes": 25, "due_date": "2026-08-22"},
        headers=headers,
    )
    assert added.json()["tasks"][0]["due_date"] == "2026-08-22"
    created = client.post(
        "/achievements",
        json={"title": "Finished week 1", "achieved_on": date.today().isoformat()},
        headers=headers,
    )
    assert created.status_code == 200
    dashboard = client.get("/dashboard").json()
    assert dashboard["achievements"][0]["title"] == "Finished week 1"
    deleted = client.delete(f"/achievements/{created.json()['id']}", headers=headers)
    assert deleted.status_code == 204
    assert client.get("/dashboard").json()["achievements"] == []
    counted = client.post(
        "/countdowns",
        json={"title": "Midterm", "ends_on": (date.today() + timedelta(days=2)).isoformat()},
        headers=headers,
    )
    assert counted.status_code == 200
    assert counted.json()["title"] == "Midterm"
    assert len(client.get("/dashboard").json()["countdowns"]) == 1
    gone = client.delete(f"/countdowns/{counted.json()['id']}", headers=headers)
    assert gone.status_code == 204
    assert client.get("/dashboard").json()["countdowns"] == []


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


def test_generate_keeps_valid_items_when_counts_differ(client, monkeypatch) -> None:
    register(client)
    headers = csrf_headers(client)

    async def seed_document() -> str:
        async with SessionLocal() as db:
            user = await db.scalar(select(User).where(User.email == "ada@example.com"))
            document = Document(
                user_id=user.id,
                title="Notes",
                file_url="https://files.example/notes-2.pdf",
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

    async def fake_generate(
        _context,
        _language,
        explanation_count,
        mcq_count,
        flashcard_count,
        _option_count,
        explanation_style="count",
        avoid_prompts=None,
    ) -> GeneratedPayload:
        items = []
        if explanation_count:
            items.extend(
                [
                    GeneratedItem(
                        kind=ContentType.EXPLANATION,
                        prompt="Light capture",
                        answer="Chlorophyll absorbs photons so plants can store energy.",
                    ),
                    GeneratedItem(
                        kind=ContentType.FLASHCARD,
                        prompt="Unwanted card",
                        answer="Should be ignored",
                    ),
                ]
            )
        if mcq_count:
            items.append(
                GeneratedItem(
                    kind=ContentType.MCQ,
                    prompt="What does photosynthesis convert?",
                    answer="Light energy",
                    options=["Light energy", "Sound", "Gravity", "Magnetism"],
                    explanation="Light energy is stored as chemical energy.",
                )
            )
        return GeneratedPayload(title="Photosynthesis", items=items)

    monkeypatch.setattr("app.api.routes.study.embed_texts", fake_embed)
    monkeypatch.setattr("app.api.routes.study.ai_service.generate_study_set", fake_generate)
    response = client.post(
        "/study-sets/generate",
        json={
            "document_id": document_id,
            "explanation_mode": "full",
            "explanation_count": 0,
            "mcq_count": 10,
            "flashcard_count": 0,
            "option_count": 4,
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    kinds = [item["kind"] for item in response.json()["items"]]
    assert "explanation" in kinds
    assert "mcq" in kinds
    assert "flashcard" not in kinds


def test_tutor_answers_from_notes_and_optional_image(client, monkeypatch) -> None:
    register(client)
    set_id, _, card_id = _seed_ready_set()
    headers = csrf_headers(client)

    async def fake_embed(texts: list[str]) -> list[list[float]]:
        return [[0.01] * settings.embedding_dimensions for _ in texts]

    tutor_calls: list[str] = []

    async def fake_tutor(question: str, source: str, focus: str = "", domain: str = "general", web: str = ""):
        from app.schemas import TutorDraft

        tutor_calls.append(web)
        assert not web
        assert "ATP" in source or "Mitochondria" in source
        assert domain == "general"
        return TutorDraft(
            reply="Mitochondria make ATP because they run cellular respiration in the inner membrane.",
            image_query="mitochondrion diagram",
        )

    image_calls: list[str] = []

    async def fake_image(query: str, domain: str = "general"):
        image_calls.append(query)
        assert "mitochondrion" in query
        assert domain == "general"
        return {
            "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/example.jpg",
            "caption": "Mitochondrion diagram",
            "credit": "Wikimedia Commons · CC BY-SA 4.0",
        }

    monkeypatch.setattr("app.api.routes.study.embed_texts", fake_embed)
    monkeypatch.setattr("app.api.routes.study.ai_service.tutor_reply", fake_tutor)
    monkeypatch.setattr("app.api.routes.study.find_education_image", fake_image)

    empty = client.post(f"/study-sets/{set_id}/tutor", json={"question": "no"}, headers=headers)
    assert empty.status_code == 422

    missing = client.post(
        f"/study-sets/{uuid.uuid4()}/tutor",
        json={"question": "Why do mitochondria make ATP?"},
        headers=headers,
    )
    assert missing.status_code == 404

    started = time.perf_counter()
    response = client.post(
        f"/study-sets/{set_id}/tutor",
        json={"question": "Why do mitochondria make ATP?", "item_id": card_id},
        headers=headers,
    )
    wall_ms = round((time.perf_counter() - started) * 1000)
    assert response.status_code == 200, response.text
    body = response.json()
    assert "ATP" in body["reply"]
    assert body["image"] is None
    assert image_calls == []
    assert body["origin"] == "notes"
    assert body["citations"]
    assert body["citations"][0]["kind"] == "notes"
    assert body["citations"][0]["n"] == 1
    assert body["citations"][0]["page"] == 1
    assert body["document_url"]
    assert body["mime_type"] == "application/pdf"
    assert 1 <= body["elapsed_ms"] <= wall_ms + 150
    assert tutor_calls == [""]

    pictured = client.post(
        f"/study-sets/{set_id}/tutor",
        json={"question": "Show a diagram of mitochondria", "item_id": card_id},
        headers=headers,
    )
    assert pictured.status_code == 200, pictured.text
    assert pictured.json()["image"]["caption"] == "Mitochondrion diagram"
    assert image_calls == ["mitochondrion diagram"]
    assert tutor_calls == ["", ""]

    other = register(client, email="grace@example.com", name="Grace")
    other_headers = csrf_headers(other)
    forbidden = other.post(
        f"/study-sets/{set_id}/tutor",
        json={"question": "Why do mitochondria make ATP?"},
        headers=other_headers,
    )
    assert forbidden.status_code == 404


def test_notes_cover_question_uses_content_overlap() -> None:
    from types import SimpleNamespace

    from app.api.routes.study import notes_cover_question

    chunk = SimpleNamespace(content="Mitochondria produce ATP through cellular respiration.")
    assert notes_cover_question("Why do mitochondria make ATP?", [chunk])
    assert not notes_cover_question("What is a cell in biology?", [chunk])
    assert notes_cover_question("Show a diagram of mitochondria", [chunk])
    assert not notes_cover_question("What is Spring Boot?", [chunk])


def test_tutor_uses_web_when_notes_do_not_cover(client, monkeypatch) -> None:
    register(client)
    set_id, _, _ = _seed_ready_set()
    headers = csrf_headers(client)
    tutor_calls: list[str] = []

    async def fake_embed(texts: list[str]) -> list[list[float]]:
        return [[0.01] * settings.embedding_dimensions for _ in texts]

    async def fake_tutor(question: str, source: str, focus: str = "", domain: str = "general", web: str = ""):
        from app.schemas import TutorDraft

        tutor_calls.append(web)
        assert web
        assert "Introduction to Spring Boot" in web
        assert "Cell (biology)" in web
        return TutorDraft(
            reply="A cell is the basic unit of life [1] because every living thing is made of cells.",
            origin="web",
            sources=[1],
        )

    async def fake_web(_query: str) -> list[dict]:
        return [
            {
                "title": "Cell (biology)",
                "url": "https://en.wikipedia.org/wiki/Cell_(biology)",
                "snippet": "The cell is the basic structural unit of life.",
            },
            {
                "title": "Introduction to Spring Boot",
                "url": "https://www.geeksforgeeks.org/spring-boot/",
                "snippet": "Spring Boot is a Java framework for building applications.",
            },
        ]

    async def fake_image(_query: str, domain: str = "general"):
        return None

    monkeypatch.setattr("app.api.routes.study.embed_texts", fake_embed)
    monkeypatch.setattr("app.api.routes.study.ai_service.tutor_reply", fake_tutor)
    monkeypatch.setattr("app.api.routes.study.find_reliable_passages", fake_web)
    monkeypatch.setattr("app.api.routes.study.find_education_image", fake_image)

    response = client.post(
        f"/study-sets/{set_id}/tutor",
        json={"question": "What is a cell in biology?"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["origin"] == "web"
    assert len(tutor_calls) == 1
    assert tutor_calls[0]
    assert len(body["citations"]) == 2
    assert body["citations"][0]["kind"] == "web"
    assert "geeksforgeeks.org" in body["citations"][0]["url"]
    assert "wikipedia.org" in body["citations"][1]["url"]
    assert body["citations"][0]["title"].startswith("GeeksforGeeks")
    assert "Wikipedia" in body["citations"][1]["title"]
    assert body["elapsed_ms"] >= 1


def test_plan_task_reorder(client) -> None:
    register(client)
    headers = csrf_headers(client)
    blank = client.post("/study-plans/blank", json={"title": "Order plan"}, headers=headers)
    plan_id = blank.json()["id"]
    first = client.post(
        f"/study-plans/{plan_id}/tasks",
        json={"title": "First", "minutes": 20},
        headers=headers,
    ).json()["tasks"][0]
    second = client.post(
        f"/study-plans/{plan_id}/tasks",
        json={"title": "Second", "minutes": 20},
        headers=headers,
    ).json()["tasks"][1]
    reordered = client.put(
        f"/study-plans/{plan_id}/tasks/reorder",
        json={"task_ids": [second["id"], first["id"]]},
        headers=headers,
    )
    assert reordered.status_code == 200
    titles = [task["title"] for task in reordered.json()["tasks"]]
    assert titles == ["Second", "First"]
    assert [task["position"] for task in reordered.json()["tasks"]] == [0, 1]


def test_logged_in_friend_can_take_quiz_but_not_notes(client) -> None:
    register(client)
    set_id, item_id, _ = _seed_ready_set()
    client.cookies.clear()
    assert client.get(f"/study-sets/{set_id}/quiz").status_code == 401
    register(client, email="bob@example.com", name="Bob")
    headers = csrf_headers(client)
    paper = client.get(f"/study-sets/{set_id}/quiz")
    assert paper.status_code == 200
    assert paper.json()["owned"] is False
    attempt = client.post("/quiz-attempts", json={"study_set_id": set_id}, headers=headers)
    assert attempt.status_code == 201
    answered = client.post(
        f"/quiz-attempts/{attempt.json()['id']}/answers",
        json={"item_id": item_id, "selected_answer": "ATP"},
        headers=headers,
    )
    assert answered.status_code == 200
    assert answered.json()["is_correct"] is True
    assert client.get(f"/study-sets/{set_id}").status_code == 404


def test_full_explain_uses_cached_options(client, monkeypatch) -> None:
    register(client)
    set_id, item_id, _ = _seed_ready_set()
    headers = csrf_headers(client)
    attempt = client.post("/quiz-attempts", json={"study_set_id": set_id}, headers=headers)
    attempt_id = attempt.json()["id"]
    calls = {"n": 0}

    async def fake_explain(prompt: str, options: list[str], answer: str, explanation: str):
        calls["n"] += 1
        return [
            {"text": option, "correct": option == answer, "why": f"Because {option} relates to {prompt}." * 2}
            for option in options
        ]

    monkeypatch.setattr("app.api.routes.learning.ai_service.explain_options", fake_explain)
    first = client.post(f"/quiz-attempts/{attempt_id}/items/{item_id}/full-explain", headers=headers)
    assert first.status_code == 200, first.text
    assert len(first.json()["options"]) == 4
    second = client.post(f"/quiz-attempts/{attempt_id}/items/{item_id}/full-explain", headers=headers)
    assert second.status_code == 200
    assert calls["n"] == 1

