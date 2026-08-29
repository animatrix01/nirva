"""Seam between the API and the AI lane's LangGraph investigation graph.

The adapter owns the bridge from graph node transitions to the frozen SSE event
vocabulary (node_started/node_finished/completed) and attributes failures to the
node that was executing. Retrieved content is data, never instructions — the
zoning lives in packages/agent graph prompts.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Protocol, cast

from langchain_core.runnables import RunnableConfig
from nirva_agent.config import GatewayConfig, load_gateway_config
from nirva_agent.gateway import GatewayClient
from nirva_agent.graph import build_investigation_graph
from nirva_agent.state import NirvaState

# Model name is a constructor arg (AI lane decision); matches the registry in
# infra/model-config/models.yaml (qwen2.5:3b fallback for <=6GB VRAM laptops).
DEFAULT_MODEL = "qwen2.5:3b-instruct-q4_K_M"
GATEWAY_TIMEOUT_SECONDS = 90.0

NODE_SEQUENCE: tuple[str, ...] = ("intake", "retrieve", "answer", "finalize", "propose")


@dataclass
class GraphRunContext:
    request_id: str
    user_id: str
    user_role: str
    objective: str
    equipment_id: str | None
    emit: Callable[[str, str, str | None], None]
    set_report: Callable[[dict[str, object]], None]


class InvestigationGraph(Protocol):
    name: str

    def run(self, ctx: GraphRunContext) -> dict[str, Any]: ...


class LangGraphInvestigationGraph:
    """Deterministic intake -> answer -> finalize graph over the frozen state."""

    name = "investigation_graph_v1"

    def __init__(
        self,
        gateway: GatewayClient,
        retriever: Callable[[str, str], list[dict[str, Any]]] | None = None,
    ) -> None:
        self._gateway = gateway
        self._retriever = retriever
        self._graph = build_investigation_graph(gateway, retriever=retriever)

    def run(self, ctx: GraphRunContext) -> dict[str, Any]:
        state: dict[str, Any] = {
            "request_id": ctx.request_id,
            "user_id": ctx.user_id,
            "user_role": ctx.user_role,
            "objective": ctx.objective,
            "equipment_id": ctx.equipment_id,
            "retrieved_evidence": [],
            "completed_steps": [],
            "last_event_seq": 0,
        }
        config: RunnableConfig = {"configurable": {"thread_id": ctx.request_id}}
        pending = "intake"
        ctx.emit("node_started", pending, None)
        final_state: dict[str, Any] = {}
        try:
            for update in self._graph.stream(
                cast(NirvaState, state), config, stream_mode="updates"
            ):
                if not isinstance(update, dict) or not update:
                    continue
                finished = str(next(iter(update)))
                delta = update[finished]
                if isinstance(delta, dict):
                    final_state.update(delta)
                ctx.emit("node_finished", finished, None)
                if finished == "retrieve" and isinstance(delta, dict):
                    ctx.emit("tool_called", "retrieve", "search_documents")
                    if delta.get("retrieved_evidence"):
                        ctx.emit("evidence_added", "retrieve", None)
                if finished == "finalize":
                    report = final_state.get("final_report")
                    if report is None:
                        msg = "graph produced no final report"
                        raise RuntimeError(msg)
                    ctx.set_report(cast(Any, report).model_dump())
                if finished == "propose":
                    if isinstance(delta, dict) and delta.get("contradictions"):
                        ctx.emit("contradiction_found", "propose", "contradiction")
                    if isinstance(delta, dict) and delta.get("proposed_actions"):
                        ctx.emit("awaiting_approval", "propose", "approval_request")
                    else:
                        ctx.emit("completed", "propose", None)
                    return dict(final_state)
                idx = NODE_SEQUENCE.index(finished) if finished in NODE_SEQUENCE else -1
                if 0 <= idx < len(NODE_SEQUENCE) - 1:
                    pending = NODE_SEQUENCE[idx + 1]
                    ctx.emit("node_started", pending, None)
        except Exception as exc:
            cast(Any, exc).node = pending
            raise
        report = final_state.get("final_report")
        if report is None:
            msg = "graph produced no final report"
            raise RuntimeError(msg)
        ctx.set_report(cast(Any, report).model_dump())
        ctx.emit("completed", "propose", None)
        return dict(final_state)


def get_graph(retriever: Callable[[str, str], list[dict[str, Any]]] | None = None) -> InvestigationGraph:
    config = load_gateway_config(model=DEFAULT_MODEL)
    gateway = GatewayClient(
        GatewayConfig(
            base_url=config.base_url,
            model=config.model,
            timeout_seconds=GATEWAY_TIMEOUT_SECONDS,
        )
    )
    return LangGraphInvestigationGraph(gateway, retriever)
