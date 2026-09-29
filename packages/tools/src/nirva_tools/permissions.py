from __future__ import annotations

ALL_ROLES = frozenset({"engineer", "safety_officer", "supervisor", "admin"})

TOOL_PERMISSIONS: dict[str, frozenset[str]] = {
    "search_documents": frozenset({"engineer", "safety_officer", "supervisor", "admin"}),
    "get_asset_history": frozenset({"engineer", "safety_officer", "supervisor", "admin"}),
    "check_inventory": frozenset({"engineer", "safety_officer", "supervisor", "admin"}),
    "propose_work_order": frozenset({"engineer", "supervisor", "admin"}),
    "approve_work_order": frozenset({"supervisor"}),
    # E3: generated-code execution; safety_officer is view-only elsewhere
    "run_python": frozenset({"engineer", "supervisor", "admin"}),
}


class PermissionDenied(Exception):
    pass


def is_allowed(role: str, tool: str) -> bool:
    allowed = TOOL_PERMISSIONS.get(tool)
    if allowed is None:
        return False
    return role in allowed


def authorize(role: str, tool: str) -> None:
    if not is_allowed(role, tool):
        msg = f"tool '{tool}' not permitted for role '{role}'"
        raise PermissionDenied(msg)
