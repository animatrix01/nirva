"""W1: planner-driven routing — the validated plan drives graph execution."""

import sys
from pathlib import Path

from nirva_agent.graph import (
    code_node,
    refine_query,
    retrieve_refine_node,
    route_after_retrieve,
)
from nirva_agent.state import EvidenceItem, NirvaState

SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))


def _state(plan: list[str], completed: list[str]) -> NirvaState:
    return {"plan": plan, "completed_steps": completed}  # type: ignore[typeddict-item]


def test_route_skips_refine_when_plan_has_none() -> None:
    assert route_after_retrieve(_state(["retrieve", "answer"], ["retrieve"])) == "answer"


def test_route_runs_refine_when_planned_and_not_done() -> None:
    plan = ["retrieve", "retrieve_refine", "answer"]
    assert route_after_retrieve(_state(plan, ["retrieve"])) == "retrieve_refine"


def test_route_never_reruns_refine() -> None:
    plan = ["retrieve", "retrieve_refine", "answer"]
    completed = ["retrieve", "retrieve_refine"]
    assert route_after_retrieve(_state(plan, completed)) == "answer"


def test_route_runs_code_when_planned() -> None:
    plan = ["retrieve", "code", "answer"]
    assert route_after_retrieve(_state(plan, ["retrieve"])) == "code"
    assert route_after_retrieve(_state(plan, ["retrieve", "code"])) == "answer"


def test_route_prefers_refine_before_code() -> None:
    plan = ["retrieve", "retrieve_refine", "code", "answer"]
    assert route_after_retrieve(_state(plan, ["retrieve"])) == "retrieve_refine"
    assert route_after_retrieve(_state(plan, ["retrieve", "retrieve_refine"])) == "code"


class _CodeGateway:
    def chat(self, messages: object, **kwargs: object) -> object:
        from nirva_agent.gateway import ChatResponse

        return ChatResponse(
            content="readings = [2.0, 3.9, 4.1]\nprint(max(readings))",
            finish_reason="stop",
            model="fake",
            prompt_tokens=1,
            completion_tokens=1,
        )


def test_code_node_runs_sandbox_and_records_evidence() -> None:
    state: NirvaState = {
        "request_id": "job-code-1",
        "user_id": "u",
        "user_role": "engineer",
        "objective": "Parse vibration log for P-204, flag readings over 3.5.",
        "retrieved_evidence": [],
        "completed_steps": ["retrieve"],
        "last_event_seq": 2,
    }  # type: ignore[typeddict-item]
    result = code_node(state, _CodeGateway())  # type: ignore[arg-type]
    assert result["completed_steps"] == ["code"]
    tool_results = result["tool_results"]
    assert isinstance(tool_results, list) and len(tool_results) == 1
    assert tool_results[0].ok is True
    assert "4.1" in tool_results[0].data["stdout"]
    evidence = result["retrieved_evidence"]
    assert isinstance(evidence, list) and len(evidence) == 1
    assert evidence[0].source == "tool"


def test_code_node_degrades_gracefully_without_gateway() -> None:
    state: NirvaState = {
        "request_id": "job-code-2",
        "user_id": "u",
        "user_role": "engineer",
        "objective": "x",
        "retrieved_evidence": [],
        "completed_steps": ["retrieve"],
        "last_event_seq": 1,
    }
    result = code_node(state, None)
    assert result["completed_steps"] == ["code"]
    tool_results = result["tool_results"]
    assert isinstance(tool_results, list) and tool_results[0].ok is False


def test_refine_query_strips_stopwords() -> None:
    assert refine_query("Why has Pump P-204 had repeated seal failures?") == (
        "pump p-204 repeated seal failures"
    )


def test_refine_node_dedupes_and_appends_only_new_chunks() -> None:
    existing = EvidenceItem(
        chunk_id="chk-1",
        document_id="doc-1",
        document_title="P-204 OEM Manual",
        document_type="manual",
        revision="B",
        page=1,
        section="1",
        equipment_id="P-204",
        text="first pass",
        score=0.9,
    )
    state: NirvaState = {
        "request_id": "j",
        "user_id": "u",
        "user_role": "engineer",
        "objective": "Why has Pump P-204 had repeated seal failures?",
        "retrieved_evidence": [existing],
        "completed_steps": ["retrieve"],
        "last_event_seq": 1,
    }

    def fake_retriever(role: str, query: str) -> list[dict[str, object]]:
        assert query == "pump p-204 repeated seal failures"
        return [
            existing.model_dump(),  # duplicate from first pass
            {
                "chunk_id": "chk-2",
                "document_id": "doc-2",
                "document_title": "Alignment Report",
                "document_type": "incident",
                "revision": "A",
                "page": 3,
                "section": "2.1",
                "equipment_id": "P-204",
                "text": "Alignment was NOT completed.",
                "score": 0.8,
            },
        ]

    result = retrieve_refine_node(state, fake_retriever)  # type: ignore[arg-type]
    fresh = result["retrieved_evidence"]
    assert isinstance(fresh, list) and len(fresh) == 1  # only the new chunk
    assert result["completed_steps"] == ["retrieve_refine"]
