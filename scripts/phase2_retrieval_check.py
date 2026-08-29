"""Phase 2 retrieval verification: hybrid search quality + zero ACL leakage."""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "packages" / "retrieval" / "src"))

from nirva_retrieval.embed import dense_embeddings, sparse_embedding  # noqa: E402
from nirva_retrieval.search import search_documents  # noqa: E402
from qdrant_client import QdrantClient  # noqa: E402

QDRANT_URL = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
MODEL_BASE_URL = os.environ.get("MODEL_BASE_URL", "http://127.0.0.1:11434/v1")

QUERIES = [
    "seal replacement interval operating hours",
    "vibration alarm threshold mm/s",
    "coupling alignment correction completed",
    "SEAL-P204-KIT inventory available quantity",
    "what is the capital of France",  # abstention probe: no relevant evidence
]


def main() -> None:
    client = QdrantClient(url=QDRANT_URL, timeout=30, check_compatibility=False)
    leakage = 0
    for query in QUERIES:
        dense = dense_embeddings([query], base_url=MODEL_BASE_URL)[0]
        sparse = sparse_embedding(query)
        results = search_documents(
            client,
            role="engineer",
            query_dense=dense,
            query_sparse=sparse,
            top_k=5,
        )
        print(f"\nQUERY: {query!r}")
        for hit in results:
            marker = " <- SUPERVISOR-ONLY LEAK!" if hit.chunk_id.startswith("chk-vendor") else ""
            if marker:
                leakage += 1
            print(f"  {hit.score:.4f} {hit.chunk_id} [{hit.document_title} | {hit.section}]")
            print(f"          {hit.text[:110]}")
    print(f"\nACL LEAKAGE COUNT: {leakage} (must be 0)")


if __name__ == "__main__":
    main()
