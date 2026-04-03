from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.core.config import Settings, get_settings


class FileArtifactStore:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def document_dir(self, document_id: str) -> Path:
        path = self.settings.processed_dir / document_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def save_raw_html(self, document_id: str, html: str) -> Path:
        path = self.settings.raw_dir / f"{document_id}.html"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(html, encoding="utf-8")
        return path

    def save_raw_artifact(self, document_id: str, name: str, payload: str) -> Path:
        path = self.settings.raw_dir / f"{document_id}_{name}.txt"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(payload, encoding="utf-8")
        return path

    def save_text(self, document_id: str, name: str, payload: str) -> Path:
        path = self.document_dir(document_id) / f"{name}.txt"
        path.write_text(payload, encoding="utf-8")
        return path

    def save_json(self, document_id: str, name: str, payload: dict[str, Any] | list[Any]) -> Path:
        path = self.document_dir(document_id) / f"{name}.json"
        path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")
        return path

    def save_optional_snapshot(self, document_id: str, name: str, payload: str | None) -> Path | None:
        if not payload:
            return None
        return self.save_text(document_id, name, payload)
