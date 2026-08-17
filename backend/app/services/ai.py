import json
from datetime import date

from openai import AsyncOpenAI
from pydantic import BaseModel

from app.config import settings
from app.schemas import GeneratedPayload, VocabularyView


class PlanTaskPayload(BaseModel):
    title: str
    day_offset: int
    minutes: int


class PlanPayload(BaseModel):
    title: str
    tasks: list[PlanTaskPayload]


class AIService:
    def __init__(self) -> None:
        self.client = AsyncOpenAI(api_key=settings.ai_api_key or "not-configured", base_url=settings.ai_base_url)

    async def _json(self, system: str, user: str, schema: type[BaseModel]) -> BaseModel:
        if not settings.ai_api_key:
            raise RuntimeError("AI_API_KEY is not configured")
        response = await self.client.chat.completions.create(
            model=settings.ai_model,
            temperature=0.35,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        content = response.choices[0].message.content
        if not content:
            raise RuntimeError("The AI provider returned an empty response")
        return schema.model_validate(json.loads(content))

    async def generate_study_set(
        self,
        context: str,
        language: str,
        explanation_count: int,
        mcq_count: int,
        flashcard_count: int,
        option_count: int,
    ) -> GeneratedPayload:
        prompt = f"""
Create a study set in {language}, grounded only in SOURCE.
Return JSON matching:
{{"title":"...", "items":[{{"kind":"explanation|mcq|flashcard","prompt":"...",
"answer":"...","options":["..."],"explanation":"..."}}]}}
Create exactly {explanation_count} explanations, {mcq_count} MCQs, and
{flashcard_count} flashcards. Each MCQ must have exactly {option_count} unique options,
include its answer verbatim among those options, and briefly explain the reasoning.
For explanations, prompt is a short heading and answer is a concise explanation.
For flashcards, prompt is the front and answer is the back. Never invent facts.

SOURCE:
{context}
"""
        result = await self._json(
            "You are Cado AI, a precise and encouraging study assistant. Output valid JSON only.",
            prompt,
            GeneratedPayload,
        )
        return GeneratedPayload.model_validate(result)

    async def define_word(self, word: str, context: str) -> VocabularyView:
        result = await self._json(
            "Explain English vocabulary for a student. Output valid JSON only.",
            f"""
Define \"{word}\" as used in this context: {context}
Return {{"word":"...","definition":"plain English","pronunciation":"...",
"example":"a short new example sentence"}}.
""",
            VocabularyView,
        )
        return VocabularyView.model_validate(result)

    async def create_plan(
        self, goal: str, exam_date: date | None, minutes_per_day: int
    ) -> PlanPayload:
        result = await self._json(
            "Design realistic student study plans. Output valid JSON only.",
            f"""
Goal: {goal}
Exam date: {exam_date or "not specified"}
Daily time: {minutes_per_day} minutes
Return JSON {{"title":"...", "tasks":[{{"title":"...", "day_offset":0,
"minutes":{minutes_per_day}}}]}} with 7 focused tasks. day_offset must be 0 through 6.
""",
            PlanPayload,
        )
        return PlanPayload.model_validate(result)


ai_service = AIService()
