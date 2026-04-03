from __future__ import annotations

import logging
import re

from app.services.indexing.gemini_embeddings import cosine_similarity

logger = logging.getLogger(__name__)

STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "i", "in",
    "is", "it", "of", "on", "or", "that", "the", "this", "to", "was", "what", "when",
    "where", "which", "who", "why", "with", "you", "your",
}


def tokenize(text: str) -> list[str]:
    return [
        token.strip()
        for token in re.split(r"[^a-z0-9]+", (text or "").lower())
        if len(token.strip()) >= 2 and token.strip() not in STOP_WORDS
    ]


def lexical_score(question_tokens: list[str], chunk: dict) -> float:
    chunk_text = (chunk.get("text") or "").lower()
    title = (chunk.get("title") or "").lower()
    score = 0.0

    for token in question_tokens:
        if token in chunk_text:
            score += 4
        if token in title:
            score += 2
        if re.search(rf"\b{re.escape(token)}\b", chunk_text):
            score += 2

    return score


def rerank_score(question: str, question_tokens: list[str], chunk: dict) -> float:
    score = lexical_score(question_tokens, chunk)
    section_path = (chunk.get("section_path") or "").lower()
    block_kinds = chunk.get("block_kinds") or []
    lower_question = question.lower()

    for token in question_tokens:
        if token in section_path:
            score += 4

    if "table" in lower_question and "table" in block_kinds:
        score += 8
    if "code" in lower_question and "code" in block_kinds:
        score += 8
    if "compare" in lower_question and "heading" in block_kinds:
        score += 4

    return score


def retrieve_chunks(
    *,
    question: str,
    chunks: list[dict],
    query_embedding: list[float] | None = None,
    max_chunks: int = 10,
) -> list[dict]:
    question_tokens = tokenize(question)
    scored = []

    for chunk in chunks:
        lexical = lexical_score(question_tokens, chunk)
        rerank = rerank_score(question, question_tokens, chunk)
        embedding = 0.0
        if query_embedding and chunk.get("embedding"):
            embedding = cosine_similarity(query_embedding, chunk["embedding"])

        hybrid = rerank + (embedding * 24)
        scored.append({
            **chunk,
            "_lexical_score": lexical,
            "_rerank_score": rerank,
            "_embedding_score": embedding,
            "_hybrid_score": hybrid,
        })

    scored.sort(key=lambda item: item["_hybrid_score"], reverse=True)
    selected = scored[:max_chunks]
    logger.info(
        "Retrieved chunks",
        extra={
            "question": question,
            "selected_count": len(selected),
            "chunk_indexes": [item["chunk_index"] for item in selected],
        },
    )
    return selected
