"""Serialization round-trip: pydantic models in NirvaState must survive the
LangGraph checkpointer's serializer (Postgres saver uses the same
JsonPlusSerializer). This is the evidence behind the A2 checkpoint-resume
wiring — if this test fails, state is NOT durably serializable.
"""

import sys
from pathlib import Path

from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer

SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from nirva_agent.state import EvidenceItem, FinalReport, NirvaState  # noqa: E402


def _sample_state_values() -> dict:
    return {
        "request_id": "job-serial-1",
        "user_id": "u-1",
        "user_role": "engineer",
        "objective": "Investigate P-204 seal failures.",
        "retrieved_evidence": [
            EvidenceItem(
                chunk_id="chk-1",
                document_id="doc-1",
                document_title="P-204 OEM Manual",
                document_type="manual",
                revision="B",
                page=12,
                section="4.2",
                equipment_id="P-204",
                text="Replace the mechanical seal every 8000 operating hours.",
                score=0.93,
            )
        ],
        "tool_results": [],
        "citations": [],
        "assumptions": [],
        "contradictions": [],
        "risk_flags": [],
        "proposed_actions": [],
        "approval_status": None,
        "final_report": FinalReport(
            findings="Seal wear is the likely cause.",
            confidence=0.5,
            assumptions=[],
            gaps=["No indexed evidence was available for this objective."],
            citations=[],
        ),
        "plan": ["collect_evidence", "compose_findings"],
        "completed_steps": ["intake", "retrieve"],
        "current_node": "answer",
        "last_event_seq": 3,
    }


def test_pydantic_models_survive_jsonplus_round_trip() -> None:
    serializer = JsonPlusSerializer()
    state: NirvaState = _sample_state_values()  # type: ignore[assignment]

    blob = serializer.dumps_typed(state)
    restored = serializer.loads_typed(blob)

    assert restored["request_id"] == "job-serial-1"
    report = restored["final_report"]
    assert report.findings == "Seal wear is the likely cause."
    assert restored["retrieved_evidence"][0].chunk_id == "chk-1"
    assert restored["last_event_seq"] == 3


def test_pydantic_models_survive_dumps_dumps_typed_twice() -> None:
    serializer = JsonPlusSerializer()
    state: NirvaState = _sample_state_values()  # type: ignore[assignment]

    blob = serializer.dumps_typed(serializer.dumps_typed(state))
    restored = serializer.loads_typed(serializer.loads_typed(blob))

    assert restored["final_report"].confidence == 0.5
