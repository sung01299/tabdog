from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone

from app.schemas.extract import ExtractRequest, ExtractResponse, ExtractResult, StructuredBlock

logger = logging.getLogger(__name__)


class ExtractorNotConfiguredError(RuntimeError):
    """Raised when the extraction backend is scaffolded but not fully configured yet."""


def _make_document_id(url: str) -> str:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
    return f"doc_{digest}"


class Crawl4AIExtractor:
    """Thin adapter around Crawl4AI.

    In this first backend slice we intentionally keep the implementation shallow:
    - validate the request shape
    - provide a deterministic response contract
    - leave the actual Crawl4AI browser extraction for the next slice
    """

    async def extract(self, payload: ExtractRequest) -> ExtractResponse:
        logger.info(
            "Received extraction request",
            extra={
                "url": str(payload.url),
                "conversation_id": payload.conversation_id,
                "tab_id": payload.tab_id,
                "has_html_snapshot": bool(payload.html_snapshot),
                "has_dom_text": bool(payload.dom_text),
            },
        )

        raise ExtractorNotConfiguredError(
            "Crawl4AI extraction is scaffolded but not implemented yet. "
            "Next step: wire the renderer/extractor and persist raw + processed outputs."
        )


def build_placeholder_result(payload: ExtractRequest) -> ExtractResult:
    """Helper kept around for tests and future scaffolding."""

    full_text = (payload.dom_text or payload.html_snapshot or "").strip()
    block = StructuredBlock(type="raw", text=full_text) if full_text else None

    return ExtractResult(
        source_url=str(payload.url),
        canonical_url=str(payload.url),
        title=payload.title_hint or str(payload.url),
        markdown=full_text,
        full_text=full_text,
        structured_blocks=[block] if block else [],
        extracted_at=datetime.now(timezone.utc),
        extractor="crawl4ai-placeholder",
        notes=["placeholder-result"],
    )


def build_extract_response(result: ExtractResult) -> ExtractResponse:
    return ExtractResponse(
        document_id=_make_document_id(result.canonical_url),
        title=result.title,
        canonical_url=result.canonical_url,
        char_count=len(result.full_text),
        block_count=len(result.structured_blocks),
        extracted_at=result.extracted_at,
        extractor=result.extractor,
        notes=result.notes,
        preview=result.full_text[:280],
    )
