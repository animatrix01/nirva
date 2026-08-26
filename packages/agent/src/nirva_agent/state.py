"""Frozen LangGraph workflow state (COMMON.md c.3 — all 17 fields, exact names).

Single typed object flowing through every node. Field order and names are
frozen; extensions require a [PROPOSAL] in coordination/DECISIONS.md.
"""

from __future__ import annotations

import operator
from typing import Annotated, Any, Literal, NotRequired, TypedDict

from pydantic import BaseModel, Field

RoleName = Literal["engineer", "safety_officer", "supervisor", "admin"]

DocumentType = Literal["manual", "sop", "work_order", "incident", "data"]

ApprovalDecision = Literal["pending", "approved", "rejected"]

EventType = Literal[
    "node_started",
    "node_finished",
    "tool_called",
    "evidence_added",
    "contradiction_found",
    "awaiting_approval",
    "completed",
    "failed",
    "blocked_injection",
]


class EvidenceItem(BaseModel):
    """One retrieved excerpt, citation-ready, with its retrieval score."""

    chunk_id: str
    document_id: str
    document_title: str
    document_type: DocumentType
    revision: str
    page: int | None = None
    section: str | None = None
    equipment_id: str | None = None
    text: str
    score: float = 0.0
    source: Literal["retrieval", "tool"] = "retrieval"


class Citation(BaseModel):
    """Citation contract (COMMON.md c.5): [title, revision, page/section, chunk_id]."""

    title: str
    revision: str
    locator: str
    chunk_id: str


class ToolResult(BaseModel):
    """Typed output from an approved read-only tool call."""

    tool_name: str
    ok: bool
    data: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None
    idempotency_key: str | None = None


class Contradiction(BaseModel):
    """A detected conflict between two sources, surfaced never hidden."""

    topic: str
    source_a: Citation
    source_b: Citation
    claim_a: str
    claim_b: str


class ProposedAction(BaseModel):
    """A consequential-action draft awaiting human approval (e.g., work order)."""

    action: Literal["propose_work_order", "approve_work_order"]
    arguments_summary: str
    evidence_chunk_ids: list[str] = Field(default_factory=list)
    risk_level: Literal["low", "medium", "high"] = "medium"
    idempotency_key: str


class ApprovalState(BaseModel):
    """Field 14: status plus who decided (the '+ decided_by' of COMMON.md c.3)."""

    status: ApprovalDecision = "pending"
    decided_by: str | None = None
    comment: str | None = None


class FinalReport(BaseModel):
    """Shape returned via GET /api/jobs/{id} -> final_report (COMMON.md c.1)."""

    findings: str
    confidence: float = Field(ge=0.0, le=1.0)
    assumptions: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)
    citations: list[Citation] = Field(default_factory=list)


class NirvaState(TypedDict, total=False):
    """The 17-field workflow state. Order below mirrors COMMON.md c.3 exactly."""

    # 1. unique job identifier; also the LangGraph thread_id
    request_id: str
    # 2. who initiated; drives ACL filtering
    user_id: str
    # 3. initiator role; drives ACL filtering
    user_role: RoleName
    # 4. normalized investigation request text
    objective: str
    # 5. bounded ordered steps chosen by the planner node
    plan: list[str]
    # 6. progress marker for resume-after-restart
    completed_steps: Annotated[list[str], operator.add]
    # 7. citation-ready excerpts with retrieval scores
    retrieved_evidence: Annotated[list[EvidenceItem], operator.add]
    # 8. typed outputs from SQL/inventory tools
    tool_results: Annotated[list[ToolResult], operator.add]
    # 9. structured [title, rev, page/section, chunk_id] refs
    citations: Annotated[list[Citation], operator.add]
    # 10. things stated WITHOUT full evidence, labeled as such
    assumptions: Annotated[list[str], operator.add]
    # 11. detected conflicts between sources
    contradictions: Annotated[list[Contradiction], operator.add]
    # 12. safety/policy concerns raised by the reviewer
    risk_flags: Annotated[list[str], operator.add]
    # 13. consequential-action drafts awaiting approval
    proposed_actions: Annotated[list[ProposedAction], operator.add]
    # 14. pending | approved | rejected (+ decided_by)
    approval_status: ApprovalState
    # 15. composed findings document
    final_report: NotRequired[FinalReport]
    # 16. operational: node currently executing (drives SSE events)
    current_node: str | None
    # 17. operational: highest SSE seq emitted (drives replay/resume)
    last_event_seq: int
