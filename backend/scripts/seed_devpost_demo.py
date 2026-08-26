#!/usr/bin/env python
"""Create a repeatable, polished Cado account for the Devpost recording.

The script replaces only DEMO_EMAIL's data. It does not call the generation
model: all recording states are deterministic and ready immediately.

Run from backend/:
    DEMO_FILE_URL=http://localhost:3000/cado-demo-notes.pdf \
      .venv/bin/python scripts/seed_devpost_demo.py

Optional:
    DEMO_EMAIL=demo@cado.study
    DEMO_PASSWORD=CadoDemo2026!
    DEMO_NAME=Maya
"""

import asyncio
import os
import sys
import uuid
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from sqlalchemy import delete, select

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    Achievement,
    ContentType,
    Countdown,
    Document,
    DocumentChunk,
    DocumentStatus,
    FlashcardReview,
    QuizAnswer,
    QuizAttempt,
    StreakEvent,
    StudyItem,
    StudyPlan,
    StudySet,
    StudyTask,
    User,
    VocabularyLookup,
)
from app.security import hash_password  # noqa: E402
from app.services.embeddings import embed_texts  # noqa: E402

DEMO_EMAIL = os.getenv("DEMO_EMAIL", "demo@cado.study").strip().lower()
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "CadoDemo2026!").strip()
DEMO_NAME = os.getenv("DEMO_NAME", "Maya").strip()
DEMO_FILE_URL = os.getenv(
    "DEMO_FILE_URL", "http://localhost:3000/cado-demo-notes.pdf"
).strip()

CHUNKS = [
    (
        1,
        "Photosynthesis converts light energy into chemical energy stored in glucose. "
        "It occurs mainly in chloroplasts. Chlorophyll in thylakoid membranes absorbs "
        "light. The light-dependent reactions split water, release oxygen, and produce "
        "ATP and NADPH. These energy carriers power the Calvin cycle in the stroma.",
    ),
    (
        2,
        "Cellular respiration breaks down glucose to make ATP. Glycolysis begins in the "
        "cytoplasm. The citric acid cycle and electron transport chain continue inside "
        "mitochondria. Oxygen is the final electron acceptor in aerobic respiration. "
        "Photosynthesis stores energy while respiration releases it.",
    ),
    (
        3,
        "Plants perform both photosynthesis and cellular respiration. In daylight, "
        "photosynthesis can produce glucose and oxygen faster than respiration consumes "
        "them. At night photosynthesis stops, but respiration continues. Stomata regulate "
        "gas exchange. Together these pathways cycle matter while energy flows.",
    ),
]


def item(
    kind: ContentType,
    position: int,
    prompt: str,
    answer: str,
    *,
    options: list[str] | None = None,
    explanation: str | None = None,
    full_explanation: str | None = None,
    option_explanations: list[dict] | None = None,
    source_ids: list[str] | None = None,
) -> StudyItem:
    return StudyItem(
        id=uuid.uuid4(),
        kind=kind,
        position=position,
        prompt=prompt,
        answer=answer,
        options=options,
        explanation=explanation,
        full_explanation=full_explanation,
        option_explanations=option_explanations,
        source_chunk_ids=source_ids or [],
    )


