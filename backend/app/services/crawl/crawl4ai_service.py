from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timezone

from app.core.config import Settings, get_settings
from app.schemas.extract import ExtractRequest, ExtractResponse, ExtractResult, StructuredBlock
from app.services.crawl.content_normalizer import (
    html_to_blocks,
    html_to_text,
    looks_like_html,
    markdown_to_blocks,
    normalize_whitespace,
)
from app.services.indexing.chunker import chunk_structured_blocks
from app.services.storage.file_store import FileArtifactStore
from app.services.storage.sqlite_store import SQLiteMetadataStore

os.environ.setdefault(
    "CRAWL4_AI_BASE_DIRECTORY",
    str(get_settings().crawl4ai_base_dir),
)

from crawl4ai import AsyncWebCrawler, CrawlerRunConfig
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator

logger = logging.getLogger(__name__)


class ExtractorNotConfiguredError(RuntimeError):
    """Raised when the extraction backend is scaffolded but not fully configured yet."""


class ExtractionFailedError(RuntimeError):
    """Raised when Crawl4AI could not extract a usable document."""


def _make_document_id(url: str) -> str:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
    return f"doc_{digest}"


class Crawl4AIExtractor:
    """Thin adapter around Crawl4AI plus local persistence."""

    def __init__(
        self,
        settings: Settings | None = None,
        file_store: FileArtifactStore | None = None,
        metadata_store: SQLiteMetadataStore | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.file_store = file_store or FileArtifactStore(self.settings)
        self.metadata_store = metadata_store or SQLiteMetadataStore(self.settings)

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

        extract_result, raw_html = await self._crawl(payload)
        document_id = _make_document_id(extract_result.canonical_url)

        raw_html_path = self.file_store.save_raw_html(document_id, raw_html)
        self.file_store.save_raw_artifact(document_id, "rendered_markdown", extract_result.rendered_markdown)
        self.file_store.save_raw_artifact(document_id, "rendered_text", extract_result.rendered_text)
        self.file_store.save_raw_artifact(document_id, "clean_text", extract_result.clean_text)
        self.file_store.save_text(document_id, "full_text", extract_result.full_text)
        self.file_store.save_text(document_id, "rendered_markdown", extract_result.rendered_markdown)
        self.file_store.save_text(document_id, "rendered_text", extract_result.rendered_text)
        self.file_store.save_text(document_id, "clean_text", extract_result.clean_text)
        self.file_store.save_json(
            document_id,
            "structured_blocks",
            [block.model_dump() for block in extract_result.structured_blocks],
        )
        chunk_records = chunk_structured_blocks(extract_result.structured_blocks)
        self.file_store.save_json(
            document_id,
            "chunks",
            [
                {
                    "chunk_index": chunk.chunk_index,
                    "text": chunk.text,
                    "section_path": chunk.section_path,
                    "block_kinds": chunk.block_kinds,
                    "source_type": chunk.source_type,
                    "start_char": chunk.start_char,
                    "end_char": chunk.end_char,
                }
                for chunk in chunk_records
            ],
        )
        self.file_store.save_json(document_id, "metadata", extract_result.metadata)
        self.file_store.save_optional_snapshot(document_id, "dom_snapshot", payload.dom_text)
        self.file_store.save_optional_snapshot(document_id, "html_snapshot", payload.html_snapshot)

        processed_dir = self.file_store.document_dir(document_id)
        self.metadata_store.upsert_document(
            document_id=document_id,
            source_url=extract_result.source_url,
            canonical_url=extract_result.canonical_url,
            title=extract_result.title,
            content_type=extract_result.content_type,
            extractor=extract_result.extractor,
            raw_html_path=str(raw_html_path),
            processed_dir=str(processed_dir),
            char_count=len(extract_result.full_text),
            rendered_char_count=len(extract_result.rendered_text),
            clean_char_count=len(extract_result.clean_text),
            block_count=len(extract_result.structured_blocks),
            timestamp=extract_result.extracted_at,
        )
        self.metadata_store.replace_chunks(
            document_id=document_id,
            chunks=[
                {
                    "chunk_index": chunk.chunk_index,
                    "text": chunk.text,
                    "section_path": chunk.section_path,
                    "block_kinds": chunk.block_kinds,
                    "source_type": chunk.source_type,
                    "start_char": chunk.start_char,
                    "end_char": chunk.end_char,
                }
                for chunk in chunk_records
            ],
            timestamp=extract_result.extracted_at,
        )

        return build_extract_response(extract_result, document_id=document_id)

    async def _crawl(self, payload: ExtractRequest) -> tuple[ExtractResult, str]:
        config = CrawlerRunConfig(
            markdown_generator=DefaultMarkdownGenerator(),
            cache_mode="bypass",
            process_iframes=True,
            remove_overlay_elements=True,
            simulate_user=True,
            magic=True,
            scan_full_page=True,
            verbose=False,
            page_timeout=90000,
            delay_before_return_html=0.4,
        )

        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(str(payload.url), config=config)

        if not result.success:
            raise ExtractionFailedError(result.error_message or f"Failed to extract {payload.url}")

        canonical_url = result.redirected_url or result.url or str(payload.url)
        markdown_result = result.markdown
        raw_markdown = (
            markdown_result.raw_markdown
            if markdown_result and getattr(markdown_result, "raw_markdown", None)
            else ""
        )
        normalized_markdown = html_to_text(raw_markdown) if looks_like_html(raw_markdown) else normalize_whitespace(raw_markdown)
        normalized_cleaned_html = html_to_text(result.cleaned_html)
        normalized_extracted_content = normalize_whitespace(result.extracted_content)
        normalized_dom_text = normalize_whitespace(payload.dom_text)

        content_candidates = [
            normalized_dom_text,
            normalized_markdown,
            normalized_extracted_content,
            normalized_cleaned_html,
        ]
        full_text = max(content_candidates, key=len, default="")

        if len(full_text) < 80:
            raise ExtractionFailedError("Crawl4AI extracted too little readable text.")

        if looks_like_html(raw_markdown):
            blocks = html_to_blocks(raw_markdown)
        else:
            blocks = markdown_to_blocks(raw_markdown or full_text)
        metadata = result.metadata or {}

        extract_result = ExtractResult(
            source_url=str(payload.url),
            canonical_url=canonical_url,
            title=payload.title_hint or metadata.get("title") or canonical_url,
            raw_html=result.html or "",
            cleaned_html=result.cleaned_html or "",
            rendered_markdown=normalized_markdown or "",
            rendered_text=normalized_extracted_content or normalized_markdown or "",
            clean_text=normalized_cleaned_html or "",
            full_text=full_text,
            structured_blocks=blocks,
            extracted_at=datetime.now(timezone.utc),
            extractor="crawl4ai",
            notes=[
                "dom_text_preferred" if normalized_dom_text and normalized_dom_text == full_text else "crawl4ai_primary",
            ],
            metadata=metadata,
        )
        return extract_result, result.html or ""


def build_placeholder_result(payload: ExtractRequest) -> ExtractResult:
    """Helper kept around for tests and future scaffolding."""

    full_text = (payload.dom_text or payload.html_snapshot or "").strip()
    block = StructuredBlock(type="raw", text=full_text) if full_text else None

    return ExtractResult(
        source_url=str(payload.url),
        canonical_url=str(payload.url),
        title=payload.title_hint or str(payload.url),
        raw_html=payload.html_snapshot or "",
        cleaned_html="",
        rendered_markdown=full_text,
        rendered_text=full_text,
        clean_text=full_text,
        full_text=full_text,
        structured_blocks=[block] if block else [],
        extracted_at=datetime.now(timezone.utc),
        extractor="crawl4ai-placeholder",
        notes=["placeholder-result"],
        metadata={},
    )


def build_extract_response(result: ExtractResult, *, document_id: str | None = None) -> ExtractResponse:
    return ExtractResponse(
        document_id=document_id or _make_document_id(result.canonical_url),
        title=result.title,
        canonical_url=result.canonical_url,
        char_count=len(result.full_text),
        block_count=len(result.structured_blocks),
        rendered_char_count=len(result.rendered_text),
        clean_char_count=len(result.clean_text),
        extracted_at=result.extracted_at,
        extractor=result.extractor,
        notes=result.notes,
        preview=result.full_text[:280],
    )
