"""Re-index the malicious vendor note with all-roles ACL (operator-approved).

Deletes the old document row + Qdrant points, then re-uploads via the real
API so ingestion, chunking, and ACL all run fresh. Requires the API server
running and DATABASE_URL pointing at the same DB the server uses.
"""

import os
import sys
from pathlib import Path

os.environ.setdefault(
    "DATABASE_URL", "sqlite:///D:/projects/Nirva/nirva/apps/api/_server.db"
)
sys.path.insert(0, os.path.abspath("apps/api"))

import httpx  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.models import Document  # noqa: E402
from qdrant_client import QdrantClient, models  # noqa: E402

BASE = "http://127.0.0.1:8000"
TITLE = "Seal Supplier Batch Advisory"
SOURCE = Path("data/synthetic/generated/malicious_vendor_note.pdf")

db = SessionLocal()
try:
    rows = db.query(Document).filter(Document.title == TITLE).all()
    qdrant = QdrantClient(url="http://127.0.0.1:6333", timeout=30, check_compatibility=False)
    for row in rows:
        print(f"purging {row.document_id} ({row.status})")
        qdrant.delete(
            collection_name="nirva_chunks",
            points_selector=models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id", match=models.MatchValue(value=row.document_id)
                    )
                ]
            ),
        )
        db.delete(row)
    db.commit()
finally:
    db.close()

c = httpx.Client(timeout=300.0, base_url=BASE)
tok = c.post("/api/auth/login", json={"username": "admin", "password": "nirva-demo-pass"}).json()[
    "access_token"
]
h = {"Authorization": f"Bearer {tok}"}
with SOURCE.open("rb") as fh:
    r = c.post(
        "/api/documents/upload",
        files={"file": (SOURCE.name, fh)},
        data={
            "title": TITLE,
            "document_type": "manual",
            "revision": "A",
            "effective_date": "2026-05-01",
            "department": "Procurement",
            "equipment_id": "P-204",
            "allowed_roles": "engineer,safety_officer,supervisor,admin",
        },
        headers=h,
    )
print("re-indexed:", r.status_code, r.json())
