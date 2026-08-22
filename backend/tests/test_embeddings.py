from pathlib import Path

import pytest

from app.services.embeddings import resolve_embedding_source


def test_resolve_embedding_source_uses_hf_snapshot(tmp_path: Path) -> None:
    snapshot = tmp_path / "models--BAAI--bge-m3" / "snapshots" / "abc123"
    snapshot.mkdir(parents=True)
    (snapshot / "config.json").write_text("{}")
    ref = tmp_path / "models--BAAI--bge-m3" / "refs" / "main"
    ref.parent.mkdir(parents=True)
    ref.write_text("abc123\n")
    path = resolve_embedding_source("BAAI/bge-m3", cache_root=tmp_path, local_only=True)
    assert path == str(snapshot)


def test_resolve_embedding_source_uses_explicit_path(tmp_path: Path) -> None:
    model_dir = tmp_path / "local-bge"
    model_dir.mkdir()
    (model_dir / "config.json").write_text("{}")
    path = resolve_embedding_source(local_path=str(model_dir), local_only=True)
    assert path == str(model_dir)


def test_resolve_embedding_source_uses_hf_home(tmp_path: Path, monkeypatch) -> None:
    hub = tmp_path / "hub"
    snapshot = hub / "models--BAAI--bge-m3" / "snapshots" / "abc123"
    snapshot.mkdir(parents=True)
    (snapshot / "config.json").write_text("{}")
    ref = hub / "models--BAAI--bge-m3" / "refs" / "main"
    ref.parent.mkdir(parents=True)
    ref.write_text("abc123\n")
    monkeypatch.setenv("HF_HOME", str(tmp_path))
    monkeypatch.delenv("HUGGINGFACE_HUB_CACHE", raising=False)
    path = resolve_embedding_source("BAAI/bge-m3", local_only=True)
    assert path == str(snapshot)


def test_resolve_embedding_source_errors_when_missing(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="not found"):
        resolve_embedding_source("BAAI/bge-m3", cache_root=tmp_path, local_only=True)
