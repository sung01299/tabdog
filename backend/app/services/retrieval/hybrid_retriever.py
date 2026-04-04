from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "i", "in",
    "is", "it", "of", "on", "or", "that", "the", "this", "to", "was", "what", "when",
    "where", "which", "who", "why", "with", "you", "your",
}
NOISE_KEYWORDS = {
    "최근글",
    "인기글",
    "관련글",
    "태그",
    "댓글",
    "방명록",
    "분류 전체보기",
    "공지사항",
    "전체 방문자",
    "좋아요",
    "공유하기",
    "저작자표시",
    "반응형",
    "카테고리의 다른 글",
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


def chunk_key(chunk: dict) -> str:
    return f"{chunk['document_id']}:{chunk['chunk_index']}"


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

    if is_noise_chunk(chunk):
        score -= 16

    return score


def is_noise_chunk(chunk: dict) -> bool:
    haystacks = [
        (chunk.get("section_path") or "").lower(),
        (chunk.get("title") or "").lower(),
        (chunk.get("text") or "").lower()[:800],
    ]

    keyword_hits = 0
    for keyword in NOISE_KEYWORDS:
        lowered = keyword.lower()
        if any(lowered in haystack for haystack in haystacks):
            keyword_hits += 1

    link_count = (chunk.get("text") or "").count("](")
    image_count = (chunk.get("text") or "").count("![](")
    return keyword_hits > 0 or link_count >= 6 or image_count >= 3


def retrieve_chunks(
    *,
    question: str,
    chunks: list[dict],
    vector_scores: dict[str, float] | None = None,
    max_chunks: int = 10,
) -> list[dict]:
    question_tokens = tokenize(question)
    lexical_candidates = []

    for chunk in chunks:
        lexical = lexical_score(question_tokens, chunk)
        lexical_candidates.append({
            "chunk": chunk,
            "lexical": lexical,
        })

    lexical_candidates.sort(key=lambda item: item["lexical"], reverse=True)
    top_lexical_ids = {
        chunk_key(item["chunk"])
        for item in lexical_candidates[: max(20, max_chunks * 4)]
        if item["lexical"] > 0
    }
    dense_candidate_ids = set((vector_scores or {}).keys())
    candidate_ids = top_lexical_ids | dense_candidate_ids
    candidate_chunks = [
        chunk for chunk in chunks
        if (
            (not candidate_ids or chunk_key(chunk) in candidate_ids)
            and not (is_noise_chunk(chunk) and lexical_score(question_tokens, chunk) < 8)
        )
    ]

    scored = []

    for chunk in candidate_chunks:
        lexical = lexical_score(question_tokens, chunk)
        rerank = rerank_score(question, question_tokens, chunk)
        embedding = (vector_scores or {}).get(chunk_key(chunk), 0.0)

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
            "candidate_count": len(candidate_chunks),
            "selected_count": len(selected),
            "noise_filtered_count": len(chunks) - len(candidate_chunks),
            "chunk_indexes": [item["chunk_index"] for item in selected],
        },
    )
    return selected
