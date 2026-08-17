import uuid
from datetime import date, datetime

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
    mcq_count: int = Field(5, ge=0, le=20)
    flashcard_count: int = Field(5, ge=0, le=20)
    option_count: int = Field(4, ge=4, le=5)
    language: str = "English"

    @model_validator(mode="after")
    def at_least_one_item(self) -> "GenerationRequest":
        if self.explanation_count + self.mcq_count + self.flashcard_count == 0:
            raise ValueError("Select at least one output")
        return self


class GeneratedItem(BaseModel):
    kind: ContentType
    prompt: str
    answer: str
    options: list[str] | None = None
    explanation: str | None = None


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


class StudySetView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    language: str
    created_at: datetime
    items: list[StudyItemView]


class AnswerRequest(BaseModel):
    item_id: uuid.UUID
    selected_answer: str


class AnswerResult(BaseModel):
    is_correct: bool
    correct_answer: str
    explanation: str
    score: int
    answered: int


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
    minutes_per_day: int = Field(30, ge=10, le=240)
