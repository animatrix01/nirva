"""Prune investigations in the live DB: keep the 2 newest awaiting_approval
jobs and drop the oldest completed ones, together with their related rows
(events, evidence snapshots, approvals, work orders). Audit history is
append-only and untouched.
"""

import os
import sys

os.environ.setdefault(
    "DATABASE_URL", "sqlite:///D:/projects/Nirva/nirva/apps/api/_server.db"
)
sys.path.insert(0, os.path.abspath("apps/api"))

from sqlalchemy import select  # noqa: E402

from app.db import SessionLocal, engine  # noqa: E402
from app.models import (  # noqa: E402
    Approval,
    AssetEvent,
    AuditEvent,
    InventoryItem,
    Job,
    JobEvidence,
    JobEvent,
    WorkOrder,
)

KEEP_AWAITING = 2
DROP_COMPLETED = 15


def main() -> None:
    db = SessionLocal()
    try:
        removed_jobs = 0

        # 1. awaiting_approval: keep the newest 2
        awaiting = (
            db.query(Job)
            .filter(Job.status == "awaiting_approval")
            .order_by(Job.created_at.desc())
            .all()
        )
        stale_awaiting = awaiting[KEEP_AWAITING:]

        # 2. completed: drop the oldest 15
        completed = (
            db.query(Job)
            .filter(Job.status == "completed")
            .order_by(Job.created_at.asc())
            .all()
        )
        stale_completed = completed[:DROP_COMPLETED]

        for job in stale_awaiting + stale_completed:
            jid = job.id
            db.query(JobEvent).filter(JobEvent.job_id == jid).delete()
            db.query(JobEvidence).filter(JobEvidence.job_id == jid).delete()
            db.query(Approval).filter(Approval.job_id == jid).delete()
            db.query(WorkOrder).filter(WorkOrder.job_id == jid).delete()
            db.delete(job)
            removed_jobs += 1

        db.commit()

        totals = {
            s: db.query(Job).filter(Job.status == s).count()
            for s in (
                "awaiting_approval",
                "running",
                "completed",
                "queued",
                "failed",
                "blocked_injection",
            )
        }
        print(f"removed {removed_jobs} jobs")
        print("remaining by status:", totals)
        print(
            "audit rows untouched:",
            db.query(AuditEvent).count(),
            "| approvals kept:",
            db.query(Approval).count(),
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
