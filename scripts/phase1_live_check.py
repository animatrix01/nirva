import json
import os
import sys
import time

os.environ["DATABASE_URL"] = "sqlite:///./_live.db"
os.environ["JWT_SECRET"] = "x" * 40
os.environ["MODEL_BASE_URL"] = "http://127.0.0.1:11434/v1"
sys.path.insert(0, os.path.abspath("apps/api"))

from app.main import create_app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

app = create_app()
with TestClient(app) as c:
    r = c.post("/api/auth/login", json={"username": "engineer", "password": "nirva-demo-pass"})
    h = {"Authorization": "Bearer " + r.json()["access_token"]}
    rr = c.post(
        "/api/jobs",
        json={"objective": "Investigate why Pump P-204 has failed repeatedly."},
        headers=h,
    )
    jid = rr.json()["job_id"]
    print("job:", jid)
    t0 = time.time()
    with c.stream("GET", f"/api/jobs/{jid}/events", headers=h) as resp:
        for line in resp.iter_lines():
            if line.startswith("data: "):
                p = json.loads(line[6:])
                elapsed = time.time() - t0
                print(f"  {p['seq']} {p['type']:14} {p['node']:9} ({elapsed:.1f}s)")
    j = c.get(f"/api/jobs/{jid}", headers=h).json()
    print("STATUS:", j["status"])
    report = j["final_report"] or {}
    print("CONFIDENCE:", report.get("confidence"))
    print("REPORT:", (report.get("findings") or "")[:400])
