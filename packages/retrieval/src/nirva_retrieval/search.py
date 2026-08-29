"""ACL-filtered hybrid retrieval: dense + sparse prefetch fused with RRF.

The allowed_roles filter is applied INSIDE the Qdrant query (COMMON.md c.4 /
security rules: never retrieve first and filter afterward). Unauthorized
chunks structurally cannot enter model context.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from qdrant_client import QdrantClient, models

from nirva_retrieval.store import COLLECTION, DENSE_VECTOR, SPARSE_VECTOR

__all__ = ["RetrievedChunk", "search_documents"]

PREFETCH_LIMIT = 20


@dataclass(frozen=True)
class RetrievedChunk:
    chunk_id: str
    text: str
    score: float
    document_id: str
    document_title: str
    document_type: str
    revision: str
    page: int | None
    section: str
    equipment_id: str | None
    confidentiality_level: str


def _acl_filter(role: str, equipment_id: str | None, document_type: str | None) -> models.Filter:
    must: list[models.FieldCondition | models.IsEmptyCondition] = [
        models.FieldCondition(key="allowed_roles", match=models.MatchValue(value=role)),
    ]
    if equipment_id:
        must.append(models.FieldCondition(key="equipment_id", match=models.MatchValue(value=equipment_id)))
    if document_type:
        must.append(models.FieldCondition(key="document_type", match=models.MatchValue(value=document_type)))
    return models.Filter(must=must)  # type: ignore[arg-type]


def _to_retrieved(point: Any) -> RetrievedChunk:
    payload = point.payload or {}
    return RetrievedChunk(
        chunk_id=str(payload.get("chunk_id", "")),
        text=str(payload.get("text", "")),
        score=float(point.score),
        document_id=str(payload.get("document_id", "")),
        document_title=str(payload.get("document_title", "")),
        document_type=str(payload.get("document_type", "")),
        revision=str(payload.get("revision", "")),
        page=payload.get("page"),
        section=str(payload.get("section", "")),
        equipment_id=cast_optional(payload.get("equipment_id")),
        confidentiality_level=str(payload.get("confidentiality_level", "")),
    )


def cast_optional(value: object) -> str | None:
    return str(value) if value is not None else None


def search_documents(
    client: QdrantClient,
    *,
    role: str,
    query_dense: list[float],
    query_sparse: dict[int, float],
    equipment_id: str | None = None,
    document_type: str | None = None,
    top_k: int = 5,
) -> list[RetrievedChunk]:
    """Hybrid search: role-ACL filtered dense+sparse prefetch, RRF fusion."""
    sparse = models.SparseVector(indices=list(query_sparse.keys()), values=list(query_sparse.values()))
    result = client.query_points(
        collection_name=COLLECTION,
        prefetch=[
            models.Prefetch(
                query=query_dense,
                using=DENSE_VECTOR,
                limit=PREFETCH_LIMIT,
                filter=_acl_filter(role, equipment_id, document_type),
            ),
            models.Prefetch(
                query=sparse,
                using=SPARSE_VECTOR,
                limit=PREFETCH_LIMIT,
                filter=_acl_filter(role, equipment_id, document_type),
            ),
        ],
        query=models.FusionQuery(fusion=models.Fusion.RRF),
        limit=top_k,
        with_payload=True,
    )
    return [_to_retrieved(point) for point in result.points]
