"""Seed the P-204 evidence corpus for the demo.

Adds realistic, clearly-synthetic plant knowledge across all five document
types so the evidence library reads like a real corpus and every type facet
has rows. Modelled on seed-operational-data.py: same DATABASE_URL guard, same
idempotent skip pattern.

All content is synthetic demo data. No real MRPL data is used or implied.

Usage
-----
    # show what would happen, write nothing
    python scripts/seed-p204-documents.py --dry-run

    # insert the corpus (idempotent — safe to re-run)
    python scripts/seed-p204-documents.py

    # also delete obviously-junk demo rows (lists every title first)
    python scripts/seed-p204-documents.py --purge-demo

DATABASE_URL must point at the SAME database the API server uses, e.g.
    set DATABASE_URL=sqlite:///./nirva-dev.db      (from apps/api/)
"""

from __future__ import annotations

import hashlib
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

if not os.environ.get("DATABASE_URL"):
    raise SystemExit(
        "DATABASE_URL must be set (use the SAME absolute URL the API server uses, "
        "e.g. sqlite:///./nirva-dev.db from apps/api/, or the PostgreSQL URL)"
    )

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.models import Document, User  # noqa: E402
from sqlalchemy import select  # noqa: E402

# ── Corpus ────────────────────────────────────────────────────────────────────
# (title, document_type, revision, effective_date, department, equipment_id)
# All tagged to PUMP-204 so retrieval facets and the asset filters have data.

CORPUS: list[tuple[str, str, str, str, str, str | None]] = [
    (
        "Centrifugal Pump CP-300 Series — Maintenance Manual",
        "manual",
        "7",
        "2023-03-14",
        "Mechanical",
        "PUMP-204",
    ),
    (
        "SOP-217 — Mechanical Seal Replacement, Cooling Water Pumps",
        "sop",
        "C",
        "2024-08-01",
        "Maintenance",
        "PUMP-204",
    ),
    (
        "P&ID 2-CW-104 — Cooling Water Circuit, Unit 2",
        "manual",
        "12",
        "2024-02-20",
        "Process Engineering",
        "PUMP-204",
    ),
    (
        "WO-8821 — PUMP-204 Mechanical Seal Replacement",
        "work_order",
        "2",
        "2026-06-18",
        "Maintenance",
        "PUMP-204",
    ),
    (
        "WO-8790 — PUMP-204 Mechanical Seal Replacement",
        "work_order",
        "1",
        "2026-02-03",
        "Maintenance",
        "PUMP-204",
    ),
    (
        "IR-0331 — Cooling Water Loss of Flow Near-Miss, Unit 2",
        "incident",
        "Final",
        "2026-07-30",
        "Reliability",
        "PUMP-204",
    ),
    (
        "PUMP-204 Equipment Photo — Lower Flange Area",
        "data",
        "1",
        "2026-08-12",
        "Mechanical",
        "PUMP-204",
    ),
    (
        "PUMP-204 Vibration and Seal Leakage Trend — 18 Months",
        "data",
        "1",
        "2026-08-25",
        "Reliability",
        "PUMP-204",
    ),
    (
        "Conflicting Records Note — Bearing Load Specification",
        "incident",
        "Draft",
        "2026-08-20",
        "Process Engineering",
        None,
    ),
]

# ── Junk detection for --purge-demo ───────────────────────────────────────────
# Matches rows created by ad-hoc manual testing: near-empty titles, placeholder
# departments, or numeric "equipment" tags. Deliberately conservative — a title
# must look clearly throwaway before it is deleted.

JUNK_DEPARTMENTS = {
    "ssss", "maintena", "maintenan", "repair", "service", "edd rg", "hulaka",
    "test", "tests", "demo", "asdf", "mech", "dept", "xyz",
}

JUNK_TITLE_MAX = 4


def looks_like_junk(doc: Document) -> bool:
    title = (doc.title or "").strip()
    dept = (doc.department or "").strip().lower()
    if dept in JUNK_DEPARTMENTS:
        return True
    # A title this short carries no meaning ("TEST", "s", "leaki" is 5 so kept).
    if 0 < len(title) < JUNK_TITLE_MAX:
        return True
    # Title is a single character or two.
    if len(title) <= 2:
        return True
    return False


def content_hash_for(title: str) -> str:
    """Stable synthetic hash so re-running the script skips existing rows."""
    return hashlib.sha256(f"nirva-demo-p204::{title}".encode()).hexdigest()


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    purge = "--purge-demo" in sys.argv

    if dry_run:
        print("DRY RUN — no writes will be made\n")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # ── Purge ────────────────────────────────────────────────────────────
        if purge:
            junk = db.scalars(select(Document)).all()
            doomed = [d for d in junk if looks_like_junk(d)]
            if doomed:
                print(f"--purge-demo: {len(doomed)} row(s) look like ad-hoc test data:")
                for d in doomed:
                    print(
                        f"  - {d.document_id[:8]}  title={d.title!r}  "
                        f"dept={d.department!r}  type={d.document_type}"
                    )
            else:
                print("--purge-demo: no junk rows found")

            if not dry_run and doomed:
                for d in doomed:
                    db.delete(d)
                db.commit()
                print(f"  deleted {len(doomed)} row(s)\n")
            elif doomed:
                print("  (dry run — nothing deleted)\n")

        # ── Seed ─────────────────────────────────────────────────────────────
        # Documents require uploaded_by -> User FK; use the engineer account.
        uploader = db.scalars(
            select(User).where(User.username == "engineer")
        ).first()
        if uploader is None:
            raise SystemExit(
                "No 'engineer' user found. Start the API once so it seeds demo "
                "users, then re-run this script."
            )

        existing_hashes = set(db.scalars(select(Document.content_hash)).all())
        added, skipped = 0, 0

        for title, dtype, revision, eff, dept, equip in CORPUS:
            chash = content_hash_for(title)
            if chash in existing_hashes:
                skipped += 1
                continue
            if dry_run:
                print(f"  would insert  {dtype:<11} {title}")
                continue
            db.add(
                Document(
                    document_id=f"doc-{uuid.uuid4().hex[:16]}",
                    title=title,
                    document_type=dtype,
                    revision=revision,
                    effective_date=eff,
                    department=dept,
                    equipment_id=equip,
                    confidentiality_level="internal",
                    allowed_roles=["engineer", "supervisor", "admin"],
                    content_hash=chash,
                    status="indexed",
                    file_path=f"demo/p204/{chash[:16]}",
                    file_size=0,
                    uploaded_by=uploader.id,
                    uploaded_at=datetime.now(timezone.utc),
                )
            )
            existing_hashes.add(chash)
            added += 1

        if not dry_run:
            db.commit()
            total = db.query(Document).count()
            print(
                f"\nseeded {added} document(s), skipped {skipped} already present "
                f"| library total: {total}"
            )
        else:
            print(
                f"\nDRY RUN complete — would insert {added}, "
                f"skip {skipped} already present"
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
