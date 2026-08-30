"""Run the golden P-204 investigation through the live API and wait for
awaiting_approval — restores the flagship demo card after DB cleanup."""

import json
import time

import httpx

BASE = "http://127.0.0.1:8000"
OBJECTIVE = (
    "Investigate why Pump P-204 has failed repeatedly during the last three months. "
    "Identify the most likely cause, cite the supporting records, check spare-part "
    "availability, and propose a safe next action."
)

c = httpx.Client(timeout=300.0, base_url=BASE)
eng = {
    "Authorization": "Bearer "
    + c.post("/api/auth/login", json={"username": "engineer", "password": "nirva-demo-pass"}).json()[
        "access_token"
    ]
}
jid = c.post(
    "/api/jobs",
    json={"objective": OBJECTIVE, "equipment_id": "P-204"},
    headers=eng,
).json()["job_id"]
print("job:", jid)

t0 = time.time()
with c.stream("GET", f"/api/jobs/{jid}/events", headers=eng) as resp:
    for line in resp.iter_lines():
        if line.startswith("data: "):
            p = json.loads(line[6:])
            if p["type"] in ("completed", "failed", "awaiting_approval"):
                print("reached:", p["type"], f"({time.time() - t0:.0f}s)")
                break

detail = c.get(f"/api/jobs/{jid}", headers=eng).json()
rep = detail.get("final_report") or {}
inj = c.get(
    "/api/audit", params={"job_id": jid, "action": "security.injection_blocked"}, headers=eng
).json()
print("status:", detail["status"], "| confidence:", rep.get("confidence"))
print("citations:", len(rep.get("citations", [])))
print("injection blocked:", len(inj["events"]) > 0)
print("--- awaiting_approval demo card restored")
