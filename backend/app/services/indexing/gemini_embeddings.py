from __future__ import annotations

import logging
from math import sqrt

import httpx

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
EMBEDDING_BATCH_SIZE = 24


async def _embed_texts(api_key: str, texts: list[str], task_type: str) -> list[list[float]]:
    if not texts:
        return []

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            f"{EMBEDDING_API_BASE}/models/{EMBEDDING_MODEL}:embedContent",
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            json={
                "model": f"models/{EMBEDDING_MODEL}",
                "taskType": task_type,
                "content": {
                    "parts": [{"text": text} for text in texts],
                },
            },
        )

    logger.info(
        "Gemini embedding batch completed",
        extra={
            "task_type": task_type,
            "input_count": len(texts),
            "status_code": response.status_code,
        },
    )

    if response.status_code >= 400:
        raise RuntimeError(f"Embedding request failed: {response.text}")

    payload = response.json()
    if payload.get("embeddings"):
        return [embedding.get("values", []) for embedding in payload.get("embeddings", [])]

    if payload.get("embedding"):
        return [payload.get("embedding", {}).get("values", [])]

    return []


def _chunk_list(items: list[tuple], size: int) -> list[list[tuple]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


async def embed_query(api_key: str, question: str) -> list[float]:
    embeddings = await _embed_texts(api_key, [question], "QUESTION_ANSWERING")
    return embeddings[0] if embeddings else []


async def embed_chunk(api_key: str, title: str, section_path: str, text: str) -> list[float]:
    embedding_text = f"title: {title}\nsection: {section_path}\ntext: {text}"
    embeddings = await _embed_texts(api_key, [embedding_text], "RETRIEVAL_DOCUMENT")
    return embeddings[0] if embeddings else []


async def embed_chunks(
    api_key: str,
    items: list[tuple[str, str, str]],
) -> list[list[float]]:
    if not items:
        return []

    results: list[list[float]] = []
    for batch in _chunk_list(items, EMBEDDING_BATCH_SIZE):
        texts = [
            f"title: {title}\nsection: {section_path}\ntext: {text}"
            for title, section_path, text in batch
        ]
        embeddings = await _embed_texts(api_key, texts, "RETRIEVAL_DOCUMENT")
        results.extend(embeddings)

    return results


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0

    dot = sum(x * y for x, y in zip(a, b))
    mag_a = sqrt(sum(x * x for x in a))
    mag_b = sqrt(sum(y * y for y in b))
    if not mag_a or not mag_b:
        return 0.0
    return dot / (mag_a * mag_b)
