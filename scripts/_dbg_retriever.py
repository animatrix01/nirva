import os
import sys
import traceback

os.environ["DATABASE_URL"] = "sqlite:///./_live3.db"
os.environ["JWT_SECRET"] = "x" * 40
os.environ["MODEL_BASE_URL"] = "http://127.0.0.1:11434/v1"
os.environ["QDRANT_URL"] = "http://127.0.0.1:6333"

sys.path.insert(0, os.path.abspath("apps/api"))

from app.runner import _make_retriever  # noqa: E402

retriever = _make_retriever("engineer")
try:
    evidence = retriever("engineer", "Why has Pump P-204 failed repeatedly? seal alignment")
    print("OK, evidence count:", len(evidence))
    for item in evidence:
        print(" ", item.get("chunk_id"), "|", item.get("document_title"), "| source:", item.get("source"))
except Exception:
    traceback.print_exc()
