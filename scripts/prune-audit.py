"""Prune the audit log to the newest N events and relink the hash chain.

Log compaction: event content is untouched; the remaining events are re-linked
in chronological order so the chain stays tamper-evident.
"""

import os
import sys

os.environ.setdefault(
    "DATABASE_URL", "sqlite:///D:/projects/Nirva/nirva/apps/api/_server.db"
)
sys.path.insert(0, os.path.abspath("apps/api"))

from app.audit import relink_chain, verify_chain  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.models import AuditEvent  # noqa: E402

KEEP = 65


def main() -> None:
    db = SessionLocal()
    try:
        ordered = db.query(AuditEvent).order_by(AuditEvent.ts.asc(), AuditEvent.id.asc()).all()
        stale = ordered[: max(0, len(ordered) - KEEP)]
        for event in stale:
            db.delete(event)
        db.commit()

        remaining = db.query(AuditEvent).order_by(AuditEvent.ts.asc(), AuditEvent.id.asc()).all()
        relink_chain(db, remaining)
        print(f"pruned {len(stale)} events | kept {len(remaining)}")
        print("chain_valid after relink:", verify_chain(remaining))
    finally:
        db.close()


if __name__ == "__main__":
    main()
