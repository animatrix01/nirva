from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol


@dataclass
class GraphRunContext:
    request_id: str
    user_id: str
    user_role: str
    objective: str
    emit: Callable[[str, str, str | None], None]
    set_report: Callable[[dict[str, object]], None]


class InvestigationGraph(Protocol):
    name: str

    def run(self, ctx: GraphRunContext) -> None: ...


class MockIntakeAnswerFinalizeGraph:
    """Phase 1 placeholder for the AI lane's LangGraph graph.

    Emits the same event sequence the real 3-node deterministic graph will emit:
    intake -> answer -> finalize, each with node_started/node_finished.
    """

    name = "mock_intake_answer_finalize_v0"

    def run(self, ctx: GraphRunContext) -> None:
        report: dict[str, object] = {
            "findings": "Local mock analysis for objective placeholder.",
            "confidence": 0.5,
            "assumptions": ["Mock graph output; no retrieval evidence yet"],
            "gaps": ["Evidence retrieval pending Phase 2"],
            "citations": [],
        }
        for node in ("intake", "answer", "finalize"):
            ctx.emit("node_started", node, None)
            if node == "answer":
                ctx.set_report(report)
                ctx.emit("evidence_added", node, None)
            ctx.emit("node_finished", node, None)
        ctx.emit("completed", "finalize", None)


def get_graph() -> InvestigationGraph:
    return MockIntakeAnswerFinalizeGraph()
