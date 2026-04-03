from datetime import datetime, timezone
from typing import Literal

from pydantic import AnyHttpUrl, BaseModel, Field


class ExtractRequest(BaseModel):
    url: AnyHttpUrl
    conversation_id: str | None = None
    tab_id: str | None = None
    title_hint: str | None = None
    html_snapshot: str | None = None
    dom_text: str | None = None


class StructuredBlock(BaseModel):
    type: Literal[
        "heading",
        "paragraph",
        "list",
        "table",
        "code",
        "blockquote",
        "raw",
    ]
    text: str
    heading_level: int | None = None
    heading_text: str | None = None


class ExtractResult(BaseModel):
    source_url: str
    canonical_url: str
    title: str
    content_type: str = "text/html"
    raw_html: str = ""
    cleaned_html: str = ""
    rendered_markdown: str = ""
    rendered_text: str = ""
    clean_text: str = ""
    full_text: str
    structured_blocks: list[StructuredBlock] = Field(default_factory=list)
    extracted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    extractor: str
    notes: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class ExtractResponse(BaseModel):
    document_id: str
    title: str
    canonical_url: str
    char_count: int
    block_count: int
    rendered_char_count: int
    clean_char_count: int
    extracted_at: datetime
    extractor: str
    notes: list[str] = Field(default_factory=list)
    preview: str = ""
