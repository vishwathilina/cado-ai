import base64
import json
import re
from datetime import date

from openai import APIError, APIStatusError, AsyncOpenAI
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.schemas import (
    FullExplainView,
    FullWriteupView,
    GeneratedPayload,
    TutorDraft,
    VocabularyView,
)


class PlanTaskPayload(BaseModel):
    title: str
    day_offset: int
    minutes: int


class PlanPayload(BaseModel):
    title: str
    tasks: list[PlanTaskPayload]


class AIResponseError(RuntimeError):
    """The model returned nothing we can turn into study content."""


def parse_json_object(content: str) -> dict:
    stripped = (content or "").strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped, flags=re.IGNORECASE)
        stripped = re.sub(r"\s*```$", "", stripped)
    candidates = [stripped]
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start >= 0 and end > start:
        candidates.append(stripped[start : end + 1])
    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed
    raise AIResponseError(
        "The study model did not return JSON. Check AI_BASE_URL ends with /v1 and AI_MODEL is a chat model."
    )


def _describe_api_error(exc: Exception) -> str:
    """Surface the real network/TLS/DNS cause instead of the SDK's generic message."""
    cause = exc.__cause__
    if cause is not None and str(cause) and str(cause) != str(exc):
        return f"{exc} ({type(cause).__name__}: {cause})"
    return str(exc)


def _message_text(message) -> str:
    content = getattr(message, "content", None)
    if isinstance(content, str) and content.strip():
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and part.get("text"):
                parts.append(str(part["text"]))
            else:
                text = getattr(part, "text", None)
                if text:
                    parts.append(str(text))
        joined = "".join(parts).strip()
        if joined:
            return joined
    for attr in ("refusal", "reasoning", "reasoning_content"):
        extra = getattr(message, attr, None)
        if isinstance(extra, str) and extra.strip().startswith("{"):
            return extra
    return ""


