from app.config import Settings


def test_settings_strip_whitespace_from_secrets(monkeypatch) -> None:
    # A trailing newline in a copy-pasted secret (e.g. a Hugging Face Space
    # secret) is invisible in the UI but makes httpx raise
    # "Illegal header value" on every outbound AI request, which looks
    # exactly like the provider being unreachable. Regression test for that.
    monkeypatch.setenv("AI_API_KEY", "abc123\n")
    monkeypatch.setenv("JWT_SECRET", "x" * 40 + "  ")
    monkeypatch.setenv("AI_BASE_URL", "  https://example.com  ")
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:3000")
    monkeypatch.setenv("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
    monkeypatch.setenv("ENVIRONMENT", "test")

    settings = Settings()

    assert settings.ai_api_key == "abc123"
    assert settings.jwt_secret == "x" * 40
    assert settings.ai_base_url == "https://example.com/v1"
