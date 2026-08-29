"""Typed NIRVA tools. Default-deny; authorization enforced here, outside any model.

search_documents / get_asset_history / check_inventory are real read-only
implementations. Work-order proposal/execution is the consequential pair: the
DRAFT is created by the investigation runner as an approval proposal, and the
consequential execution happens only after a supervisor decision through
POST /api/approvals/{id}/decision (idempotency enforced there). The functions
below keep the frozen signatures + permission gates and route to that flow.
"""

from typing import Any, NoReturn

from nirva_tools.permissions import PermissionDenied, authorize
from nirva_tools.types import (
    AssetEvent,
    AssetHistoryInput,
    AssetHistoryOutput,
    InventoryInput,
    InventoryOutput,
    SearchInput,
    SearchOutput,
    WorkOrderApprovalInput,
    WorkOrderApprovalOutput,
    WorkOrderProposalInput,
    WorkOrderProposalOutput,
)


class ApprovalFlowRequired(RuntimeError):
    """Raised when a consequential action must route through the approval flow."""


def _phase_error(tool: str, phase: int) -> NoReturn:
    raise NotImplementedError(f"{tool} implementation lands in Phase {phase}")


def search_documents(
    role: str,
    input_: SearchInput,
    *,
    query_fn: Any,
) -> SearchOutput:
    """Real read-only retrieval. query_fn(query, role, top_k, equipment_id) -> results."""
    authorize(role, "search_documents")
    return query_fn(query=input_.query, role=role, top_k=input_.top_k, equipment_id=input_.equipment_id)


def get_asset_history(
    role: str,
    input_: AssetHistoryInput,
    *,
    lookup_fn: Any,
) -> AssetHistoryOutput:
    """Real read-only asset history. lookup_fn(equipment_id) -> list[AssetEvent]."""
    authorize(role, "get_asset_history")
    events = lookup_fn(input_.equipment_id)
    return AssetHistoryOutput(
        events=[
            AssetEvent(event_type=e.event_type, description=e.description, source_timestamp=e.source_timestamp)
            for e in events
        ]
    )


def check_inventory(
    role: str,
    input_: InventoryInput,
    *,
    lookup_fn: Any,
) -> InventoryOutput:
    """Real read-only inventory. lookup_fn(part_number) -> InventoryItem | None."""
    authorize(role, "check_inventory")
    item = lookup_fn(input_.part_number)
    if item is None:
        return InventoryOutput(part_number=input_.part_number, available_qty=0, last_updated="unknown")
    return InventoryOutput(
        part_number=item.part_number, available_qty=item.available_qty, last_updated=item.last_updated
    )


def propose_work_order(role: str, input_: WorkOrderProposalInput) -> WorkOrderProposalOutput:
    """Draft-only proposal. Persistence happens in the investigation runner as an
    approval proposal; execution is gated behind the supervisor decision."""
    authorize(role, "propose_work_order")
    raise ApprovalFlowRequired(
        "work-order proposals are created by the investigation runner as approval "
        "proposals; consequential execution requires POST /api/approvals/{id}/decision"
    )


def approve_work_order(role: str, input_: WorkOrderApprovalInput) -> WorkOrderApprovalOutput:
    """Consequential action. Only executes after a supervisor decision via the
    approvals endpoint, which enforces idempotency (first decision wins)."""
    authorize(role, "approve_work_order")
    raise ApprovalFlowRequired(
        "approve_work_order executes only through POST /api/approvals/{id}/decision "
        "after supervisor authorization"
    )


__all__ = [
    "ApprovalFlowRequired",
    "PermissionDenied",
    "approve_work_order",
    "check_inventory",
    "get_asset_history",
    "propose_work_order",
    "search_documents",
]
