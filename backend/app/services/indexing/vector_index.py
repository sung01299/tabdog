from __future__ import annotations

import json
import logging
from pathlib import Path

import hnswlib
import numpy as np

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


def chunk_key(chunk: dict) -> str:
    return f"{chunk['document_id']}:{chunk['chunk_index']}"


class HNSWVectorIndex:
    def __init__(
        self,
        settings: Settings | None = None,
        *,
        space: str = "cosine",
        ef_construction: int = 200,
        m: int = 16,
    ) -> None:
        self.settings = settings or get_settings()
        self.space = space
        self.ef_construction = ef_construction
        self.m = m
        self.index_path = self.settings.vector_index_dir / "chunks.hnsw"
        self.mapping_path = self.settings.vector_index_dir / "chunks.mapping.json"
        self._index: hnswlib.Index | None = None
        self._mapping: list[str] = []
        self._dim: int | None = None

    def _build_index(self, chunks: list[dict], dim: int) -> None:
        indexed = [
            chunk
            for chunk in chunks
            if chunk.get("embedding")
            and len(chunk["embedding"]) == dim
        ]

        index = hnswlib.Index(space=self.space, dim=dim)
        index.init_index(
            max_elements=max(1, len(indexed)),
            ef_construction=self.ef_construction,
            M=self.m,
        )

        if indexed:
            vectors = np.array([chunk["embedding"] for chunk in indexed], dtype=np.float32)
            labels = np.arange(len(indexed))
            index.add_items(vectors, labels)
            self._mapping = [chunk_key(chunk) for chunk in indexed]
        else:
            self._mapping = []

        self._index = index
        self._dim = dim

    def rebuild(self, chunks: list[dict]) -> None:
        first = next((chunk for chunk in chunks if chunk.get("embedding")), None)
        if not first:
            self._index = None
            self._mapping = []
            self._dim = None
            return

        dim = len(first["embedding"])
        self._build_index(chunks, dim)
        self.save()

        logger.info(
            "hnswlib vector index rebuilt",
            extra={
                "dim": dim,
                "indexed_chunk_count": len(self._mapping),
            },
        )

    def save(self) -> None:
        if self._index is None or self._dim is None:
            return

        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        self._index.save_index(str(self.index_path))
        self.mapping_path.write_text(
            json.dumps(
                {
                    "dim": self._dim,
                    "mapping": self._mapping,
                },
                ensure_ascii=True,
                indent=2,
            ),
            encoding="utf-8",
        )

    def load(self) -> bool:
        if not self.index_path.exists() or not self.mapping_path.exists():
            return False

        payload = json.loads(self.mapping_path.read_text(encoding="utf-8"))
        dim = int(payload["dim"])
        mapping = list(payload["mapping"])

        index = hnswlib.Index(space=self.space, dim=dim)
        index.load_index(str(self.index_path))
        index.set_ef(max(50, min(max(1, len(mapping)), 200)))

        self._index = index
        self._mapping = mapping
        self._dim = dim
        logger.info(
            "hnswlib vector index loaded",
            extra={
                "dim": dim,
                "indexed_chunk_count": len(mapping),
            },
        )
        return True

    def query(
        self,
        *,
        chunks: list[dict],
        query_embedding: list[float],
        k: int,
    ) -> dict[str, float]:
        if not chunks or not query_embedding:
            return {}
        dim = len(query_embedding)
        if self._index is None or self._dim != dim or len(self._mapping) != len(
            [chunk for chunk in chunks if chunk.get("embedding") and len(chunk["embedding"]) == dim]
        ):
            self._build_index(chunks, dim)

        if self._index is None or not self._mapping:
            return {}

        query_vector = np.array(query_embedding, dtype=np.float32)
        actual_k = min(k, len(self._mapping))
        self._index.set_ef(max(50, min(len(self._mapping), k * 4)))
        result_labels, result_distances = self._index.knn_query(query_vector, k=actual_k)

        scores: dict[str, float] = {}
        for label, distance in zip(result_labels[0], result_distances[0]):
            scores[self._mapping[int(label)]] = max(0.0, 1.0 - float(distance))

        logger.info(
            "hnswlib vector query completed",
            extra={
                "indexed_chunk_count": len(self._mapping),
                "requested_k": k,
                "returned_k": len(scores),
            },
        )
        return scores
