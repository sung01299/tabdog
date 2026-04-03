from __future__ import annotations

import re

from bs4 import BeautifulSoup

from app.schemas.extract import StructuredBlock


def normalize_whitespace(text: str | None) -> str:
    compact = re.sub(r"[ \t]+", " ", (text or "").replace("\u00a0", " "))
    compact = re.sub(r"\n{3,}", "\n\n", compact)
    return compact.strip()


def markdown_to_blocks(markdown: str) -> list[StructuredBlock]:
    lines = (markdown or "").splitlines()
    blocks: list[StructuredBlock] = []
    paragraph_buffer: list[str] = []
    code_buffer: list[str] = []
    in_code_block = False

    def flush_paragraph() -> None:
        text = normalize_whitespace("\n".join(paragraph_buffer))
        if text:
            blocks.append(StructuredBlock(type="paragraph", text=text))
        paragraph_buffer.clear()

    for raw_line in lines:
        stripped = raw_line.strip()

        if stripped.startswith("```"):
            flush_paragraph()
            if in_code_block:
                code_text = "\n".join(code_buffer).strip()
                if code_text:
                    blocks.append(StructuredBlock(type="code", text=code_text))
                code_buffer.clear()
                in_code_block = False
            else:
                in_code_block = True
            continue

        if in_code_block:
            code_buffer.append(raw_line.rstrip())
            continue

        if not stripped:
            flush_paragraph()
            continue

        heading_match = re.match(r"^(#{1,6})\s+(.*)$", stripped)
        if heading_match:
            flush_paragraph()
            heading_text = normalize_whitespace(heading_match.group(2))
            if heading_text:
                blocks.append(
                    StructuredBlock(
                        type="heading",
                        text=heading_text,
                        heading_level=len(heading_match.group(1)),
                        heading_text=heading_text,
                    )
                )
            continue

        if re.match(r"^(\-|\*|\d+\.)\s+", stripped):
            flush_paragraph()
            blocks.append(StructuredBlock(type="list", text=stripped))
            continue

        if stripped.startswith(">"):
            flush_paragraph()
            blocks.append(StructuredBlock(type="blockquote", text=stripped))
            continue

        if stripped.startswith("|") and stripped.endswith("|"):
            flush_paragraph()
            blocks.append(StructuredBlock(type="table", text=stripped))
            continue

        paragraph_buffer.append(stripped)

    flush_paragraph()

    if in_code_block and code_buffer:
        code_text = "\n".join(code_buffer).strip()
        if code_text:
            blocks.append(StructuredBlock(type="code", text=code_text))

    return blocks


def looks_like_html(text: str | None) -> bool:
    sample = (text or "").lstrip().lower()
    return sample.startswith("<!doctype html") or sample.startswith("<html") or (
        "<body" in sample and "</" in sample
    )


def html_to_text(html: str | None) -> str:
    if not html:
        return ""

    soup = BeautifulSoup(html, "html.parser")
    return normalize_whitespace(soup.get_text("\n"))


def html_to_blocks(html: str | None) -> list[StructuredBlock]:
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    blocks: list[StructuredBlock] = []

    for node in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "pre", "table"]):
        text = normalize_whitespace(node.get_text("\n"))
        if not text:
            continue

        name = node.name.lower()
        if name.startswith("h"):
            level = int(name[1])
            blocks.append(
                StructuredBlock(
                    type="heading",
                    text=text,
                    heading_level=level,
                    heading_text=text,
                )
            )
        elif name == "p":
            blocks.append(StructuredBlock(type="paragraph", text=text))
        elif name == "li":
            blocks.append(StructuredBlock(type="list", text=text))
        elif name == "blockquote":
            blocks.append(StructuredBlock(type="blockquote", text=text))
        elif name == "pre":
            blocks.append(StructuredBlock(type="code", text=text))
        elif name == "table":
            blocks.append(StructuredBlock(type="table", text=text))

    return blocks