class AIService:
    def __init__(self) -> None:
        self.client = AsyncOpenAI(
            api_key=settings.ai_api_key or "not-configured",
            base_url=settings.ai_base_url,
            timeout=180.0,
        )

    def _create_kwargs(self, max_tokens: int | None = None) -> dict:
        extra: dict = {}
        if max_tokens:
            extra["max_tokens"] = max_tokens
        if "ollama" in settings.ai_base_url:
            body: dict = {"think": False}
            if max_tokens:
                body["num_predict"] = max_tokens
            extra["extra_body"] = body
        return extra

    async def _complete(
        self,
        system: str,
        user: str,
        *,
        json_mode: bool,
        temperature: float = 0.3,
        max_tokens: int | None = None,
    ) -> str:
        payload = {
            "model": settings.ai_model,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            **self._create_kwargs(max_tokens),
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        try:
            response = await self.client.chat.completions.create(**payload)
        except APIStatusError as exc:
            body = exc.response.text[:300] if exc.response is not None else str(exc)
            if json_mode:
                return await self._complete(
                    system,
                    user,
                    json_mode=False,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            raise AIResponseError(
                f"The study model rejected the request ({exc.status_code}). {body}"
            ) from exc
        except APIError as exc:
            if json_mode:
                return await self._complete(
                    system,
                    user,
                    json_mode=False,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            raise AIResponseError(
                f"The study model is unavailable: {_describe_api_error(exc)}"
            ) from exc
        if not response.choices:
            raise AIResponseError("The study model returned no choices.")
        return _message_text(response.choices[0].message)

    async def _json(
        self,
        system: str,
        user: str,
        schema: type[BaseModel],
        *,
        temperature: float = 0.3,
        max_tokens: int | None = None,
    ) -> BaseModel:
        if not settings.ai_api_key:
            raise AIResponseError("AI_API_KEY is not configured")
        content = await self._complete(
            system, user, json_mode=True, temperature=temperature, max_tokens=max_tokens
        )
        if not content.strip():
            content = await self._complete(
                system, user, json_mode=False, temperature=temperature, max_tokens=max_tokens
            )
        if not content.strip():
            raise AIResponseError(
                "The study model returned an empty reply. Confirm AI_BASE_URL is https://ollama.com/v1 "
                "(or your provider’s /v1 URL) and that AI_MODEL is available."
            )
        try:
            return schema.model_validate(parse_json_object(content))
        except ValidationError as exc:
            # One automatic retry without json_mode — often fixes shape issues with smaller models
            try:
                retry = await self._complete(system, user, json_mode=False, temperature=temperature, max_tokens=max_tokens)
                if retry.strip():
                    return schema.model_validate(parse_json_object(retry))
            except Exception:
                pass
            raise AIResponseError("The study model returned JSON in the wrong shape. Try generate again.") from exc

    async def generate_study_set(
        self,
        context: str,
        language: str,
        explanation_count: int,
        mcq_count: int,
        flashcard_count: int,
        option_count: int,
        explanation_style: str = "count",
        avoid_prompts: list[str] | None = None,
    ) -> GeneratedPayload:
        explanation_rule = (
            "answer: 2-4 short sentences, short-note style, concise definition plus key point plus example if needed. Keep plain sentences, no bullet hyphens. Together all explanations must cover the whole document from start to finish in order, like A-Z short notes for the entire syllabus (every major heading and idea)"
            if explanation_style == "full"
            else "answer: 3–6 sentences that teach the idea clearly, using terms from SOURCE"
        )
        avoid = ""
        if avoid_prompts:
            listed = "; ".join(avoid_prompts[:40])
            avoid = f"\nDo not repeat these quiz questions: {listed}\n"
        prompt = f"""
Create a study set in {language}. Use SOURCE only. If SOURCE does not support a question, skip that idea — never invent facts.

High quality, easy to learn. Every item must be crystal-clear, beginner-friendly, and match ideas in SOURCE. Use simple language, short sentences, and a concrete example where it helps memory. Avoid jargon without definition.

{avoid}
Return JSON only with this exact shape:
{{"title":"...","items":[{{"kind":"explanation","prompt":"...","answer":"...","imageSearchQuery":"..."}},{{"kind":"flashcard","prompt":"...","answer":"..."}},{{"kind":"mcq","prompt":"...","answer":"...","options":["a","b","c","d"],"explanation":"..."}}]}}
- for kind=explanation: use prompt, answer, and imageSearchQuery (2-6 words, neutral visual concept for Google Images, e.g. "mitochondrion diagram", "ancient library interior", "person reading by window" — no logos, no text, safe for school)
- for kind=flashcard: use only prompt and answer
- for kind=mcq: use prompt, answer, options, explanation

Counts (aim for these; never invent extra kinds):
- {explanation_count} explanations
- {mcq_count} MCQs
- {flashcard_count} flashcards
If SOURCE is thin, return fewer items of a kind rather than padding. Do not add a kind whose count is 0.

Explanations (most important for easy learning):
- prompt: a short heading for the idea (3-8 words) — when style is "full", order prompts logically start to finish so they read as A-Z short notes for the whole document
- {explanation_rule}
- imageSearchQuery: 2-6 words, neutral visual scene that matches the explanation and would make a good Google Images result (e.g. "cell division phases diagram", "photosynthesis light reaction illustration"). Keep generic, safe, no brand names.

Flashcards:
- one fact per card
- prompt: a question or cue (not a long paragraph)
- answer: a short, precise back

MCQs (this is the most important part):
- each prompt is a complete question that tests understanding, not a copied sentence with a blank
- mix recall and “why / which / what happens if” questions when SOURCE supports it
- cover different ideas; do not repeat the same fact
- exactly {option_count} options, all unique, similar length
- the correct answer appears verbatim in options
- distractors are plausible mistakes from the same topic (nearby terms, common mix-ups in SOURCE) — not jokes, not obviously wrong
- never use “all of the above”, “none of the above”, or double negatives
- explanation: 1–3 sentences that say why the answer is right and why a tempting wrong option is wrong

SOURCE:
{context}
"""
        result = await self._json(
            "You are Cado AI, a careful exam writer. Prefer fewer sharp questions over vague ones. Output valid JSON only.",
            prompt,
            GeneratedPayload,
            temperature=0.25,
            max_tokens=8000 if explanation_style == "full" or mcq_count >= 8 else 4000,
        )
        return GeneratedPayload.model_validate(result)

    async def explain_options(
        self,
        prompt: str,
        options: list[str],
        answer: str,
        explanation: str,
    ) -> list[dict]:
        result = await self._json(
            "Explain every multiple-choice option for a student. JSON only.",
            f"""
Question: {prompt}
Correct answer: {answer}
Short explanation: {explanation or "(none)"}
Options: {options}

Return JSON {{"options":[{{"text":"...","correct":true,"why":"2–4 sentences"}}]}}
Include every option verbatim in text. correct is true only for the right answer.
why says why that option is right or why it is tempting but wrong.
""",
            FullExplainView,
            temperature=0.2,
        )
        viewed = FullExplainView.model_validate(result)
        return [item.model_dump() for item in viewed.options]

    async def expand_explanation(self, heading: str, short: str) -> str:
        result = await self._json(
            "Expand a short study note into a full explanation. JSON only.",
            f"""
Heading: {heading}
Short explanation: {short}
Return JSON {{"explanation":"8–14 sentences that teach this idea fully, with definition, how it works, and an example. Do not invent facts beyond the short text."}}
""",
            FullWriteupView,
            temperature=0.2,
        )
        return FullWriteupView.model_validate(result).explanation

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

    async def tutor_reply(
        self,
        question: str,
        source: str,
        focus: str = "",
        domain: str = "general",
        web: str = "",
    ) -> TutorDraft:
        if web:
            origin_rule = (
                "The student's notes do not cover this. "
                "If WEB clearly answers the question, use it and cite [1], [2] matching WEB numbers. "
                "Prefer GeeksforGeeks, Programiz, W3Schools, Khan Academy, Britannica, Google overview, and similar teaching pages. "
                "Use Wikipedia only if those do not cover it. "
                "If WEB is empty, a JavaScript wall, or off-topic (random biographies, songs, unrelated people), "
                "ignore it and answer from general tutoring knowledge. Do not mention missing websites. "
                "origin must be \"web\". sources is [] if you did not use WEB."
            )
            material = f"WEB:\n{web}"
        else:
            origin_rule = (
                "If SOURCE clearly answers the question, origin is \"notes\" and cite [1], [2] using SOURCE numbers. "
                "If SOURCE does not cover it, origin is \"web\", sources is [], and the reply should say you will use trusted websites."
            )
            material = f"SOURCE:\n{source}"
        prompt = f"""
A student is studying. Answer as Cado. Be a clear tutor, not a cheerleader.

Rules:
- {origin_rule}
- Answer the question they asked. Ignore SOURCE/WEB that is off-topic.
- Do not greet. Do not say “hey there”, “you've got this”, “keep going”, or similar pep talk.
- Do not bring in extra topics (Docker, Kubernetes, CoreOS, cloud) unless the question or the cited passage is about them.
- Teach with “because…”. Do not copy sentences.
- 40–70 words. Short sentences. No markdown headings.
- Put citation markers like [1] right after the claim they support.
- image_query: 2–6 words for a labeled diagram ONLY if they asked for a picture/diagram; otherwise empty.
- sources: the SOURCE/WEB numbers you actually used.

Return JSON only:
{{"reply":"...","image_query":"...","origin":"notes|web","sources":[1]}}

FOCUS (current card, may be empty):
{focus or "(none)"}

QUESTION:
{question}

{material}
"""
        result = await self._json(
            "You are Cado AI. Concise study answers only. No pep talk. JSON only.",
            prompt,
            TutorDraft,
            temperature=0.2,
            max_tokens=260,
        )
        return TutorDraft.model_validate(result)

    async def ping(self) -> str:
        """Cheap end-to-end call used by diagnostics to prove AI_BASE_URL/AI_API_KEY/AI_MODEL work."""
        if not settings.ai_api_key:
            raise AIResponseError("AI_API_KEY is not configured")
        content = await self._complete(
            "Reply with exactly one word: OK",
            "Reply with exactly one word: OK",
            json_mode=False,
            temperature=0,
            max_tokens=5,
        )
        if not content.strip():
            raise AIResponseError("The study model returned an empty reply")
        return content.strip()[:80]

    async def transcribe_image(self, data: bytes, mime_type: str) -> str:
        if not settings.ai_api_key:
            raise AIResponseError("AI_API_KEY is not configured")
        encoded = base64.b64encode(data).decode("ascii")
        payload = {
            "model": settings.ai_model,
            "temperature": 0,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You transcribe student notes from a photo. Return only the readable text, "
                        "keeping headings and lists. If there is no text, say so in one sentence."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Transcribe all study notes in this image."},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{encoded}"},
                        },
                    ],
                },
            ],
            **self._create_kwargs(),
        }
        try:
            response = await self.client.chat.completions.create(**payload)
        except (APIStatusError, APIError) as exc:
            raise AIResponseError(
                "This image could not be read. Install Tesseract, or use a vision-capable AI_MODEL. "
                f"({_describe_api_error(exc)})"
            ) from exc
        if not response.choices:
            raise AIResponseError("The study model returned no transcription.")
        text = _message_text(response.choices[0].message).strip()
        if not text:
            raise AIResponseError("The study model returned an empty transcription.")
        return text


ai_service = AIService()