async def seed() -> None:
    vectors = await embed_texts([text for _, text in CHUNKS])
    today = date.today()
    now = datetime.now(UTC)

    async with SessionLocal() as db:
        existing = await db.scalar(select(User).where(User.email == DEMO_EMAIL))
        if existing:
            # Database foreign keys use ON DELETE CASCADE, keeping resets isolated
            # to the dedicated recording account.
            await db.execute(delete(User).where(User.id == existing.id))
            await db.commit()

        user = User(
            id=uuid.uuid4(),
            email=DEMO_EMAIL,
            name=DEMO_NAME,
            password_hash=hash_password(DEMO_PASSWORD),
        )
        db.add(user)
        await db.flush()
        document = Document(
            id=uuid.uuid4(),
            user_id=user.id,
            title="Photosynthesis and Cellular Respiration",
            file_url=DEMO_FILE_URL,
            file_key=f"devpost-demo-{uuid.uuid4()}",
            mime_type="application/pdf",
            language="English",
            status=DocumentStatus.READY,
            error=None,
        )
        chunks = [
            DocumentChunk(
                id=uuid.uuid4(),
                document_id=document.id,
                position=index,
                page_number=page,
                content=content,
                embedding=vectors[index],
            )
            for index, (page, content) in enumerate(CHUNKS)
        ]
        source_ids = [[str(chunk.id)] for chunk in chunks]
        study_set = StudySet(
            id=uuid.uuid4(),
            user_id=user.id,
            document_id=document.id,
            title="Photosynthesis and Cellular Respiration",
            language="English",
        )

        explanations = [
            item(
                ContentType.EXPLANATION,
                0,
                "How photosynthesis captures and stores energy",
                "Chlorophyll absorbs light in the thylakoid membranes. The light-dependent "
                "reactions use that energy to split water and make ATP and NADPH, releasing "
                "oxygen. The Calvin cycle then uses ATP and NADPH to build glucose from "
                "carbon dioxide.",
                full_explanation=(
                    "Photosynthesis is the process that converts light energy into chemical "
                    "energy. It takes place mainly in chloroplasts. Chlorophyll absorbs "
                    "specific wavelengths of light in the thylakoid membranes. That energy "
                    "drives reactions that split water molecules. Oxygen is released as a "
                    "by-product, while ATP and NADPH carry usable energy. In the stroma, the "
                    "Calvin cycle uses those carriers to incorporate carbon dioxide into "
                    "organic molecules. The pathway ultimately produces sugars such as "
                    "glucose. A plant can later use that glucose for growth or cellular "
                    "respiration. In short, light energy enters and stable chemical energy "
                    "leaves."
                ),
                source_ids=source_ids[0],
            ),
            item(
                ContentType.EXPLANATION,
                1,
                "How cellular respiration releases energy",
                "Cells break down glucose through glycolysis, the citric acid cycle, and the "
                "electron transport chain. In aerobic respiration, oxygen accepts electrons "
                "at the end of the chain. The released energy is captured in ATP.",
                source_ids=source_ids[1],
            ),
            item(
                ContentType.EXPLANATION,
                2,
                "Why plants need both pathways",
                "Photosynthesis stores sunlight in glucose, while respiration releases that "
                "stored energy as ATP for cell work. Plants photosynthesize when light is "
                "available, but respiration continues day and night.",
                source_ids=source_ids[2],
            ),
        ]

        flashcards = [
            ("Where does photosynthesis mainly occur?", "In chloroplasts."),
            ("What do the light-dependent reactions produce?", "ATP, NADPH, and oxygen."),
            ("Where does glycolysis occur?", "In the cytoplasm."),
            ("What is oxygen's role in aerobic respiration?", "It is the final electron acceptor."),
            ("Do plants respire at night?", "Yes. Respiration continues even when photosynthesis stops."),
        ]
        flash_items = [
            item(
                ContentType.FLASHCARD,
                3 + index,
                prompt,
                answer,
                source_ids=source_ids[min(index // 2, 2)],
            )
            for index, (prompt, answer) in enumerate(flashcards)
        ]

        quiz_data = [
            (
                "Which structure contains chlorophyll that absorbs light?",
                ["The thylakoid membrane", "The mitochondrial matrix", "The cell wall", "The nucleus"],
                "The thylakoid membrane",
                "Chlorophyll is embedded in thylakoid membranes inside chloroplasts.",
                0,
            ),
            (
                "What is released when water is split during the light-dependent reactions?",
                ["Carbon dioxide", "Oxygen", "Glucose", "Pyruvate"],
                "Oxygen",
                "Splitting water supplies electrons and releases oxygen as a by-product.",
                0,
            ),
            (
                "Where does glycolysis begin?",
                ["Chloroplast stroma", "Mitochondrial matrix", "Cytoplasm", "Thylakoid lumen"],
                "Cytoplasm",
                "Glycolysis is the first stage of respiration and occurs in the cytoplasm.",
                1,
            ),
            (
                "Why are photosynthesis and cellular respiration complementary?",
                [
                    "One stores energy in glucose while the other releases it",
                    "Both happen only during daylight",
                    "Both consume oxygen to make glucose",
                    "One replaces the need for the other",
                ],
                "One stores energy in glucose while the other releases it",
                "Their inputs and outputs connect: photosynthesis stores energy and respiration releases it.",
                1,
            ),
            (
                "What happens in a plant at night?",
                [
                    "Both processes stop",
                    "Only photosynthesis continues",
                    "Respiration continues while photosynthesis stops",
                    "The plant produces light",
                ],
                "Respiration continues while photosynthesis stops",
                "Photosynthesis requires light, but cells still need ATP from respiration at night.",
                2,
            ),
        ]
        quiz_items: list[StudyItem] = []
        for index, (prompt, options, answer, explanation, source_index) in enumerate(quiz_data):
            why = [
                {
                    "text": option,
                    "correct": option == answer,
                    "why": explanation
                    if option == answer
                    else f"This does not match the process described in the notes; {explanation.lower()}",
                }
                for option in options
            ]
            quiz_items.append(
                item(
                    ContentType.MCQ,
                    8 + index,
                    prompt,
                    answer,
                    options=options,
                    explanation=explanation,
                    option_explanations=why,
                    source_ids=source_ids[source_index],
                )
            )
        study_set.items = [*explanations, *flash_items, *quiz_items]

        attempt = QuizAttempt(
            id=uuid.uuid4(),
            user_id=user.id,
            study_set_id=study_set.id,
            score=3,
            total=5,
            completed_at=now - timedelta(hours=2),
        )
        selected = [
            quiz_data[0][2],
            quiz_data[1][0][0],  # deliberately wrong
            quiz_data[2][2],
            quiz_data[3][0][1],  # deliberately wrong
            quiz_data[4][2],
        ]
        attempt.answers = [
            QuizAnswer(
                id=uuid.uuid4(),
                item_id=quiz_item.id,
                selected_answer=answer,
                is_correct=answer == quiz_item.answer,
            )
            for quiz_item, answer in zip(quiz_items, selected, strict=True)
        ]

        plan = StudyPlan(
            id=uuid.uuid4(),
            user_id=user.id,
            title="Biology Exam Sprint",
            start_date=today,
            tasks=[
                StudyTask(
                    id=uuid.uuid4(),
                    title=title,
                    due_date=today + timedelta(days=offset),
                    minutes=minutes,
                    position=offset,
                    completed=offset == 0,
                    completed_at=now - timedelta(hours=1) if offset == 0 else None,
                )
                for offset, (title, minutes) in enumerate(
                    [
                        ("Review photosynthesis overview", 15),
                        ("Flip energy-pathway flashcards", 10),
                        ("Practice chloroplast questions", 20),
                        ("Compare photosynthesis and respiration", 20),
                        ("Retry weak quiz topics", 15),
                        ("Complete a timed mixed quiz", 25),
                        ("Final recall and confidence check", 15),
                    ]
                )
            ],
        )

        db.add_all(
            [
                document,
                *chunks,
                study_set,
                plan,
                Countdown(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    title="Biology final",
                    ends_at=now + timedelta(days=12),
                ),
                Achievement(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    title="Finished my first quiz",
                    achieved_on=today,
                ),
                Achievement(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    title="Reviewed every flashcard",
                    achieved_on=today - timedelta(days=1),
                ),
                VocabularyLookup(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    word="chlorophyll",
                    definition="The green pigment that absorbs light energy for photosynthesis.",
                    pronunciation="KLOR-uh-fil",
                    example="Chlorophyll absorbs light in the thylakoid membranes.",
                ),
                *[
                    StreakEvent(
                        id=uuid.uuid4(),
                        user_id=user.id,
                        activity_date=today - timedelta(days=offset),
                        points=1,
                    )
                    for offset in range(5)
                ],
            ]
        )
        # Flush study items before rows that refer to individual item IDs.
        # These models intentionally have lightweight FK-only mappings, so
        # SQLAlchemy cannot infer this dependency from a relationship.
        await db.flush()
        db.add(attempt)
        await db.flush()
        db.add_all(
            [
                FlashcardReview(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    item_id=card.id,
                    confidence=confidence,
                    review_count=1,
                    reviewed_at=now - timedelta(days=1),
                )
                for card, confidence in zip(flash_items, [3, 2, 3, 2, 3], strict=True)
            ]
        )
        await db.commit()

    print("Devpost demo account is ready")
    print(f"  URL:      http://localhost:3000/login")
    print(f"  Email:    {DEMO_EMAIL}")
    print(f"  Password: {DEMO_PASSWORD}")
    print(f"  PDF URL:  {DEMO_FILE_URL}")
    print(f"  Set ID:   {study_set.id}")
    print("Delete or rotate this public demo account after recording.")


if __name__ == "__main__":
    raise SystemExit(asyncio.run(seed()))
