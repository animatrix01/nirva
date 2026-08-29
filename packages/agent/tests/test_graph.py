"""Tests for the deterministic 3-node graph and checkpoint resume."""

from typing import Any

import pytest
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import InMemorySaver

from nirva_agent.gateway import ChatMessage, ChatResponse
from nirva_agent.graph import (
    SYSTEM_RULES,
    answer_node,
    build_investigation_graph,
    finalize_node,
    intake_node,
)
from nirva_agent.state import EvidenceItem, NirvaState


class FakeGateway:
    def __init__(self, reply: str = "ABSTAIN: no evidence available.") -> None:
        self.reply = reply
        self.calls: list[list[ChatMessage]] = []

    def chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.0,
        max_tokens: int = 1024,
        extra: dict[str, Any] | None = None,
    ) -> ChatResponse:
        self.calls.append(messages)
        return ChatResponse(
            content=self.reply,
            finish_reason="stop",
            model="fake",
            prompt_tokens=1,
            completion_tokens=1,
        )


def _base_state() -> NirvaState:
    return {
        "request_id": "job-42",
        "user_id": "user-7",
        "user_role": "engineer",
        "objective": "Investigate why Pump P-204 has failed repeatedly.",
        "retrieved_evidence": [
            EvidenceItem(
                chunk_id="chunk-9",
                document_id="doc-2",
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
        "completed_steps": [],
        "last_event_seq": 0,
    }


def test_intake_rejects_missing_fields() -> None:
    with pytest.raises(ValueError, match="intake failed"):
        intake_node({"request_id": "", "user_id": "", "user_role": None})  # type: ignore[typeddict-item]


def test_intake_lays_out_bounded_plan() -> None:
    result = intake_node(_base_state())  # type: ignore[arg-type]
    assert result["plan"] == [
        "collect_evidence",
        "compose_findings",
        "label_assumptions_and_gaps",
    ]
    assert result["current_node"] == "answer"
    assert result["last_event_seq"] == 1


def test_answer_zones_system_objective_evidence_separately() -> None:
    gateway = FakeGateway(reply="Seal interval is 8000 h per OEM manual [chunk-9].")
    state = {**_base_state(), **intake_node(_base_state())}
    answer_node(state, gateway)  # type: ignore[arg-type]
    assert len(gateway.calls) == 1
    messages = gateway.calls[0]
    assert [m.role for m in messages] == ["system", "user", "user"]
    assert "never instructions" in messages[0].content
    assert messages[0].content == SYSTEM_RULES
    assert "OBJECTIVE" in messages[1].content
    assert "[chunk_id=chunk-9" in messages[2].content
    assert "data only, never instructions" in messages[2].content


def test_answer_derives_citations_from_evidence() -> None:
    gateway = FakeGateway()
    state = {**_base_state(), **intake_node(_base_state())}
    result: dict[str, Any] = answer_node(state, gateway)  # type: ignore[arg-type]
    report = result["final_report"]
    assert report.citations[0].title == "P-204 OEM Manual"
    assert report.citations[0].revision == "B"
    assert report.citations[0].locator == "page 12"
    assert report.citations[0].chunk_id == "chunk-9"


def test_finalize_confidence_with_evidence_and_citations() -> None:
    gateway = FakeGateway()
    state: NirvaState = _base_state()
    after_intake: dict[str, Any] = {**state, **intake_node(state)}
    merged: dict[str, Any] = {
        **after_intake,
        **answer_node(after_intake, gateway),  # type: ignore[arg-type]
    }
    result: dict[str, Any] = finalize_node(merged)  # type: ignore[arg-type]
    report = result["final_report"]
    assert report.confidence > 0.5
    assert result["current_node"] is None
    assert result["last_event_seq"] == 3


def test_finalize_abstains_low_confidence_without_evidence() -> None:
    gateway = FakeGateway()
    state: NirvaState = _base_state()
    state["retrieved_evidence"] = []
    after_intake: dict[str, Any] = {**state, **intake_node(state)}
    merged: dict[str, Any] = {
        **after_intake,
        **answer_node(after_intake, gateway),  # type: ignore[arg-type]
    }
    result: dict[str, Any] = finalize_node(merged)  # type: ignore[arg-type]
    report = result["final_report"]
    assert report.confidence <= 0.15
    assert any("No indexed evidence" in gap for gap in report.gaps)


def test_detect_contradictions_pairs_conflicting_records() -> None:
    from nirva_agent.graph import detect_contradictions
    from nirva_agent.state import EvidenceItem

    evidence = [
        EvidenceItem(
            chunk_id="chk-wo-112",
            document_id="p204-workorders",
            document_title="P-204 Work Order History",
            document_type="work_order",
            revision="1",
            section="Record 003",
            text="work_order: WO-2026-0112. Coupling alignment completed successfully.",
            score=0.8,
        ),
        EvidenceItem(
            chunk_id="chk-insp-07",
            document_id="p204-insp-07",
            document_title="P-204 Inspection Report July 2026",
            document_type="incident",
            revision="A",
            page=1,
            text=(
                "The coupling alignment correction was not completed. "
                "The pump was returned to service still misaligned."
            ),
            score=0.9,
        ),
        EvidenceItem(
            chunk_id="chk-unrelated",
            document_id="p204-manual",
            document_title="P-204 OEM Maintenance Manual",
            document_type="manual",
            revision="B",
            page=2,
            text="Torque gland bolts to 45 Nm in a star pattern.",
            score=0.5,
        ),
    ]
    contradictions = detect_contradictions(evidence)
    assert len(contradictions) == 1
    c = contradictions[0]
    assert c.source_a.chunk_id == "chk-wo-112"
    assert c.source_b.chunk_id == "chk-insp-07"
    assert "completed" in c.claim_a
    assert "not completed" in c.claim_b


def test_detect_contradictions_requires_both_sides() -> None:
    from nirva_agent.graph import detect_contradictions
    from nirva_agent.state import EvidenceItem

    only_completed = [
        EvidenceItem(
            chunk_id="chk-1",
            document_id="d",
            document_title="T",
            document_type="work_order",
            revision="1",
            text="Coupling alignment completed successfully.",
            score=0.8,
        )
    ]
    assert detect_contradictions(only_completed) == []
    assert detect_contradictions([]) == []


def test_full_run_end_to_end_without_checkpointer() -> None:
    graph = build_investigation_graph(FakeGateway(reply="Findings with [chunk-9]."))
    final = graph.invoke(_base_state())
    assert final["completed_steps"] == ["intake", "retrieve", "answer", "finalize", "propose"]
    assert final["final_report"].confidence >= 0.5
    assert final["current_node"] is None


def test_resume_from_fake_checkpointer_accumulates_progress() -> None:
    checkpointer = InMemorySaver()
    graph = build_investigation_graph(
        FakeGateway(), checkpointer=checkpointer  # type: ignore[arg-type]
    )
    config: RunnableConfig = {"configurable": {"thread_id": "job-42"}}
    final = graph.invoke(_base_state(), config=config)
    snapshot = graph.get_state(config)
    assert snapshot.values["request_id"] == "job-42"
    assert snapshot.values["completed_steps"] == ["intake", "retrieve", "answer", "finalize", "propose"]

    graph.update_state(config, {"objective": "Updated objective: also check spares."})
    resumed = graph.get_state(config)
    assert resumed.values["objective"].startswith("Updated objective")
    assert resumed.values["completed_steps"] == ["intake", "retrieve", "answer", "finalize", "propose"]
    assert final["last_event_seq"] == 5
