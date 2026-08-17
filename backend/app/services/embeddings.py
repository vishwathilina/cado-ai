import asyncio
from functools import lru_cache

from app.config import settings


@lru_cache
def _model():
    try:
        from fastembed import TextEmbedding
    except ImportError as exc:
        raise RuntimeError(
            "Install the backend with the 'embeddings' extra to encode notes"
        ) from exc
    return TextEmbedding(model_name=settings.embedding_model)


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    def encode() -> list[list[float]]:
        return [list(map(float, vector)) for vector in _model().embed(texts)]

    return await asyncio.to_thread(encode)
