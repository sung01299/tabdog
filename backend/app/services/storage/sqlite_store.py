from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
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
                    block_count INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
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
                    block_count,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    source_url=excluded.source_url,
                    canonical_url=excluded.canonical_url,
                    title=excluded.title,
                    content_type=excluded.content_type,
                    extractor=excluded.extractor,
                    raw_html_path=excluded.raw_html_path,
                    processed_dir=excluded.processed_dir,
                    char_count=excluded.char_count,
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
                    block_count,
                    iso_timestamp,
                    iso_timestamp,
                ),
            )
