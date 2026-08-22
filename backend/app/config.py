from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(value: str) -> str:
    if not value or value.startswith("sqlite"):
        return value
    if value.startswith("postgresql://"):
        value = "postgresql+asyncpg://" + value.removeprefix("postgresql://")
    elif value.startswith("postgres://"):
        value = "postgresql+asyncpg://" + value.removeprefix("postgres://")
    parts = urlsplit(value)
    query: list[tuple[str, str]] = []
    for key, item in parse_qsl(parts.query, keep_blank_values=True):
        if key == "channel_binding":
            continue
        if key == "sslmode":
            query.append(("ssl", "require" if item in {"require", "verify-full", "verify-ca"} else item))
            continue
        query.append((key, item))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/cado"
    frontend_url: str = "http://localhost:3000"
    jwt_secret: str = Field("development-only-change-this-secret", min_length=32)
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    cookie_secure: bool = False
    ai_base_url: str = "https://api.openai.com/v1"
    ai_api_key: str = ""
    ai_model: str = "gpt-4o-mini"
    embedding_model: str = "BAAI/bge-m3"
    embedding_dimensions: int = 1024
    embedding_local_path: str = ""
    embedding_local_only: bool = True
    uploadthing_token: str = ""
    max_upload_mb: int = 25

    @field_validator("ai_base_url")
    @classmethod
    def openai_v1_prefix(cls, value: str) -> str:
        trimmed = value.rstrip("/")
        if trimmed.endswith("/v1"):
            return trimmed
        return f"{trimmed}/v1"

    @field_validator("database_url")
    @classmethod
    def asyncpg_url(cls, value: str) -> str:
        return normalize_database_url(value)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
