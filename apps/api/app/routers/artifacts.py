"""Artifact payloads for SSE payload_refs (Phase 4 support, demo plan Appendix).

Response is a discriminated union so the UI never guesses payload shape:
  {kind: "approval", approval: {...}} | {kind: "tool", tool: {...}} | {kind: "report", report: {...}}
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import CurrentUser
from app.models import Approval, Job

router = APIRouter(prefix="/api/jobs", tags=["artifacts"])


def _can_view(user: CurrentUser, job: Job) -> bool:
    return user.role in ("supervisor", "admin") or job.created_by == user.id


@router.get("/{job_id}/artifacts/{payload_ref}")
def get_artifact(
    job_id: str,
    payload_ref: str,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if not _can_view(user, job):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if payload_ref == "approval_request":
        approval = (
            db.query(Approval)
            .filter(Approval.job_id == job_id, Approval.status == "pending")
            .order_by(Approval.requested_at.desc())
            .first()
        )
        if approval is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No pending approval")
        return {
            "kind": "approval",
            "approval": {
                "approval_id": approval.id,
                "proposal_id": approval.proposal_id,
                "action": approval.action,
                "arguments_summary": approval.arguments_summary,
                "evidence_refs": [str(e) for e in (approval.evidence_refs or [])],
                "risk_level": approval.risk_level,
                "status": approval.status,
                "requested_at": approval.requested_at.isoformat(),
            },
        }

    if payload_ref == "search_documents":
        return {
            "kind": "tool",
            "tool": {
                "tool_name": "search_documents",
                "ok": True,
                "summary": "Authorized hybrid retrieval over the local Qdrant index (ACL-filtered)",
            },
        }

    if payload_ref == "contradiction":
        contradictions = job.contradictions or []
        if not contradictions:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No contradiction recorded")
        return {"kind": "contradiction", "contradiction": contradictions[0]}

    if payload_ref == "security":
        from app.models import AuditEvent

        event = (
            db.query(AuditEvent)
            .filter(
                AuditEvent.job_id == job_id,
                AuditEvent.action == "security.injection_blocked",
            )
            .order_by(AuditEvent.ts.desc())
            .first()
        )
        if event is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No security event recorded")
        detail = event.payload or {}
        return {
            "kind": "security",
            "event": {
                "pattern": detail.get("pattern", "instruction-like content"),
                "document_title": detail.get("document_title", ""),
                "chunk_id": detail.get("chunk_id", ""),
                "action": detail.get("action", "excluded_from_evidence"),
            },
        }

    if payload_ref == "report":
        if job.final_report is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not available")
        return {"kind": "report", "report": job.final_report}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown artifact")
