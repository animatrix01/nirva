"""W1: planner-driven routing — the validated plan drives graph execution."""

import sys
from pathlib import Path

from nirva_agent.graph import (
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
