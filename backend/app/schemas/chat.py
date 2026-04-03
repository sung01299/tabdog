from typing import Literal

from pydantic import BaseModel, Field


class ChatAskRequest(BaseModel):
    question: str
    document_ids: list[str] = Field(default_factory=list)
    api_key: str | None = None
    model: str = "gemini-2.5-flash"
    mode: Literal["auto", "retrieval"] = "auto"
    max_chunks: int = 10


class Citation(BaseModel):
    chunk_id: str
    quote: str
    reason: str = ""


class EvidenceChunk(BaseModel):
    chunk_id: str
    document_id: str
    title: str
    section_path: str = ""
    block_kinds: list[str] = Field(default_factory=list)
    source_type: str
    text: str


class ChatAskResponse(BaseModel):
    mode_used: str
    answer: str
    supported: bool
    citations: list[Citation] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    evidence_chunks: list[EvidenceChunk] = Field(default_factory=list)
