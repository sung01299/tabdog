from __future__ import annotations

from dataclasses import dataclass

from app.schemas.extract import StructuredBlock


@dataclass
class ChunkRecord:
    chunk_index: int
    text: str
    section_path: str
    block_kinds: list[str]
    source_type: str
    start_char: int
    end_char: int


def _update_heading_path(heading_path: list[str], block: StructuredBlock) -> list[str]:
    if block.type != "heading" or not block.heading_level:
        return heading_path

    next_path = heading_path[: max(0, block.heading_level - 1)]
    next_path.append(block.heading_text or block.text)
    return next_path


def chunk_structured_blocks(
    blocks: list[StructuredBlock],
    *,
    max_chars: int = 1800,
    overlap_blocks: int = 1,
) -> list[ChunkRecord]:
    chunks: list[ChunkRecord] = []
    buffer: list[tuple[StructuredBlock, list[str]]] = []
    heading_path: list[str] = []
    current_start_char = 0

    def flush() -> None:
        nonlocal buffer
        if not buffer:
            return

        texts = [block.text for block, _ in buffer if block.text.strip()]
        if not texts:
            buffer = []
            return

        chunk_text = "\n\n".join(texts).strip()
        chunk_index = len(chunks)
        section_path = " > ".join(buffer[0][1]) if buffer[0][1] else ""
        start_char = current_start_char
        end_char = start_char + len(chunk_text)
        block_kinds = sorted({block.type for block, _ in buffer})

        chunks.append(
            ChunkRecord(
                chunk_index=chunk_index,
                text=chunk_text,
                section_path=section_path,
                block_kinds=block_kinds,
                source_type="structured",
                start_char=start_char,
                end_char=end_char,
            )
        )

        if overlap_blocks > 0:
          buffer = buffer[-overlap_blocks:]
        else:
          buffer = []

    for block in blocks:
        heading_path = _update_heading_path(heading_path, block)
        section_snapshot = heading_path.copy()

        current_text = "\n\n".join(item[0].text for item in buffer).strip()
        candidate_text = "\n\n".join(
            [current_text, block.text] if current_text else [block.text]
        ).strip()

        if buffer and len(candidate_text) > max_chars:
            flush()

        if len(block.text) > max_chars:
            flush()
            offset = 0
            while offset < len(block.text):
                piece = block.text[offset : offset + max_chars].strip()
                if piece:
                    chunk_index = len(chunks)
                    chunks.append(
                        ChunkRecord(
                            chunk_index=chunk_index,
                            text=piece,
                            section_path=" > ".join(section_snapshot),
                            block_kinds=[block.type],
                            source_type="structured",
                            start_char=current_start_char,
                            end_char=current_start_char + len(piece),
                        )
                    )
                offset += max_chars
            current_start_char += len(block.text)
            continue

        buffer.append((block, section_snapshot))

    flush()
    return chunks
