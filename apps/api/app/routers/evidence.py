"""Evidence artifact endpoint (web proposal 2026-08-29, ratified): per-chunk
citation click-through with passage, metadata, and retrieval rationale,
ACL-filtered by caller role at query time (never after).
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from qdrant_client import QdrantClient, models
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.deps import CurrentUser
from app.models import Job

router = APIRouter(prefix="/api/jobs", tags=["evidence"])

_WHY_RETRIEVED = (
    "Authorized chunk returned by the investigation's ACL-filtered hybrid "
    "retrieval (dense + sparse, reciprocal-rank fusion)."
)


def _can_view(user: CurrentUser, job: Job) -> bool:
    return user.role in ("supervisor", "admin") or job.created_by == user.id


@router.get("/{job_id}/evidence/{chunk_id}")
def get_evidence_chunk(
    job_id: str,
    chunk_id: str,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if not _can_view(user, job):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    settings = get_settings()
    client = QdrantClient(url=settings.qdrant_url, timeout=30, check_compatibility=False)
    points, _ = client.scroll(
        collection_name="nirva_chunks",
        scroll_filter=models.Filter(
            must=[models.FieldCondition(key="chunk_id", match=models.MatchValue(value=chunk_id))]
        ),
        limit=1,
        with_payload=True,
    )
    if not points or not points[0].payload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chunk not found")
    payload: dict[str, Any] = points[0].payload
    if user.role not in (payload.get("allowed_roles") or []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    return {
        "chunk_id": payload.get("chunk_id"),
        "document_id": payload.get("document_id"),
        "document_title": payload.get("document_title"),
        "document_type": payload.get("document_type"),
        "revision": payload.get("revision"),
        "page": payload.get("page"),
        "section": payload.get("section"),
        "equipment_id": payload.get("equipment_id"),
        "confidentiality_level": payload.get("confidentiality_level"),
        "content_hash": payload.get("content_hash"),
        "passage_text": payload.get("text"),
        "why_retrieved": _WHY_RETRIEVED,
    }
