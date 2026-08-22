import json

import pytest
from pydantic import ValidationError

from app.schemas import GeneratedPayload, TutorDraft
from app.services.ai import AIResponseError, PlanPayload, parse_json_object


def test_generated_payload_requires_known_item_kinds() -> None:
    payload = GeneratedPayload.model_validate(
        {
            "title": "Newton",
            "items": [
                {
                    "kind": "explanation",
                    "prompt": "Inertia",
                    "answer": "Objects resist changes in motion.",
                },
                {
                    "kind": "mcq",
                    "prompt": "Unit of force?",
                    "answer": "Newton",
                    "options": ["Newton", "Joule", "Watt", "Pascal"],
                    "explanation": "Force is measured in newtons.",
                },
            ],
        }
    )
    assert payload.items[1].answer in payload.items[1].options


def test_generated_mcq_rejects_duplicate_options() -> None:
    with pytest.raises(ValidationError):
        GeneratedPayload.model_validate(
            {
                "title": "Newton",
                "items": [
                    {
                        "kind": "mcq",
                        "prompt": "Unit of force?",
                        "answer": "Newton",
                        "options": ["Newton", "Newton", "Watt", "Pascal"],
                        "explanation": "Force is measured in newtons.",
                    }
                ],
            }
        )


def test_plan_payload_parses_json() -> None:
    raw = json.dumps(
        {
            "title": "Exam week",
            "tasks": [{"title": "Review notes", "day_offset": 0, "minutes": 30}],
        }
    )
    plan = PlanPayload.model_validate_json(raw)
    assert plan.tasks[0].day_offset == 0


def test_parse_json_object_accepts_fenced_and_noisy_payloads() -> None:
    fenced = parse_json_object('```json\n{"title":"Cells"}\n```')
    assert fenced["title"] == "Cells"
    noisy = parse_json_object('Sure.\n{"title":"Photosynthesis","items":[]}\nThanks!')
    assert noisy["title"] == "Photosynthesis"


def test_parse_json_object_rejects_empty_and_html() -> None:
    with pytest.raises(AIResponseError):
        parse_json_object("")
    with pytest.raises(AIResponseError):
        parse_json_object("<!DOCTYPE html><html></html>")


def test_tutor_draft_clears_placeholder_image_query() -> None:
    draft = TutorDraft.model_validate(
        {
            "reply": "Mitochondria make ATP because they run cellular respiration.",
            "image_query": "none",
        }
    )
    assert draft.image_query == ""
    pictured = TutorDraft.model_validate(
        {
            "reply": "A mitochondrion is the cell’s power station because it makes ATP.",
            "image_query": "  mitochondrion diagram  ",
        }
    )
    assert pictured.image_query == "mitochondrion diagram"
    web = TutorDraft.model_validate(
        {
            "reply": "That is not in the notes, so here is a trusted overview [1].",
            "origin": "internet",
            "sources": [1, 1, 0, 3],
        }
    )
    assert web.origin == "web"
    assert web.sources == [1, 3]
