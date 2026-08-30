"""Demo library cleanup: keep only the corpus + photo, purge everything else."""

import os
import sys

os.environ.setdefault(
    "DATABASE_URL", "sqlite:///D:/projects/Nirva/nirva/apps/api/_server.db"
)
sys.path.insert(0, os.path.abspath("apps/api"))

from app.db import SessionLocal  # noqa: E402
from app.models import Document  # noqa: E402
from qdrant_client import QdrantClient, models  # noqa: E402

KEEP_TITLES = {
    "P-204 OEM Maintenance Manual",
    "P-204 Inspection Report June 2026",
    "P-204 Inspection Report July 2026",
    "P-204 Work Order History",
    "P-204 Shift Operating Log",
    "Spare Parts Inventory",
    "Seal Supplier Batch Advisory",
    "P-204 Photo (vision inspection)",
}

db = SessionLocal()
qdrant = QdrantClient(url="http://127.0.0.1:6333", timeout=30, check_compatibility=False)
try:
    docs = db.query(Document).all()
    purged = 0
    for doc in docs:
        if doc.title in KEEP_TITLES:
            continue
        print(f"purging: {doc.title} ({doc.document_id}, {doc.status})")
        qdrant.delete(
            collection_name="nirva_chunks",
            points_selector=models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id", match=models.MatchValue(value=doc.document_id)
                    )
                ]
            ),
        )
        db.delete(doc)
        purged += 1
    db.commit()
    remaining = db.query(Document).count()
    print(f"purged {purged} | library now: {remaining} documents")
finally:
    db.close()
    qdrant.close()
