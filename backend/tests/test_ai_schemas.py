import json

from app.schemas import GeneratedPayload
from app.services.ai import PlanPayload


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


def test_plan_payload_parses_json() -> None:
    raw = json.dumps(
        {
            "title": "Exam week",
            "tasks": [{"title": "Review notes", "day_offset": 0, "minutes": 30}],
        }
    )
    plan = PlanPayload.model_validate_json(raw)
    assert plan.tasks[0].day_offset == 0
