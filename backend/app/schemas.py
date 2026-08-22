import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.models import ContentType, DocumentStatus


class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    name: str


class UploadComplete(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    file_url: str
    file_key: str
    mime_type: str
    language: str = "English"


class DocumentView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    status: DocumentStatus
    language: str
    error: str | None
    created_at: datetime


class GenerationRequest(BaseModel):
    document_id: uuid.UUID
    title: str | None = None
    explanation_count: int = Field(3, ge=0, le=10)
    explanation_mode: Literal["count", "full"] = "count"
    mcq_count: int = Field(5, ge=0, le=300)
    flashcard_count: int = Field(5, ge=0, le=20)
    option_count: int = Field(4, ge=4, le=5)
    language: str = "English"
    focus: str | None = Field(None, max_length=300)

    @model_validator(mode="after")
    def at_least_one_item(self) -> "GenerationRequest":
        explanations_on = self.explanation_mode == "full" or self.explanation_count > 0
        if not explanations_on and self.mcq_count == 0 and self.flashcard_count == 0:
            raise ValueError("Select at least one output")
        return self


class GeneratedItem(BaseModel):
    kind: ContentType
    prompt: str = Field(min_length=4, max_length=800)
    answer: str = Field(min_length=1, max_length=8000)
    options: list[str] | None = None
    explanation: str | None = None

    @model_validator(mode="after")
    def quality_checks(self) -> "GeneratedItem":
        self.prompt = self.prompt.strip()
        self.answer = self.answer.strip()
        if self.kind == ContentType.MCQ:
            options = [option.strip() for option in (self.options or []) if option and option.strip()]
            if len(options) < 4:
                raise ValueError("Each quiz question needs at least 4 options")
            lowered = [option.lower() for option in options]
            if len(set(lowered)) != len(lowered):
                raise ValueError("Quiz options must be unique")
            if self.answer not in options:
                raise ValueError("The correct answer must appear in the options")
            self.options = options
            if not self.explanation or len(self.explanation.strip()) < 20:
                raise ValueError("Each quiz question needs a short explanation")
            self.explanation = self.explanation.strip()
        return self


class GeneratedPayload(BaseModel):
    title: str
    items: list[GeneratedItem]


class StudyItemView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    kind: ContentType
    position: int
    prompt: str
    answer: str
    options: list[str] | None
    explanation: str | None
    full_explanation: str | None = None


class StudySetView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    language: str
    created_at: datetime
    items: list[StudyItemView] = []
    explanation_count: int = 0
    flashcard_count: int = 0
    mcq_count: int = 0


class AnswerRequest(BaseModel):
    item_id: uuid.UUID
    selected_answer: str


class AnswerResult(BaseModel):
    is_correct: bool
    correct_answer: str
    explanation: str
    score: int
    answered: int


class QuizQuestionView(BaseModel):
    id: uuid.UUID
    prompt: str
    options: list[str]
    answer: str
    explanation: str | None = None


class AttemptStartView(BaseModel):
    id: uuid.UUID
    title: str
    questions: list[QuizQuestionView]


class QuizPaperView(BaseModel):
    title: str
    questions: list[QuizQuestionView]
    owned: bool = True


class QuizFinishRequest(BaseModel):
    answers: list[AnswerRequest] = Field(default_factory=list)


class FlashcardReviewRequest(BaseModel):
    confidence: int = Field(ge=1, le=3)


class VocabularyRequest(BaseModel):
    word: str = Field(min_length=2, max_length=100)
    context: str = Field(max_length=1000)


class VocabularyView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    word: str
    definition: str
    pronunciation: str | None = None
    example: str | None = None


class AttemptCreate(BaseModel):
    study_set_id: uuid.UUID


class PlanRequest(BaseModel):
    goal: str = Field(min_length=3, max_length=500)
    exam_date: date | None = None
    start_date: date | None = None
    minutes_per_day: int = Field(30, ge=10, le=240)


class BlankPlanRequest(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    start_date: date | None = None


class PlanTitleUpdate(BaseModel):
    title: str = Field(min_length=2, max_length=255)


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    due_date: date | None = None
    minutes: int = Field(20, ge=5, le=240)


class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    due_date: date | None = None
    minutes: int | None = Field(None, ge=5, le=240)


class TaskReorder(BaseModel):
    task_ids: list[uuid.UUID] = Field(min_length=1)


class OptionExplain(BaseModel):
    text: str
    correct: bool
    why: str = Field(min_length=8, max_length=800)


class FullExplainView(BaseModel):
    options: list[OptionExplain]


class FullWriteupView(BaseModel):
    explanation: str = Field(min_length=20, max_length=8000)


class AchievementCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    achieved_on: date | None = None


class CountdownCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    ends_on: date


class TutorRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    item_id: uuid.UUID | None = None


class TutorDraft(BaseModel):
    reply: str = Field(min_length=12, max_length=1400)
    image_query: str = Field("", max_length=80)
    origin: str = "notes"
    sources: list[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def clean_query(self) -> "TutorDraft":
        self.reply = self.reply.strip()
        query = self.image_query.strip().strip('"').strip("'")
        lowered = query.lower()
        if lowered in {"", "none", "n/a", "na", "no", "null"}:
            self.image_query = ""
        else:
            self.image_query = " ".join(query.split())[:80]
        origin = (self.origin or "notes").strip().lower()
        self.origin = "web" if origin in {"web", "internet", "external", "outsourced"} else "notes"
        seen: list[int] = []
        for number in self.sources:
            if 1 <= number <= 12 and number not in seen:
                seen.append(number)
        self.sources = seen[:6]
        return self


class TutorImage(BaseModel):
    url: str
    caption: str
    credit: str


class TutorCitation(BaseModel):
    n: int
    kind: str
    title: str = ""
    snippet: str = ""
    quote: str = ""
    page: int | None = None
    url: str | None = None


class TutorReply(BaseModel):
    reply: str
    image: TutorImage | None = None
    origin: str = "notes"
    citations: list[TutorCitation] = Field(default_factory=list)
    document_url: str | None = None
    document_title: str = ""
    mime_type: str = ""
    elapsed_ms: int = 0
