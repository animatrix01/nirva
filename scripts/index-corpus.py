"""Index the synthetic P-204 corpus: parse -> chunk -> embed -> Qdrant upsert.

Run after generate_corpus.py. Uses the local stack only: Qdrant at QDRANT_URL,
embeddings via MODEL_BASE_URL (bge-m3 on Ollama). Idempotent: re-running
re-upserts identical chunk ids.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "packages" / "retrieval" / "src"))

from nirva_retrieval.chunking import chunk_document  # noqa: E402
from nirva_retrieval.embed import dense_embeddings, sparse_embedding  # noqa: E402
from nirva_retrieval.parse import parse_csv, parse_pdf  # noqa: E402
from nirva_retrieval.store import ensure_collection, upsert_chunks  # noqa: E402
from qdrant_client import QdrantClient, models  # noqa: E402

GENERATED = Path(__file__).resolve().parents[1] / "data" / "synthetic" / "generated"

DOCUMENTS: list[tuple[Path, dict[str, object], str]] = [
    (
        GENERATED / "P204_maintenance_manual.pdf",
        {
            "document_id": "p204-manual",
            "document_title": "P-204 OEM Maintenance Manual",
            "document_type": "manual",
            "revision": "B",
            "effective_date": "2025-01-01",
            "department": "Maintenance",
            "equipment_id": "P-204",
            "confidentiality_level": "internal",
            "allowed_roles": ["engineer", "safety_officer", "supervisor", "admin"],
        },
        "pdf",
    ),
    (
        GENERATED / "P204_inspection_2026_06.pdf",
        {
            "document_id": "p204-insp-06",
            "document_title": "P-204 Inspection Report June 2026",
            "document_type": "incident",
            "revision": "A",
            "effective_date": "2026-06-18",
            "department": "Reliability",
            "equipment_id": "P-204",
            "confidentiality_level": "internal",
            "allowed_roles": ["engineer", "safety_officer", "supervisor", "admin"],
        },
        "pdf",
    ),
    (
        GENERATED / "P204_inspection_2026_07.pdf",
        {
            "document_id": "p204-insp-07",
            "document_title": "P-204 Inspection Report July 2026",
            "document_type": "incident",
            "revision": "A",
            "effective_date": "2026-07-16",
            "department": "Reliability",
            "equipment_id": "P-204",
            "confidentiality_level": "internal",
            "allowed_roles": ["engineer", "safety_officer", "supervisor", "admin"],
        },
        "pdf",
    ),
    (
        GENERATED / "P204_work_orders.csv",
        {
            "document_id": "p204-workorders",
            "document_title": "P-204 Work Order History",
            "document_type": "work_order",
            "revision": "1",
            "effective_date": "2026-07-02",
            "department": "Maintenance",
            "equipment_id": "P-204",
            "confidentiality_level": "internal",
            "allowed_roles": ["engineer", "safety_officer", "supervisor", "admin"],
        },
        "csv",
    ),
    (
        GENERATED / "P204_shift_log.csv",
        {
            "document_id": "p204-shiftlog",
            "document_title": "P-204 Shift Operating Log",
            "document_type": "data",
            "revision": "1",
            "effective_date": "2026-07-28",
            "department": "Operations",
            "equipment_id": "P-204",
            "confidentiality_level": "internal",
            "allowed_roles": ["engineer", "safety_officer", "supervisor", "admin"],
        },
        "csv",
    ),
    (
        GENERATED / "P204_inventory.csv",
        {
            "document_id": "p204-inventory",
            "document_title": "Spare Parts Inventory",
            "document_type": "data",
            "revision": "1",
            "effective_date": "2026-07-25",
            "department": "Stores",
            "equipment_id": None,
            "confidentiality_level": "internal",
            "allowed_roles": ["engineer", "safety_officer", "supervisor", "admin"],
        },
        "csv",
    ),
    (
        GENERATED / "malicious_vendor_note.pdf",
        {
            "document_id": "vendor-note-044",
            "document_title": "Seal Supplier Batch Advisory",
            "document_type": "manual",
            "revision": "A",
            "effective_date": "2026-05-01",
            "department": "Procurement",
            "equipment_id": "P-204",
            "confidentiality_level": "internal",
            "allowed_roles": ["supervisor", "admin"],
        },
        "pdf",
    ),
]


def main() -> None:
    qdrant_url = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
    model_base = os.environ.get("MODEL_BASE_URL", "http://127.0.0.1:11434/v1")
    client = QdrantClient(url=qdrant_url, timeout=30, check_compatibility=False)
    ensure_collection(client)

    total = 0
    for path, base, kind in DOCUMENTS:
        if not path.exists():
            print(f"SKIP missing {path.name} (run generate_corpus.py first)")
            continue
        parsed = parse_pdf(path, base) if kind == "pdf" else parse_csv(path, base)
        chunks = chunk_document(parsed, chunk_id_prefix="chk")
        texts = [chunk.text for chunk in chunks]
        dense = dense_embeddings(texts, base_url=model_base)
        vectors = []
        for d, text in zip(dense, texts, strict=True):
            sparse = sparse_embedding(text)
            vectors.append(
                {
                    "dense": d,
                    "sparse": models.SparseVector(
                        indices=list(sparse.keys()), values=list(sparse.values())
                    ),
                }
            )
        count = upsert_chunks(client, chunks, vectors)
        total += count
        print(f"indexed {path.name}: {count} chunks")
    print(f"TOTAL chunks indexed: {total}")


if __name__ == "__main__":
    main()
