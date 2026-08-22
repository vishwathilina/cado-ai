import asyncio
import os
from functools import lru_cache
from pathlib import Path

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from app.config import settings


def _hub_cache(cache_root: Path | None = None) -> Path:
    if cache_root:
        return cache_root
    hub = os.environ.get("HUGGINGFACE_HUB_CACHE")
    if hub:
        return Path(hub).expanduser()
    hf_home = os.environ.get("HF_HOME")
    if hf_home:
        return Path(hf_home).expanduser() / "hub"
    return Path.home() / ".cache/huggingface/hub"


def resolve_embedding_source(
    model_id: str = settings.embedding_model,
    local_path: str = "",
    local_only: bool = True,
    cache_root: Path | None = None,
) -> str:
    if local_path:
        path = Path(local_path).expanduser()
        if not path.exists():
            raise RuntimeError(f"EMBEDDING_LOCAL_PATH does not exist: {path}")
        return str(path)
    cache = _hub_cache(cache_root) / f"models--{model_id.replace('/', '--')}"
    ref = cache / "refs" / "main"
    if ref.is_file():
        revision = ref.read_text().strip().splitlines()[0].strip()
        snapshot = cache / "snapshots" / revision
        if snapshot.exists() and (snapshot / "config.json").exists():
            return str(snapshot)
    if local_only:
        raise RuntimeError(
            f"Local {model_id} was not found in {cache}. "
            "Download it once on this machine, then restart the API."
        )
    return model_id


def _device() -> str:
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


@lru_cache
def _model():
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise RuntimeError(
            "Install the backend with the 'embeddings' extra to use BGE-M3"
        ) from exc
    source = resolve_embedding_source(
        settings.embedding_model,
        settings.embedding_local_path,
        settings.embedding_local_only,
    )
    return SentenceTransformer(source, device=_device(), local_files_only=True)


async def warm_embeddings() -> None:
    await asyncio.to_thread(_model)


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    def encode() -> list[list[float]]:
        vectors = _model().encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
            batch_size=8,
        )
        return vectors.tolist()

    return await asyncio.to_thread(encode)
