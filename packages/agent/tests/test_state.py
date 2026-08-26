"""Tests for the frozen 17-field NirvaState schema (COMMON.md c.3)."""

from typing import get_type_hints

from nirva_agent.state import (
    ApprovalState,
    Citation,
    Contradiction,
    EvidenceItem,
    FinalReport,
    NirvaState,
    ProposedAction,
    ToolResult,
)

EXPECTED_FIELDS = [
    "request_id",
    "user_id",
    "user_role",
    "objective",
    "plan",
    "completed_steps",
    "retrieved_evidence",
    "tool_results",
    "citations",
    "assumptions",
    "contradictions",
    "risk_flags",
    "proposed_actions",
    "approval_status",
    "final_report",
    "current_node",
    "last_event_seq",
]


def test_state_has_exactly_the_17_frozen_fields_in_order() -> None:
    assert list(NirvaState.__annotations__) == EXPECTED_FIELDS


def test_state_instantiates_with_all_fields() -> None:
    citation = Citation(
        title="P-204 OEM Manual", revision="B", locator="page 12, sec 4.2", chunk_id="c-1"
    )
    evidence = EvidenceItem(
        chunk_id="c-1",
        document_id="doc-1",
        document_title="P-204 OEM Manual",
        document_type="manual",
        revision="B",
        page=12,
        section="4.2 Seal Replacement",
        equipment_id="P-204",
        text="Replace mechanical seal every 8000 h.",
        score=0.91,
    )
    contradiction = Contradiction(
        topic="seal service interval",
        source_a=citation,
        source_b=Citation(
            title="Maintenance SOP", revision="1.3", locator="page 3", chunk_id="c-2"
        ),
        claim_a="Service interval is 8000 h.",
        claim_b="Service interval is 4000 h.",
    )
    action = ProposedAction(
        action="propose_work_order",
        arguments_summary="Create work order for P-204 seal replacement",
        evidence_chunk_ids=["c-1"],
        risk_level="medium",
        idempotency_key="wo-p204-001",
    )
    report = FinalReport(
        findings="Seal interval conflict between OEM manual and SOP.",
        confidence=0.42,
        assumptions=["Sensor history complete for reviewed period."],
        gaps=["No vibration data after 2026-06-01."],
        citations=[citation],
    )
    state: NirvaState = {
        "request_id": "job-1",
        "user_id": "u-1",
        "user_role": "engineer",
        "objective": "Investigate P-204 repeat failures",
        "plan": ["retrieve manual", "compare history"],
        "completed_steps": ["retrieve manual"],
        "retrieved_evidence": [evidence],
        "tool_results": [ToolResult(tool_name="get_asset_history", ok=True)],
        "citations": [citation],
        "assumptions": [],
        "contradictions": [contradiction],
        "risk_flags": [],
        "proposed_actions": [action],
        "approval_status": ApprovalState(status="pending"),
        "final_report": report,
        "current_node": "report_composer",
        "last_event_seq": 7,
    }
    assert state["request_id"] == "job-1"
    assert state["approval_status"].status == "pending"
    assert state["final_report"].confidence == 0.42
    assert state["retrieved_evidence"][0].chunk_id == "c-1"


def test_evidence_defaults_are_safe() -> None:
    evidence = EvidenceItem(
        chunk_id="c-9",
        document_id="d-9",
        document_title="Incident Report 3",
        document_type="incident",
        revision="0",
        text="Seal wept at 03:14.",
    )
    assert evidence.page is None
    assert evidence.score == 0.0
    assert evidence.source == "retrieval"


def test_report_confidence_bounds_enforced() -> None:
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        FinalReport(findings="x", confidence=1.5)


def test_citation_carries_all_contract_parts() -> None:
    Citation(title="T", revision="r", locator="page 1", chunk_id="cid")
    hints = get_type_hints(Citation)
    assert set(hints) == {"title", "revision", "locator", "chunk_id"}
