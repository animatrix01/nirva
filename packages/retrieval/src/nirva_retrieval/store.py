"""Qdrant collection management: dense + sparse named vectors, §c.4 payloads."""

from __future__ import annotations

import uuid
from typing import Any

from qdrant_client import QdrantClient, models

from nirva_retrieval.chunking import Chunk

__all__ = ["COLLECTION", "ensure_collection", "upsert_chunks"]

COLLECTION = "nirva_chunks"
DENSE_VECTOR = "dense"
SPARSE_VECTOR = "sparse"
DENSE_DIM = 1024  # bge-m3 embedding width


def ensure_collection(client: QdrantClient) -> None:
    if client.collection_exists(COLLECTION):
        return
    client.create_collection(
        collection_name=COLLECTION,
        vectors_config={
            DENSE_VECTOR: models.VectorParams(size=DENSE_DIM, distance=models.Distance.COSINE),
        },
        sparse_vectors_config={
            SPARSE_VECTOR: models.SparseVectorParams(),
        },
    )


def _payload(chunk: Chunk) -> dict[str, object]:
    meta = chunk.metadata
    return {
        "text": chunk.text,
        "document_id": meta.document_id,
        "document_title": meta.document_title,
        "document_type": meta.document_type,
        "revision": meta.revision,
        "effective_date": meta.effective_date,
        "department": meta.department,
        "equipment_id": meta.equipment_id,
        "confidentiality_level": meta.confidentiality_level,
        "allowed_roles": meta.allowed_roles,
        "page": meta.page,
        "section": meta.section,
        "chunk_id": meta.chunk_id,
        "content_hash": meta.content_hash,
    }


def upsert_chunks(
    client: QdrantClient,
    chunks: list[Chunk],
    vectors: list[dict[str, Any]],
) -> int:
    """Upsert chunks with prepared vectors: {"dense": [...], "sparse": {idx: w}}."""
    if len(chunks) != len(vectors):
        msg = "chunks and vectors length mismatch"
        raise ValueError(msg)
    points = [
        models.PointStruct(
            id=str(uuid.uuid5(uuid.NAMESPACE_URL, chunk.metadata.chunk_id)),
            vector=vector,
            payload=_payload(chunk),
        )
        for chunk, vector in zip(chunks, vectors, strict=True)
    ]
    client.upsert(collection_name=COLLECTION, points=points, wait=True)
    return len(points)
