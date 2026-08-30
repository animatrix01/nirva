import json
import time

import httpx

c = httpx.Client(timeout=300.0, base_url="http://127.0.0.1:8000")
eng = {
    "Authorization": "Bearer "
    + c.post("/api/auth/login", json={"username": "engineer", "password": "nirva-demo-pass"}).json()[
        "access_token"
    ]
}
jid = c.post(
    "/api/jobs",
    json={
        "objective": "Is there visible leakage or wear on pump P-204? Check the inspection photo.",
        "equipment_id": "P-204",
    },
    headers=eng,
).json()["job_id"]
print("job:", jid[:8])
t0 = time.time()
with c.stream("GET", f"/api/jobs/{jid}/events", headers=eng) as resp:
    for line in resp.iter_lines():
        if line.startswith("data: "):
            p = json.loads(line[6:])
            if p["type"] in ("completed", "failed", "awaiting_approval"):
                print("terminal:", p["type"], f"({time.time() - t0:.0f}s)")
                break

detail = c.get(f"/api/jobs/{jid}", headers=eng).json()
rep = detail.get("final_report") or {}
print("status:", detail["status"], "| confidence:", rep.get("confidence"))
for cit in rep.get("citations", []):
    title_lower = cit["title"].lower()
    marker = " <-- VISION" if ("vision" in title_lower or "photo" in title_lower) else ""
    print(f"  [{cit['title']} | {cit['locator']}]{marker}")
findings = rep.get("findings", "").lower()
print("findings mention leak/photo:", ("leak" in findings) or ("photo" in findings))
