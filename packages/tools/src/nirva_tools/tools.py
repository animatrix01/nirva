"""Typed NIRVA tools. Default-deny; authorization enforced here, outside any model.

Phase 1: signatures + permission enforcement are final.
Bodies land with their phase: search_documents needs the AI lane's Qdrant index (P2);
operational-DB tools need seeded asset/inventory tables (P3); work-order persistence (P3).
"""

from typing import NoReturn

from nirva_tools.permissions import PermissionDenied, authorize
from nirva_tools.types import (
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


def _phase_error(tool: str, phase: int) -> NoReturn:
    raise NotImplementedError(f"{tool} implementation lands in Phase {phase}")


def search_documents(role: str, input_: SearchInput) -> SearchOutput:
    authorize(role, "search_documents")
    _phase_error("search_documents", 2)


def get_asset_history(role: str, input_: AssetHistoryInput) -> AssetHistoryOutput:
    authorize(role, "get_asset_history")
    _phase_error("get_asset_history", 3)


def check_inventory(role: str, input_: InventoryInput) -> InventoryOutput:
    authorize(role, "check_inventory")
    _phase_error("check_inventory", 3)


def propose_work_order(role: str, input_: WorkOrderProposalInput) -> WorkOrderProposalOutput:
    authorize(role, "propose_work_order")
    _phase_error("propose_work_order", 3)


def approve_work_order(role: str, input_: WorkOrderApprovalInput) -> WorkOrderApprovalOutput:
    authorize(role, "approve_work_order")
    _phase_error("approve_work_order", 3)


__all__ = [
    "PermissionDenied",
    "approve_work_order",
    "check_inventory",
    "get_asset_history",
    "propose_work_order",
    "search_documents",
]
