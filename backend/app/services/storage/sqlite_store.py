from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
import json
from typing import Iterator

from app.core.config import Settings, get_settings


class SQLiteMetadataStore:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._initialize()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.settings.sqlite_path)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def _initialize(self) -> None:
        Path(self.settings.sqlite_path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    source_url TEXT NOT NULL,
                    canonical_url TEXT NOT NULL,
                    title TEXT NOT NULL,
                    content_type TEXT NOT NULL,
                    extractor TEXT NOT NULL,
                    raw_html_path TEXT NOT NULL,
                    processed_dir TEXT NOT NULL,
                    char_count INTEGER NOT NULL,
                    rendered_char_count INTEGER NOT NULL DEFAULT 0,
                    clean_char_count INTEGER NOT NULL DEFAULT 0,
                    block_count INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS chunks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    document_id TEXT NOT NULL,
                    chunk_index INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    section_path TEXT NOT NULL DEFAULT '',
                    block_kinds TEXT NOT NULL DEFAULT '[]',
                    source_type TEXT NOT NULL,
                    embedding_json TEXT NOT NULL DEFAULT '',
                    embedding_model TEXT NOT NULL DEFAULT '',
                    start_char INTEGER NOT NULL,
                    end_char INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(document_id, chunk_index)
                )
                """
            )
            self._ensure_document_columns(connection)
            self._ensure_chunk_columns(connection)

    def _ensure_document_columns(self, connection: sqlite3.Connection) -> None:
        rows = connection.execute("PRAGMA table_info(documents)").fetchall()
        existing_columns = {row[1] for row in rows}

        required_columns = {
            "rendered_char_count": "INTEGER NOT NULL DEFAULT 0",
            "clean_char_count": "INTEGER NOT NULL DEFAULT 0",
        }

        for column_name, column_sql in required_columns.items():
            if column_name in existing_columns:
                continue
            connection.execute(
                f"ALTER TABLE documents ADD COLUMN {column_name} {column_sql}"
            )

    def _ensure_chunk_columns(self, connection: sqlite3.Connection) -> None:
        rows = connection.execute("PRAGMA table_info(chunks)").fetchall()
        existing_columns = {row[1] for row in rows}

        required_columns = {
            "embedding_json": "TEXT NOT NULL DEFAULT ''",
            "embedding_model": "TEXT NOT NULL DEFAULT ''",
        }

        for column_name, column_sql in required_columns.items():
            if column_name in existing_columns:
                continue
            connection.execute(
                f"ALTER TABLE chunks ADD COLUMN {column_name} {column_sql}"
            )

    def upsert_document(
        self,
        *,
        document_id: str,
        source_url: str,
        canonical_url: str,
        title: str,
        content_type: str,
        extractor: str,
        raw_html_path: str,
        processed_dir: str,
        char_count: int,
        rendered_char_count: int,
        clean_char_count: int,
        block_count: int,
        timestamp: datetime,
    ) -> None:
        iso_timestamp = timestamp.isoformat()
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO documents (
                    id,
                    source_url,
                    canonical_url,
                    title,
                    content_type,
                    extractor,
                    raw_html_path,
                    processed_dir,
                    char_count,
                    rendered_char_count,
                    clean_char_count,
                    block_count,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    source_url=excluded.source_url,
                    canonical_url=excluded.canonical_url,
                    title=excluded.title,
                    content_type=excluded.content_type,
                    extractor=excluded.extractor,
                    raw_html_path=excluded.raw_html_path,
                    processed_dir=excluded.processed_dir,
                    char_count=excluded.char_count,
                    rendered_char_count=excluded.rendered_char_count,
                    clean_char_count=excluded.clean_char_count,
                    block_count=excluded.block_count,
                    updated_at=excluded.updated_at
                """,
                (
                    document_id,
                    source_url,
                    canonical_url,
                    title,
                    content_type,
                    extractor,
                    raw_html_path,
                    processed_dir,
                    char_count,
                    rendered_char_count,
                    clean_char_count,
                    block_count,
                    iso_timestamp,
                    iso_timestamp,
                ),
            )

    def replace_chunks(
        self,
        *,
        document_id: str,
        chunks: list[dict],
        timestamp: datetime,
    ) -> None:
        iso_timestamp = timestamp.isoformat()
        with self.connect() as connection:
            connection.execute("DELETE FROM chunks WHERE document_id = ?", (document_id,))
            connection.executemany(
                """
                INSERT INTO chunks (
                    document_id,
                    chunk_index,
                    text,
                    section_path,
                    block_kinds,
                    source_type,
                    embedding_json,
                    embedding_model,
                    start_char,
                    end_char,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        document_id,
                        chunk["chunk_index"],
                        chunk["text"],
                        chunk["section_path"],
                        json.dumps(chunk["block_kinds"]),
                        chunk["source_type"],
                        chunk.get("embedding_json", ""),
                        chunk.get("embedding_model", ""),
                        chunk["start_char"],
                        chunk["end_char"],
                        iso_timestamp,
                        iso_timestamp,
                    )
                    for chunk in chunks
                ],
            )

    def get_documents(self, document_ids: list[str]) -> list[dict]:
        if not document_ids:
            return []

        placeholders = ",".join(["?"] * len(document_ids))
        with self.connect() as connection:
            rows = connection.execute(
                f"""
                SELECT id, source_url, canonical_url, title, content_type, extractor,
                       raw_html_path, processed_dir, char_count, rendered_char_count,
                       clean_char_count, block_count, created_at, updated_at
                FROM documents
                WHERE id IN ({placeholders})
                ORDER BY updated_at DESC
                """,
                tuple(document_ids),
            ).fetchall()

        return [dict(row) for row in rows]

    def get_chunks(self, document_ids: list[str]) -> list[dict]:
        if not document_ids:
            return []

        placeholders = ",".join(["?"] * len(document_ids))
        with self.connect() as connection:
            rows = connection.execute(
                f"""
                SELECT document_id, chunk_index, text, section_path, block_kinds,
                       source_type, embedding_json, embedding_model, start_char, end_char
                FROM chunks
                WHERE document_id IN ({placeholders})
                ORDER BY document_id, chunk_index
                """,
                tuple(document_ids),
            ).fetchall()

        chunks = []
        for row in rows:
            item = dict(row)
            try:
                item["block_kinds"] = json.loads(item["block_kinds"] or "[]")
            except json.JSONDecodeError:
                item["block_kinds"] = []

            if item.get("embedding_json"):
                try:
                    item["embedding"] = json.loads(item["embedding_json"])
                except json.JSONDecodeError:
                    item["embedding"] = []
            else:
                item["embedding"] = []

            chunks.append(item)

        return chunks

    def update_chunk_embeddings(
        self,
        *,
        embeddings: list[dict],
    ) -> None:
        if not embeddings:
            return

        with self.connect() as connection:
            connection.executemany(
                """
                UPDATE chunks
                SET embedding_json = ?, embedding_model = ?, updated_at = ?
                WHERE document_id = ? AND chunk_index = ?
                """,
                [
                    (
                        json.dumps(item["embedding"]),
                        item["embedding_model"],
                        datetime.utcnow().isoformat(),
                        item["document_id"],
                        item["chunk_index"],
                    )
                    for item in embeddings
                ],
            )
