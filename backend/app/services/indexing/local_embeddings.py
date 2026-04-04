from __future__ import annotations

import asyncio
import logging
import os
from functools import lru_cache

from sentence_transformers import SentenceTransformer

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _prepare_text(title: str, section_path: str, text: str, *, is_query: bool) -> str:
    prefix = "query" if is_query else "passage"
    parts = [f"{prefix}: {text.strip()}"]

    if title.strip():
        parts.append(f"title: {title.strip()}")
    if section_path.strip():
        parts.append(f"section: {section_path.strip()}")

    return "\n".join(parts)


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    settings = get_settings()
    os.environ.setdefault("HF_HOME", str(settings.huggingface_home))
    os.environ.setdefault("HF_HUB_CACHE", str(settings.huggingface_home))
    logger.info(
        "Loading local embedding model",
        extra={
            "model_name": settings.local_embedding_model,
            "huggingface_home": str(settings.huggingface_home),
        },
    )
    return SentenceTransformer(settings.local_embedding_model)


async def warmup_embedding_model() -> None:
    model = get_embedding_model()
    await asyncio.to_thread(
        model.encode,
        ["query: warmup", "passage: warmup"],
        normalize_embeddings=True,
    )
    logger.info("Local embedding model warmup complete")


async def embed_query_local(question: str) -> list[float]:
    model = get_embedding_model()
    text = _prepare_text("", "", question, is_query=True)
    vector = await asyncio.to_thread(model.encode, text, normalize_embeddings=True)
    return vector.tolist()


async def embed_chunks_local(items: list[tuple[str, str, str]]) -> list[list[float]]:
    if not items:
        return []

    model = get_embedding_model()
    texts = [
        _prepare_text(title, section_path, text, is_query=False)
        for title, section_path, text in items
    ]
    vectors = await asyncio.to_thread(model.encode, texts, normalize_embeddings=True)
    return [vector.tolist() for vector in vectors]
