
import httpx

BASE = "http://127.0.0.1:8000"
c = httpx.Client(timeout=120.0, base_url=BASE)
sup = {
    "Authorization": "Bearer "
    + c.post("/api/auth/login", json={"username": "supervisor", "password": "nirva-demo-pass"}).json()[
        "access_token"
    ]
}
approval_id = "2438ea20-4cdc-4cd3-b818-c17d01873a4b"
r = c.post(
    f"/api/approvals/{approval_id}/decision",
    json={"decision": "approved", "comment": "reproduced from operator console"},
    headers=sup,
)
print("status:", r.status_code)
print("cors header:", r.headers.get("access-control-allow-origin"))
print("body:", r.text[:400])
