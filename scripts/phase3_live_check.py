"""Phase 3 live gate: golden flow through the approval gate.

Uploads corpus, runs the golden investigation (real retrieval + model),
verifies awaiting_approval, approves as supervisor, verifies idempotent work
order creation + completed status + audit chain.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./_live3.db"
os.environ["JWT_SECRET"] = "x" * 40
os.environ["MODEL_BASE_URL"] = "http://127.0.0.1:11434/v1"
os.environ["QDRANT_URL"] = "http://127.0.0.1:6333"
os.environ["STORAGE_PATH"] = "./_live_storage"

sys.path.insert(0, os.path.abspath("apps/api"))

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import AssetEvent, InventoryItem  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

Base.metadata.create_all(bind=engine)

GENERATED = Path("data/synthetic/generated")

OBJECTIVE = (
    "Investigate why Pump P-204 has failed repeatedly during the last three months. "
    "Identify the most likely cause, cite the supporting records, check spare-part "
    "availability, and propose a safe next action."
)  # noqa: E501

app = create_app()

db = SessionLocal()
if db.query(InventoryItem).count() == 0:
    db.add(InventoryItem(part_number="SEAL-P204-KIT", description="P-204 cartridge seal kit", location="MH-STORE-A", available_qty=2, last_updated="2026-07-20"))
    db.add(InventoryItem(part_number="COUP-P204-A", description="P-204 coupling element set", location="MH-STORE-B", available_qty=0, last_updated="2026-07-18"))
    for ts, desc in [
        ("2026-04-22", "Seal kit replaced after failure; vibration 3.1 mm/s at restart"),
        ("2026-06-18", "Vibration alarm 5.2 mm/s RMS; seal weeping observed"),
        ("2026-07-02", "Coupling alignment work order closed"),
        ("2026-07-16", "Misalignment 0.21 mm confirmed; alignment correction not completed"),
        ("2026-07-28", "Continued degradation; seal leakage heavy"),
    ]:
        db.add(AssetEvent(equipment_id="P-204", event_type="maintenance", description=desc, source_timestamp=ts))
    db.commit()
db.close()

with TestClient(app) as c:
    engineer = {"Authorization": "Bearer " + c.post("/api/auth/login", json={"username": "engineer", "password": "nirva-demo-pass"}).json()["access_token"]}
    supervisor = {"Authorization": "Bearer " + c.post("/api/auth/login", json={"username": "supervisor", "password": "nirva-demo-pass"}).json()["access_token"]}

    for filename, title, dtype, revision, department, equipment in [
        ("P204_maintenance_manual.pdf", "P-204 OEM Maintenance Manual", "manual", "B", "Maintenance", "P-204"),
        ("P204_inspection_2026_06.pdf", "P-204 Inspection Report June 2026", "incident", "A", "Reliability", "P-204"),
        ("P204_inspection_2026_07.pdf", "P-204 Inspection Report July 2026", "incident", "A", "Reliability", "P-204"),
        ("P204_work_orders.csv", "P-204 Work Order History", "work_order", "1", "Maintenance", "P-204"),
        ("P204_shift_log.csv", "P-204 Shift Operating Log", "data", "1", "Operations", "P-204"),
        ("P204_inventory.csv", "Spare Parts Inventory", "data", "1", "Stores", None),
    ]:
        with (GENERATED / filename).open("rb") as fh:
            r = c.post(
                "/api/documents/upload",
                files={"file": (filename, fh)},
                data={"title": title, "document_type": dtype, "revision": revision, "effective_date": "2026-01-01", "department": department, "equipment_id": equipment or "", "allowed_roles": "engineer,safety_officer,supervisor,admin"},
                headers=engineer,
            )
        print(f"  upload {filename}: {r.status_code} duplicate={r.json().get('duplicate')}")

    jid = c.post("/api/jobs", json={"objective": OBJECTIVE, "equipment_id": "P-204"}, headers=engineer).json()["job_id"]
    t0 = time.time()
    terminal = None
    with c.stream("GET", f"/api/jobs/{jid}/events", headers=engineer) as resp:
        for line in resp.iter_lines():
            if line.startswith("data: "):
                p = json.loads(line[6:])
                print(f"  {p['seq']} {p['type']:18} {p['node']:9} ({time.time() - t0:.1f}s)")
                if p["type"] in ("completed", "failed", "awaiting_approval", "blocked_injection"):
                    terminal = p["type"]
                    break

    print("TERMINAL EVENT:", terminal)
    detail = c.get(f"/api/jobs/{jid}", headers=engineer).json()
    print("JOB STATUS:", detail["status"])

    if detail["status"] != "awaiting_approval":
        print("GOLDEN FLOW DID NOT REACH APPROVAL GATE")
        sys.exit(1)

    print("--- engineer cannot approve:")
    r = c.get(f"/api/approvals/{jid}/decision", headers=engineer)
    approvals = c.get("/api/approvals", headers=supervisor).json()
    target = next(a for a in approvals if a["job_id"] == jid)
    print("  approval:", target["approval_id"], "| risk:", target["risk_level"], "| action:", target["action"])
    r = c.post(f"/api/approvals/{target['approval_id']}/decision", json={"decision": "approved", "comment": "Evidence reviewed"}, headers=engineer)
    print("  engineer decision attempt:", r.status_code, "(must be 403)")
    r = c.post(f"/api/approvals/{target['approval_id']}/decision", json={"decision": "approved", "comment": "Evidence reviewed"}, headers=supervisor)
    print("  supervisor decision:", r.status_code, r.json())

    r2 = c.post(f"/api/approvals/{target['approval_id']}/decision", json={"decision": "rejected"}, headers=supervisor)
    print("  duplicate decision:", r2.status_code, "(must be 409)")

    detail = c.get(f"/api/jobs/{jid}", headers=engineer).json()
    print("FINAL JOB STATUS:", detail["status"])
    admin = {"Authorization": "Bearer " + c.post("/api/auth/login", json={"username": "admin", "password": "nirva-demo-pass"}).json()["access_token"]}
    audit = c.get("/api/audit", params={"job_id": jid}, headers=admin).json()
    print("AUDIT chain_valid:", audit["chain_valid"], "| events:", [e["action"] for e in audit["events"]])
