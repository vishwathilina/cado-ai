import re
from datetime import UTC, date, datetime, timedelta


def chunk_text(text: str, size: int = 1200, overlap: int = 180) -> list[str]:
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(start + size, len(normalized))
        if end < len(normalized):
            boundary = normalized.rfind(" ", start + size // 2, end)
            if boundary > start:
                end = boundary
        chunks.append(normalized[start:end].strip())
        if end == len(normalized):
            break
        start = max(end - overlap, start + 1)
    return chunks


def calculate_streak(days: list[date], today: date | None = None) -> int:
    unique = set(days)
    current = today or date.today()
    if current not in unique and current - timedelta(days=1) in unique:
        current -= timedelta(days=1)
    streak = 0
    while current in unique:
        streak += 1
        current -= timedelta(days=1)
    return streak


def as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)
