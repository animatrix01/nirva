import os
import sys
import traceback

os.environ["DATABASE_URL"] = "sqlite:///D:/projects/Nirva/nirva/apps/api/_server.db"
os.environ["JWT_SECRET"] = "x" * 40
os.environ["MODEL_BASE_URL"] = "http://127.0.0.1:11434/v1"
os.environ["QDRANT_URL"] = "http://127.0.0.1:6333"
sys.path.insert(0, os.path.abspath("apps/api"))

from app.main import create_app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

app = create_app()
with TestClient(app) as c:
    sup = {
        "Authorization": "Bearer "
        + c.post("/api/auth/login", json={"username": "supervisor", "password": "nirva-demo-pass"}).json()[
            "access_token"
        ]
    }
    try:
        r = c.post(
            "/api/approvals/2438ea20-4cdc-4cd3-b818-c17d01873a4b/decision",
            json={"decision": "approved", "comment": "traceback reproduction"},
            headers=sup,
        )
        print("status:", r.status_code, r.text[:200])
    except Exception:
        traceback.print_exc()
