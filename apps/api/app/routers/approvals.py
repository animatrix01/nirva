import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.audit import append_audit_event
from app.db import get_db
from app.deps import require_roles
from app.models import Approval, User, utcnow
from app.schemas import (
    ApprovalDecisionRequest,
    ApprovalDecisionResponse,
    ApprovalOut,
)

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


@router.get("", response_model=list[ApprovalOut])
def list_approvals(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("supervisor", "admin"))],
) -> list[ApprovalOut]:
    approvals = db.query(Approval).order_by(Approval.requested_at.desc()).all()
    return [
        ApprovalOut(
            approval_id=a.id,
            job_id=a.job_id,
            proposal_id=a.proposal_id,
            action=a.action,
            arguments_summary=a.arguments_summary,
            evidence_refs=[str(e) for e in (a.evidence_refs or [])],
            risk_level=a.risk_level,
            status=a.status,
            requested_at=a.requested_at,
        )
        for a in approvals
    ]


@router.post("/{approval_id}/decision", response_model=ApprovalDecisionResponse)
def decide_approval(
    approval_id: str,
    body: ApprovalDecisionRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(require_roles("supervisor"))],
) -> ApprovalDecisionResponse:
    approval = db.get(Approval, approval_id)
    if approval is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval not found")
    if approval.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Approval already decided; first decision wins",
        )
    approval.status = body.decision
    approval.decided_by = user.id
    approval.decided_at = utcnow()
    approval.comment = body.comment
    work_order_id: str | None = None
    if body.decision == "approved":
        work_order_id = f"WO-{uuid.uuid4()}"
        approval.work_order_id = work_order_id
    append_audit_event(
        db,
        actor=user.username,
        actor_role=user.role,
        action=f"approval.{body.decision}",
        argument_summary=f"proposal={approval.proposal_id} action={approval.action}",
        outcome="ok" if body.decision == "approved" else "blocked",
        job_id=approval.job_id,
    )
    db.commit()
    assert approval.decided_at is not None
    decided_at = approval.decided_at if approval.decided_at.tzinfo is None else datetime.now(UTC)
    return ApprovalDecisionResponse(
        approval_id=approval.id,
        status=approval.status,
        decided_by=user.id,
        decided_at=decided_at,
        work_order_id=work_order_id,
    )
