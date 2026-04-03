from __future__ import annotations

import json
import logging
from typing import Any

import httpx

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """
You are TabDog Chat backend.

Rules:
- Answer only from the provided evidence chunks.
- Never guess beyond the evidence.
- If the evidence is insufficient, say the answer cannot be verified from the selected tabs.
- Cite supporting chunk ids inline like [chunk-3].
""".strip()

VERIFIER_PROMPT = """
You are a strict evidence verifier.

Rules:
- Verify the draft answer only against the provided evidence chunks.
- Remove unsupported claims.
- Return JSON only.
""".strip()


def build_evidence_text(chunks: list[dict]) -> str:
    blocks = []
    for chunk in chunks:
        blocks.append(
            "\n".join(
                [
                    f"Chunk ID: {chunk['chunk_id']}",
                    f"Document ID: {chunk['document_id']}",
                    f"Title: {chunk['title']}",
                    f"Section: {chunk.get('section_path') or ''}",
                    f"Block kinds: {', '.join(chunk.get('block_kinds') or [])}",
                    "",
                    chunk["text"],
                ]
            )
        )
    return "\n\n---\n\n".join(blocks)


async def generate_answer(*, api_key: str, model: str, question: str, chunks: list[dict]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"{GEMINI_API_BASE}/models/{model}:generateContent",
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            json={
                "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 1200,
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [{
                            "text": "\n".join(
                                [
                                    "Evidence chunks:",
                                    build_evidence_text(chunks),
                                    "",
                                    f"Question: {question}",
                                ]
                            )
                        }],
                    }
                ],
            },
        )

    if response.status_code >= 400:
        raise RuntimeError(f"Gemini answer request failed: {response.text}")

    payload = response.json()
    logger.info(
        "Gemini answer response received",
        extra={
            "model": model,
            "status_code": response.status_code,
            "candidate_count": len(payload.get("candidates", [])),
            "chunk_count": len(chunks),
        },
    )
    text = "".join(
        part.get("text", "")
        for candidate in payload.get("candidates", [])
        for part in candidate.get("content", {}).get("parts", [])
    ).strip()

    return {
        "answer": text,
        "usage_metadata": payload.get("usageMetadata"),
    }


async def verify_answer(
    *,
    api_key: str,
    model: str,
    question: str,
    draft_answer: str,
    chunks: list[dict],
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"{GEMINI_API_BASE}/models/{model}:generateContent",
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            json={
                "systemInstruction": {"parts": [{"text": VERIFIER_PROMPT}]},
                "generationConfig": {
                    "temperature": 0,
                    "maxOutputTokens": 1200,
                    "responseMimeType": "application/json",
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [{
                            "text": "\n".join(
                                [
                                    "Evidence chunks:",
                                    build_evidence_text(chunks),
                                    "",
                                    f"Question: {question}",
                                    "",
                                    "Draft answer:",
                                    draft_answer,
                                    "",
                                    'Return JSON with keys: supported, answer, citations, missing_information',
                                ]
                            )
                        }],
                    }
                ],
            },
        )

    if response.status_code >= 400:
        raise RuntimeError(f"Gemini verifier request failed: {response.text}")

    payload = response.json()
    logger.info(
        "Gemini verifier response received",
        extra={
            "model": model,
            "status_code": response.status_code,
            "candidate_count": len(payload.get("candidates", [])),
            "chunk_count": len(chunks),
        },
    )
    text = "".join(
        part.get("text", "")
        for candidate in payload.get("candidates", [])
        for part in candidate.get("content", {}).get("parts", [])
    ).strip()

    if text.startswith("```json"):
        text = text.removeprefix("```json").removesuffix("```").strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Verifier returned invalid JSON: {text}") from error
