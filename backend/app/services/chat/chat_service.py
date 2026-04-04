from __future__ import annotations

import logging

from app.schemas.chat import ChatAskResponse, Citation, EvidenceChunk
from app.services.indexing.local_embeddings import embed_chunks_local, embed_query_local, warmup_embedding_model
from app.services.indexing.vector_index import HNSWVectorIndex
from app.services.llm.gemini_chat import generate_answer, verify_answer
from app.services.retrieval.hybrid_retriever import retrieve_chunks
from app.services.storage.sqlite_store import SQLiteMetadataStore

logger = logging.getLogger(__name__)


class ChatService:
    def __init__(self, metadata_store: SQLiteMetadataStore | None = None) -> None:
        self.metadata_store = metadata_store or SQLiteMetadataStore()
        self.vector_index = HNSWVectorIndex()

    async def ask(
        self,
        *,
        question: str,
        document_ids: list[str],
        api_key: str,
        model: str,
        max_chunks: int,
    ) -> ChatAskResponse:
        documents = self.metadata_store.get_documents(document_ids)
        if not documents:
            raise ValueError("No documents were found for the requested ids.")

        chunks = self.metadata_store.get_chunks(document_ids)
        if not chunks:
            raise ValueError("No chunks are indexed for the requested documents.")

        document_map = {document["id"]: document for document in documents}
        logger.info(
            "Chat request started",
            extra={
                "question": question,
                "document_ids": document_ids,
                "chunk_count": len(chunks),
                "model": model,
            },
        )
        logger.info(
            "Loaded chat documents",
            extra={
                "documents": [
                    {
                        "id": document["id"],
                        "title": document["title"],
                        "char_count": document["char_count"],
                        "block_count": document["block_count"],
                    }
                    for document in documents
                ]
            },
        )

        missing_chunks = [
            chunk
            for chunk in chunks
            if not chunk.get("embedding")
        ]
        logger.info(
            "Chunk embedding status",
            extra={
                "total_chunks": len(chunks),
                "missing_chunk_embeddings": len(missing_chunks),
            },
        )

        updated_embeddings = []
        if missing_chunks:
            embedding_vectors = await embed_chunks_local(
                [
                    (
                        document_map.get(chunk["document_id"], {}).get("title", ""),
                        chunk.get("section_path", ""),
                        chunk["text"],
                    )
                    for chunk in missing_chunks
                ],
            )

            for chunk, embedding in zip(missing_chunks, embedding_vectors):
                chunk["embedding"] = embedding
                chunk["embedding_model"] = "local:intfloat/multilingual-e5-small"
                updated_embeddings.append(
                    {
                        "document_id": chunk["document_id"],
                        "chunk_index": chunk["chunk_index"],
                        "embedding": embedding,
                        "embedding_model": "local:intfloat/multilingual-e5-small",
                    }
                )

        if updated_embeddings:
            self.metadata_store.update_chunk_embeddings(embeddings=updated_embeddings)
            self.vector_index.rebuild(chunks)
            logger.info(
                "Stored new local embeddings",
                extra={
                    "updated_chunk_embeddings": len(updated_embeddings),
                },
            )
        else:
            self.vector_index.load()
            logger.info("Reused persisted vector index", extra={"chunk_count": len(chunks)})

        query_embedding = await embed_query_local(question)
        logger.info(
            "Query embedding created",
            extra={
                "embedding_dim": len(query_embedding),
            },
        )
        vector_scores = self.vector_index.query(
            chunks=chunks,
            query_embedding=query_embedding,
            k=max(20, max_chunks * 4),
        )
        logger.info(
            "Vector retrieval candidate scores",
            extra={
                "score_count": len(vector_scores),
                "top_scores": sorted(vector_scores.items(), key=lambda item: item[1], reverse=True)[:5],
            },
        )
        retrieved = retrieve_chunks(
            question=question,
            chunks=[
                {
                    **chunk,
                    "title": document_map.get(chunk["document_id"], {}).get("title", ""),
                }
                for chunk in chunks
            ],
            vector_scores=vector_scores,
            max_chunks=max_chunks,
        )
        logger.info(
            "Hybrid retrieval selected chunks",
            extra={
                "selected_chunks": [
                    {
                        "document_id": chunk["document_id"],
                        "chunk_index": chunk["chunk_index"],
                        "section_path": chunk.get("section_path", ""),
                        "score": chunk.get("_hybrid_score"),
                    }
                    for chunk in retrieved
                ]
            },
        )

        evidence_chunks = [
            {
                "chunk_id": f"{chunk['document_id']}:{chunk['chunk_index']}",
                "document_id": chunk["document_id"],
                "title": document_map.get(chunk["document_id"], {}).get("title", ""),
                "section_path": chunk.get("section_path", ""),
                "block_kinds": chunk.get("block_kinds") or [],
                "source_type": chunk.get("source_type", ""),
                "text": chunk["text"],
            }
            for chunk in retrieved
        ]
        logger.info(
            "Prepared evidence chunks",
            extra={
                "evidence_chunk_count": len(evidence_chunks),
                "evidence_chunk_ids": [chunk["chunk_id"] for chunk in evidence_chunks],
            },
        )

        answer_result = await generate_answer(
            api_key=api_key,
            model=model,
            question=question,
            chunks=evidence_chunks,
        )
        logger.info(
            "Answer generation completed",
            extra={
                "answer_preview": answer_result["answer"][:400],
                "usage_metadata": answer_result.get("usage_metadata"),
            },
        )

        try:
            verified = await verify_answer(
                api_key=api_key,
                model=model,
                question=question,
                draft_answer=answer_result["answer"],
                chunks=evidence_chunks,
            )
        except Exception as error:  # noqa: BLE001
            logger.warning("Verifier failed, using raw answer", exc_info=error)
            verified = {
                "supported": False,
                "answer": answer_result["answer"],
                "citations": [],
                "missing_information": [],
            }

        if verified.get("supported") and not verified.get("citations"):
            logger.warning(
                "Verifier returned supported answer without citations; using fallback citations",
                extra={
                    "evidence_chunk_count": len(evidence_chunks),
                },
            )
            fallback_citations = [
                {
                    "chunkId": chunk["chunk_id"],
                    "quote": chunk["text"][:180],
                    "reason": "Fallback evidence snippet because verifier omitted citations.",
                }
                for chunk in evidence_chunks[:2]
                if chunk.get("text")
            ]
            verified["citations"] = fallback_citations
            verified["supported"] = bool(fallback_citations)

        logger.info(
            "Chat request completed",
            extra={
                "supported": bool(verified.get("supported")),
                "citation_count": len(verified.get("citations", [])),
                "missing_information_count": len(
                    verified.get("missing_information", verified.get("missingInformation", []))
                ),
                "final_answer_preview": (verified.get("answer") or answer_result["answer"])[:400],
            },
        )

        return ChatAskResponse(
            mode_used="retrieval",
            answer=verified.get("answer") or answer_result["answer"],
            supported=bool(verified.get("supported")),
            citations=[
                Citation(
                    chunk_id=str(citation.get("chunkId", "")),
                    quote=str(citation.get("quote", "")),
                    reason=str(citation.get("reason", "")),
                )
                for citation in verified.get("citations", [])
                if citation.get("chunkId") and citation.get("quote")
            ],
            missing_information=[
                str(item)
                for item in verified.get("missing_information", verified.get("missingInformation", []))
            ],
            evidence_chunks=[
                EvidenceChunk(
                    chunk_id=chunk["chunk_id"],
                    document_id=chunk["document_id"],
                    title=chunk["title"],
                    section_path=chunk["section_path"],
                    block_kinds=chunk["block_kinds"],
                    source_type=chunk["source_type"],
                    text=chunk["text"],
                )
                for chunk in evidence_chunks
            ],
        )


async def warmup_chat_runtime() -> None:
    await warmup_embedding_model()
