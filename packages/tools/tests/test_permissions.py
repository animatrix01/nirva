import sys
from pathlib import Path

import pytest

TOOLS_SRC = Path(__file__).resolve().parents[1] / "src"
if str(TOOLS_SRC) not in sys.path:
    sys.path.insert(0, str(TOOLS_SRC))

from nirva_tools.permissions import PermissionDenied, authorize, is_allowed  # noqa: E402
from nirva_tools.tools import (  # noqa: E402
    ApprovalFlowRequired,
    approve_work_order,
    propose_work_order,
)

ALL_ROLES = ["engineer", "safety_officer", "supervisor", "admin"]


@pytest.mark.parametrize(
    ("tool", "allowed_roles"),
    [
        ("search_documents", set(ALL_ROLES)),
        ("get_asset_history", set(ALL_ROLES)),
        ("check_inventory", set(ALL_ROLES)),
        ("propose_work_order", {"engineer", "supervisor", "admin"}),
        ("approve_work_order", {"supervisor"}),
    ],
)
def test_default_deny_matrix(tool: str, allowed_roles: set[str]) -> None:
    for role in ALL_ROLES:
        assert is_allowed(role, tool) == (role in allowed_roles), (role, tool)
    assert is_allowed("unknown_role", tool) is False
    assert is_allowed(role, "nonexistent_tool") is False


def test_authorize_raises_permission_denied() -> None:
    with pytest.raises(PermissionDenied):
        authorize("engineer", "approve_work_order")


@pytest.mark.parametrize(
    "call",
    [
        lambda: approve_work_order("engineer", None),  # type: ignore[arg-type]
        lambda: propose_work_order("safety_officer", None),  # type: ignore[arg-type]
    ],
)
def test_denied_calls_never_execute(call: object) -> None:
    with pytest.raises(PermissionDenied):
        call()  # type: ignore[operator]


def test_allowed_call_reaches_approval_flow_gate() -> None:
    with pytest.raises(ApprovalFlowRequired):
        approve_work_order("supervisor", None)  # type: ignore[arg-type]
