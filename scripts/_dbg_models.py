import httpx

c = httpx.Client(timeout=60.0, base_url="http://127.0.0.1:8000")
adm = {
    "Authorization": "Bearer "
    + c.post("/api/auth/login", json={"username": "admin", "password": "nirva-demo-pass"}).json()[
        "access_token"
    ]
}
r = c.get("/api/admin/models", headers=adm)
print("status:", r.status_code)
for m in r.json():
    print(f"  {m['model_name']:34} {m['purpose']:11} loaded={m['loaded']}")
