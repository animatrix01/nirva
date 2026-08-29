import hashlib
import json
import threading
import uuid
from collections.abc import Mapping
from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditEvent

GENESIS_HASH = "0" * 64

_chain_lock = threading.Lock()


def _canonical(payload: Mapping[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def append_audit_event(
    db: Session,
    *,
    actor: str,
    actor_role: str,
    action: str,
    argument_summary: str,
    outcome: str = "ok",
    job_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> AuditEvent:
    """Append one hash-chained event.

    The read-last/link/insert sequence is serialized by a process-wide lock and
    committed inside it, so concurrent appends (request thread vs job threads)
    can never fork the chain. Multi-process deployments would additionally need
    a DB-level advisory lock — noted for post-demo hardening.
    """
    with _chain_lock:
        last = (
            db.query(AuditEvent)
            .order_by(AuditEvent.ts.desc(), AuditEvent.id.desc())
            .first()
        )
        prev_hash = last.hash if last is not None else GENESIS_HASH
        material = {
            "actor": actor,
            "actor_role": actor_role,
            "action": action,
            "argument_summary": argument_summary,
            "outcome": outcome,
            "job_id": job_id,
            "payload": payload or {},
        }
        digest = hashlib.sha256((_canonical(material) + prev_hash).encode("utf-8")).hexdigest()
        event = AuditEvent(
            id=str(uuid.uuid4()),
            job_id=job_id,
            actor=actor,
            actor_role=actor_role,
            action=action,
            argument_summary=argument_summary,
            outcome=outcome,
            payload=payload,
            prev_hash=prev_hash,
            hash=digest,
        )
        db.add(event)
        db.commit()
    return event


def verify_chain(events: list[AuditEvent]) -> bool:
    expected_prev = GENESIS_HASH
    ordered = sorted(events, key=lambda e: (e.ts, e.id))
    for event in ordered:
        if event.prev_hash != expected_prev:
            return False
        material = {
            "actor": event.actor,
            "actor_role": event.actor_role,
            "action": event.action,
            "argument_summary": event.argument_summary,
            "outcome": event.outcome,
            "job_id": event.job_id,
            "payload": event.payload or {},
        }
        recomputed = hashlib.sha256(
            (_canonical(material) + event.prev_hash).encode("utf-8")
        ).hexdigest()
        if recomputed != event.hash:
            return False
        expected_prev = event.hash
    return True
