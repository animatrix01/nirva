import os
import sys

os.environ["DATABASE_URL"] = "sqlite:///./_server.db"
os.environ["JWT_SECRET"] = "x" * 40
os.environ["MODEL_BASE_URL"] = "http://127.0.0.1:11434/v1"
os.environ["QDRANT_URL"] = "http://127.0.0.1:6333"
sys.path.insert(0, os.path.abspath("apps/api"))

from app.runner import _make_retriever  # noqa: E402
from app.graph_client import GraphRunContext, LangGraphInvestigationGraph  # noqa: E402
from nirva_agent.gateway import GatewayClient, GatewayConfig  # noqa: E402

gateway = GatewayClient(GatewayConfig(base_url=os.environ["MODEL_BASE_URL"], model="qwen2.5:3b-instruct-q4_K_M", timeout_seconds=90.0))
graph = LangGraphInvestigationGraph(gateway, _make_retriever("engineer"))

emitted: list[tuple[str, str, str | None]] = []
ctx = GraphRunContext(
    request_id="dbg-contradiction-run",
    user_id="debug",
    user_role="engineer",
    objective=(
        "Investigate why Pump P-204 has failed repeatedly during the last three months. "
        "Identify the most likely cause, cite the supporting records, check spare-part "
        "availability, and propose a safe next action."
    ),
    equipment_id="P-204",
    emit=lambda t, n, p: emitted.append((t, n, p)),
    set_report=lambda report: print("set_report called, findings:", str(report.get("findings"))[:60]),
)
result = graph.run(ctx)
print("EMITTED events:")
for t, n, p in emitted:
    print(f"  {t} {n} {p}")
print("result keys:", sorted(result.keys()))
print("contradictions in result:", len(result.get("contradictions", [])))
for c in result.get("contradictions", []):
    print("  topic:", c.topic if hasattr(c, "topic") else c)
