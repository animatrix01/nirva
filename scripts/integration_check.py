"""Integration verification against the LIVE uvicorn server on :8000.

Covers what Terminal B needs before flipping NEXT_PUBLIC_MOCK off:
CORS, login, documents content, evidence chunk, artifacts, SSE + approval.
"""

from __future__ import annotations

import json
import time

import httpx

BASE = "http://127.0.0.1:8000"

client = httpx.Client(timeout=180.0, base_url=BASE)

# 1. CORS preflight
preflight = client.options(
    "/api/auth/login",
    headers={
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    },
)
cors_ok = preflight.headers.get("access-control-allow-origin")
print(f"1. CORS preflight: {preflight.status_code} allow-origin={cors_ok}")

# 2. Login
token = client.post("/api/auth/login", json={"username": "engineer", "password": "nirva-demo-pass"}).json()["access_token"]
eng = {"Authorization": f"Bearer {token}"}
sup_token = client.post("/api/auth/login", json={"username": "supervisor", "password": "nirva-demo-pass"}).json()["access_token"]
sup = {"Authorization": f"Bearer {sup_token}"}
print("2. login: ok (engineer + supervisor)")

# 3. Document library + content deep-link
docs = client.get("/api/documents", headers=eng).json()
print(f"3. documents: {len(docs)} docs")
content_ok = False
if docs:
    doc_id = docs[0]["document_id"]
    r = client.get(f"/api/documents/{doc_id}/content", headers=eng)
    content_ok = r.status_code == 200 and "chunks" in r.json()
    print(f"   content deep-link: {r.status_code} chunks={len(r.json().get('chunks', []))}")

# 4. Golden investigation over SSE
OBJECTIVE = (
    "Investigate why Pump P-204 has failed repeatedly during the last three months. "
    "Identify the most likely cause, cite the supporting records, check spare-part "
    "availability, and propose a safe next action."
)
jid = client.post("/api/jobs", json={"objective": OBJECTIVE, "equipment_id": "P-204"}, headers=eng).json()["job_id"]
print(f"4. job created: {jid}")
terminal = None
t0 = time.time()
events: list[dict] = []
with client.stream("GET", f"/api/jobs/{jid}/events", headers=eng) as resp:
    for line in resp.iter_lines():
        if line.startswith("data: "):
            p = json.loads(line[6:])
            events.append(p)
            if p["type"] in ("completed", "failed", "awaiting_approval", "blocked_injection"):
                terminal = p["type"]
                break
print(f"   streamed {len(events)} events in {time.time() - t0:.0f}s; terminal={terminal}")

detail = client.get(f"/api/jobs/{jid}", headers=eng).json()
report = detail.get("final_report") or {}
citations = report.get("citations", [])
print(f"   status={detail['status']} confidence={report.get('confidence')} citations={len(citations)}")

# 5. Evidence chunk endpoint (web proposal shape) + citation->document resolution
ok = True
if citations:
    chunk_id = citations[0]["chunk_id"]
    r = client.get(f"/api/jobs/{jid}/evidence/{chunk_id}", headers=eng)
    body = r.json()
    print(f"5. evidence: {r.status_code} keys={sorted(body.keys())}")
    ok = r.status_code == 200 and body.get("passage_text") and body.get("why_retrieved")

    stale = []
    for cit in citations:
        ev = client.get(f"/api/jobs/{jid}/evidence/{cit['chunk_id']}", headers=eng)
        if ev.status_code != 200:
            stale.append((cit["chunk_id"], f"evidence {ev.status_code}"))
            continue
        body = ev.json()
        if body.get("source") == "tool":
            continue  # tool results are passages, not documents: no deep-link
        doc_id = body.get("document_id")
        dc = client.get(f"/api/documents/{doc_id}/content", headers=eng)
        if dc.status_code != 200:
            stale.append((cit["chunk_id"], f"doc {doc_id} -> {dc.status_code}"))
    print(f"   citation resolution: {len(citations) - len(stale)}/{len(citations)} resolve (stale: {stale})")
    ok = ok and not stale

# 6. Artifacts (approval_request while pending)
if detail["status"] == "awaiting_approval":
    r = client.get(f"/api/jobs/{jid}/artifacts/approval_request", headers=eng)
    art = r.json()
    print(f"6. artifacts approval_request: {r.status_code} kind={art.get('kind')} action={art.get('approval', {}).get('action')}")
    # supervisor decision
    approvals = client.get("/api/approvals", headers=sup).json()
    target = next(a for a in approvals if a["job_id"] == jid)
    d = client.post(f"/api/approvals/{target['approval_id']}/decision", json={"decision": "approved"}, headers=sup)
    print(f"   supervisor decision: {d.status_code} wo={d.json().get('work_order_id')}")
    d2 = client.post(f"/api/approvals/{target['approval_id']}/decision", json={"decision": "rejected"}, headers=sup)
    print(f"   duplicate decision: {d2.status_code} (409 expected)")
    final = client.get(f"/api/jobs/{jid}", headers=eng).json()
    print(f"   final status: {final['status']}")
    r = client.get(f"/api/jobs/{jid}/artifacts/report", headers=eng)
    print(f"   artifacts report: {r.status_code} kind={r.json().get('kind')}")
    audit = client.get("/api/audit", params={"job_id": jid}, headers=sup)
else:
    ok = False
    print("6. SKIPPED (job not awaiting approval)")

admin = {"Authorization": "Bearer " + client.post("/api/auth/login", json={"username": "admin", "password": "nirva-demo-pass"}).json()["access_token"]}
audit = client.get("/api/audit", params={"job_id": jid}, headers=admin).json()
print(f"7. audit: chain_valid={audit['chain_valid']} events={[e['action'] for e in audit['events']]}")

print()
print(f"INTEGRATION RESULT: {'ALL GREEN' if (cors_ok and content_ok and ok and audit['chain_valid']) else 'CHECK FAILURES ABOVE'}")
