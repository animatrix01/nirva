"""Live recheck of Terminal B's three stale blockers against the current server."""

import io
import json

import httpx
from PIL import Image

c = httpx.Client(timeout=300.0, base_url="http://127.0.0.1:8000")
eng = {
    "Authorization": "Bearer "
    + c.post("/api/auth/login", json={"username": "engineer", "password": "nirva-demo-pass"}).json()[
        "access_token"
    ]
}

print("--- 1. PNG upload (their case) as engineer:")
buf = io.BytesIO()
Image.new("RGB", (200, 140), (110, 110, 110)).save(buf, "PNG")
buf.seek(0)
r = c.post(
    "/api/documents/upload",
    files={"file": ("tb_test.png", buf, "image/png")},
    data={
        "title": "PNG live recheck",
        "document_type": "data",
        "revision": "1",
        "effective_date": "2026-01-01",
        "department": "Reliability",
        "allowed_roles": "engineer,admin",
    },
    headers=eng,
)
print("   ", r.status_code, r.json())
doc_id = r.json()["document_id"]
content = c.get(f"/api/documents/{doc_id}/content", headers=eng).json()
print(
    "    chunks:",
    len(content["chunks"]),
    "| text:",
    content["chunks"][0]["text"][:100] if content["chunks"] else "NONE",
)

print("--- 2. fresh golden job -> blocked_injection fires?")
jid = c.post(
    "/api/jobs",
    json={
        "objective": (
            "Investigate why Pump P-204 has failed repeatedly during the last three months. "
            "Identify the most likely cause, cite the supporting records, check spare-part "
            "availability, and propose a safe next action."
        ),
        "equipment_id": "P-204",
    },
    headers=eng,
).json()["job_id"]
with c.stream("GET", f"/api/jobs/{jid}/events", headers=eng) as resp:
    for line in resp.iter_lines():
        if line.startswith("data: "):
            p = json.loads(line[6:])
            if p["type"] in ("completed", "failed", "awaiting_approval"):
                print("    stream reached:", p["type"])
                break
adm = {
    "Authorization": "Bearer "
    + c.post("/api/auth/login", json={"username": "admin", "password": "nirva-demo-pass"}).json()[
        "access_token"
    ]
}
audit = c.get(
    "/api/audit",
    params={"job_id": jid, "action": "security.injection_blocked"},
    headers=adm,
).json()
print(
    "    injection_blocked rows for this job:",
    len(audit["events"]),
    "| chain_valid:",
    audit["chain_valid"],
)
