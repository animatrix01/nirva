from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.audit import verify_chain
from app.db import get_db
from app.deps import require_roles
from app.models import User
from app.schemas import AuditEventOut, AuditResponse

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", response_model=AuditResponse)
def query_audit(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "safety_officer"))],
    job_id: str | None = None,
    actor: str | None = None,
    action: str | None = None,
    limit: int = 100,
) -> AuditResponse:
    from app.models import AuditEvent

    query = db.query(AuditEvent)
    if job_id is not None:
        query = query.filter(AuditEvent.job_id == job_id)
    if actor is not None:
        query = query.filter(AuditEvent.actor == actor)
    if action is not None:
        query = query.filter(AuditEvent.action == action)
    events = query.order_by(AuditEvent.ts.asc(), AuditEvent.id.asc()).limit(min(limit, 500)).all()
    return AuditResponse(
        chain_valid=verify_chain(events),
        events=[
            AuditEventOut(
                event_id=e.id,
                job_id=e.job_id,
                actor=e.actor,
                actor_role=e.actor_role,
                action=e.action,
                argument_summary=e.argument_summary,
                outcome=e.outcome,
                prev_hash=e.prev_hash,
                hash=e.hash,
                ts=e.ts,
            )
            for e in events
        ],
    )
