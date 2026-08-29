"""Seed operational tables (asset history + inventory) for the demo.

Idempotent: skips rows that already exist. Targets the API server's database
via DATABASE_URL (default: the live dev server DB).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

os.environ.setdefault("DATABASE_URL", "sqlite:///./_server.db")

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.models import AssetEvent, InventoryItem  # noqa: E402
from sqlalchemy import select  # noqa: E402

ASSET_EVENTS = [
    ("2026-04-22", "WO-2026-0087 closed: seal kit replaced; vibration 3.1 mm/s RMS at restart test"),
    ("2026-05-30", "WO-2026-0101 closed: gland torqued; flush pressure still marginal at 1.2 bar above suction"),
    ("2026-06-18", "Vibration alarm 5.2 mm/s RMS; seal weeping observed; reliability notified"),
    ("2026-07-02", "WO-2026-0112 closed: coupling alignment completed successfully (work-order record)"),
    ("2026-07-16", "Inspection: misalignment 0.21 mm confirmed; alignment correction NOT completed per inspection report"),
    ("2026-07-28", "Continued degradation; seal leakage heavy; operating at reduced margin"),
]

INVENTORY = [
    ("SEAL-P204-KIT", "P-204 cartridge mechanical seal kit", "MH-STORE-A", 2, "2026-07-20"),
    ("COUP-P204-A", "P-204 coupling element set", "MH-STORE-B", 0, "2026-07-18"),
    ("GBL-P204-SET", "P-204 gland gasket set", "MH-STORE-A", 6, "2026-07-10"),
    ("LUB-TURB-46", "Turbine oil ISO VG46 (bearing lube)", "LUB-STORE", 14, "2026-07-25"),
]


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        added = 0
        for ts, description in ASSET_EVENTS:
            exists = db.scalars(
                select(AssetEvent).where(
                    AssetEvent.equipment_id == "P-204", AssetEvent.source_timestamp == ts
                )
            ).first()
            if exists is None:
                db.add(
                    AssetEvent(
                        equipment_id="P-204", event_type="maintenance", description=description, source_timestamp=ts
                    )
                )
                added += 1
        for part, description, location, qty, updated in INVENTORY:
            if db.get(InventoryItem, part) is None:
                db.add(
                    InventoryItem(
                        part_number=part, description=description, location=location,
                        available_qty=qty, last_updated=updated,
                    )
                )
                added += 1
        db.commit()
        events = db.query(AssetEvent).count()
        items = db.query(InventoryItem).count()
        print(f"seeded {added} rows | totals: {events} asset events, {items} inventory items")
    finally:
        db.close()


if __name__ == "__main__":
    main()
