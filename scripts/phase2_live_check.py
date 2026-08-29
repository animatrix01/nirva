"""Phase 2 live gate: upload corpus via the real API, then run a golden
P-204 investigation end-to-end (real retrieval, real Ollama, real citations).
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./_live2.db"
os.environ["JWT_SECRET"] = "x" * 40
os.environ["MODEL_BASE_URL"] = "http://127.0.0.1:11434/v1"
os.environ["QDRANT_URL"] = "http://127.0.0.1:6333"
os.environ["STORAGE_PATH"] = "./_live_storage"

sys.path.insert(0, os.path.abspath("apps/api"))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402

GENERATED = Path("data/synthetic/generated")

DOCS = [
    ("P204_maintenance_manual.pdf", "P-204 OEM Maintenance Manual", "manual", "B", "Maintenance", "P-204"),
    ("P204_inspection_2026_06.pdf", "P-204 Inspection Report June 2026", "incident", "A", "Reliability", "P-204"),
    ("P204_inspection_2026_07.pdf", "P-204 Inspection Report July 2026", "incident", "A", "Reliability", "P-204"),
    ("P204_work_orders.csv", "P-204 Work Order History", "work_order", "1", "Maintenance", "P-204"),
    ("P204_shift_log.csv", "P-204 Shift Operating Log", "data", "1", "Operations", "P-204"),
    ("P204_inventory.csv", "Spare Parts Inventory", "data", "1", "Stores", None),
    ("malicious_vendor_note.pdf", "Seal Supplier Batch Advisory", "manual", "A", "Procurement", "P-204"),
]

OBJECTIVE = (
    "Investigate why Pump P-204 has failed repeatedly during the last three months. "
    "Identify the most likely cause, cite the supporting records, check spare-part "
    "availability, and propose a safe next action."
)

app = create_app()
with TestClient(app) as c:
    h = {"Authorization": "Bearer " + c.post("/api/auth/login", json={"username": "engineer", "password": "nirva-demo-pass"}).json()["access_token"]}

    print("--- uploading corpus via POST /api/documents/upload")
    for filename, title, dtype, revision, department, equipment in DOCS:
        path = GENERATED / filename
        with path.open("rb") as fh:
            response = c.post(
                "/api/documents/upload",
                files={"file": (filename, fh)},
                data={
                    "title": title,
                    "document_type": dtype,
                    "revision": revision,
                    "effective_date": "2026-01-01",
                    "department": department,
                    "equipment_id": equipment or "",
                    "allowed_roles": "engineer,safety_officer,supervisor,admin",
                },
                headers=h,
            )
        print(f"  {filename}: {response.status_code} {response.json()}")

    docs = c.get("/api/documents", headers=h).json()
    print(f"--- document library: {len(docs)} documents")

    print("--- submitting golden investigation")
    jid = c.post("/api/jobs", json={"objective": OBJECTIVE, "equipment_id": "P-204"}, headers=h).json()["job_id"]
    t0 = time.time()
    with c.stream("GET", f"/api/jobs/{jid}/events", headers=h) as resp:
        for line in resp.iter_lines():
            if line.startswith("data: "):
                p = json.loads(line[6:])
                print(f"  {p['seq']} {p['type']:16} {p['node']:9} ({time.time() - t0:.1f}s)")

    detail = c.get(f"/api/jobs/{jid}", headers=h).json()
    report = detail.get("final_report") or {}
    print("STATUS:", detail["status"], "| CONFIDENCE:", report.get("confidence"))
    print("CITATIONS:", json.dumps(report.get("citations", []), indent=1)[:600])
    print("FINDINGS:", (report.get("findings") or "")[:500])
