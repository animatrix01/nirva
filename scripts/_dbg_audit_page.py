"""Read-only audit diagnosis: does the injection_blocked event exist, and what
does the default (unfiltered) audit listing actually return?"""

import httpx

c = httpx.Client(timeout=60.0, base_url="http://127.0.0.1:8000")
adm = {
    "Authorization": "Bearer "
    + c.post("/api/auth/login", json={"username": "admin", "password": "nirva-demo-pass"}).json()[
        "access_token"
    ]
}

total = c.get("/api/audit", params={"limit": 500}, headers=adm).json()
print("total events returned at limit=500:", len(total["events"]), "chain_valid:", total["chain_valid"])

inj = c.get(
    "/api/audit", params={"action": "security.injection_blocked", "limit": 500}, headers=adm
).json()
print("injection_blocked events (filtered):", len(inj["events"]))
for e in inj["events"][:3]:
    print("  ", e["ts"], e["action"], "|", e["argument_summary"][:70])

default = c.get("/api/audit", headers=adm).json()
first_ts = default["events"][0]["ts"] if default["events"] else None
last_ts = default["events"][-1]["ts"] if default["events"] else None
print(f"DEFAULT page (limit=100): {len(default['events'])} rows, first={first_ts}, last={last_ts}")
