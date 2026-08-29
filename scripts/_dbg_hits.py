import os
import sys

os.environ["DATABASE_URL"] = "sqlite:///./_server.db"
os.environ["JWT_SECRET"] = "x" * 40
os.environ["QDRANT_URL"] = "http://127.0.0.1:6333"
os.environ["MODEL_BASE_URL"] = "http://127.0.0.1:11434/v1"
sys.path.insert(0, os.path.abspath("apps/api"))

from app.runner import _make_retriever  # noqa: E402

OBJECTIVE = (
    "Investigate why Pump P-204 has failed repeatedly during the last three months. "
    "Identify the most likely cause, cite the supporting records, check spare-part "
    "availability, and propose a safe next action."
)

r = _make_retriever("engineer")
try:
    evidence = r("engineer", OBJECTIVE)
except Exception:
    import traceback

    traceback.print_exc()
    sys.exit(1)
print("total evidence:", len(evidence))
for item in evidence:
    source = item.get("source", "retrieval-if-not-tool")
    text = str(item.get("text", ""))[:90].replace("\n", " ")
    print(f"{item.get('chunk_id', '?'):32} [{source}] {text}")
