from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Job, JobEvent, utcnow
from app.schemas import envelope

TERMINAL_EVENT_TYPES = frozenset({"completed", "failed", "blocked_injection"})


def next_seq(db: Session, job_id: str) -> int:
    last = (
        db.query(JobEvent.seq)
        .filter(JobEvent.job_id == job_id)
        .order_by(JobEvent.seq.desc())
        .first()
    )
    return (last[0] + 1) if last is not None else 0


def emit_event(
    db: Session,
    job_id: str,
    type_: str,
    node: str,
    payload_ref: str | None = None,
) -> JobEvent:
    if type_ not in TERMINAL_EVENT_TYPES and not type_.startswith("node_") and not type_.startswith(
        ("tool_", "evidence_", "contradiction_", "awaiting_")
    ):
        msg = f"event type not in frozen contract: {type_}"
        raise ValueError(msg)
    event = JobEvent(
        job_id=job_id,
        seq=next_seq(db, job_id),
        type=type_,
        node=node,
        payload_ref=payload_ref,
        ts=utcnow(),
    )
    db.add(event)
    return event


def render_envelope(event: JobEvent) -> dict[str, object]:
    return envelope(event.job_id, event.seq, event.type, event.node, event.payload_ref, event.ts)


def fetch_events_after(db: Session, job_id: str, after_seq: int) -> list[JobEvent]:
    stmt = (
        select(JobEvent)
        .where(JobEvent.job_id == job_id, JobEvent.seq > after_seq)
        .order_by(JobEvent.seq.asc())
    )
    return list(db.scalars(stmt))


class GraphRunContextProtocol(Protocol):
    request_id: str
    user_id: str
    user_role: str
    objective: str
