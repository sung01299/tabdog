from __future__ import annotations

import logging

import hnswlib
import numpy as np

logger = logging.getLogger(__name__)


def chunk_key(chunk: dict) -> str:
    return f"{chunk['document_id']}:{chunk['chunk_index']}"


class HNSWVectorIndex:
    def __init__(self, *, space: str = "cosine", ef_construction: int = 200, m: int = 16) -> None:
        self.space = space
        self.ef_construction = ef_construction
        self.m = m

    def query(
        self,
        *,
        chunks: list[dict],
        query_embedding: list[float],
        k: int,
    ) -> dict[str, float]:
        if not chunks or not query_embedding:
            return {}

        indexed = [
            chunk
            for chunk in chunks
            if chunk.get("embedding")
            and len(chunk["embedding"]) == len(query_embedding)
        ]
        if not indexed:
            return {}

        dim = len(query_embedding)
        index = hnswlib.Index(space=self.space, dim=dim)
        index.init_index(
            max_elements=len(indexed),
            ef_construction=self.ef_construction,
            M=self.m,
        )
        index.set_ef(max(50, min(len(indexed), k * 4)))

        vectors = np.array([chunk["embedding"] for chunk in indexed], dtype=np.float32)
        labels = np.arange(len(indexed))
        index.add_items(vectors, labels)

        query_vector = np.array(query_embedding, dtype=np.float32)
        actual_k = min(k, len(indexed))
        result_labels, result_distances = index.knn_query(query_vector, k=actual_k)

        scores: dict[str, float] = {}
        for label, distance in zip(result_labels[0], result_distances[0]):
            chunk = indexed[int(label)]
            scores[chunk_key(chunk)] = max(0.0, 1.0 - float(distance))

        logger.info(
            "hnswlib vector query completed",
            extra={
                "indexed_chunk_count": len(indexed),
                "requested_k": k,
                "returned_k": len(scores),
            },
        )
        return scores
