import uuid

import pytest
from conftest import AuthHeadersFn
from fastapi.testclient import TestClient


def _seed_pending_approval(job_suffix: str) -> str:
    from app.db import SessionLocal
    from app.models import Approval

    db = SessionLocal()
    try:
        approval = Approval(
            id=str(uuid.uuid4()),
            job_id=f"00000000-0000-0000-0000-{job_suffix}",
            proposal_id=f"PROP-{uuid.uuid4()}",
            action="approve_work_order",
            arguments_summary="replace P-204 seal; parts: ME-204-SEAL",
            evidence_refs=["chunk_1"],
            risk_level="high",
        )
        db.add(approval)
        db.commit()
        return approval.id
    finally:
        db.close()


def test_approve_then_duplicate_decision_conflicts(
    client: TestClient,
    auth_headers: AuthHeadersFn,
) -> None:
    approval_id = _seed_pending_approval("000000000001")
    headers = auth_headers("supervisor")

    first = client.post(
        f"/api/approvals/{approval_id}/decision",
        json={"decision": "approved", "comment": "go"},
        headers=headers,
    )
    assert first.status_code == 200
    assert first.json()["work_order_id"]

    second = client.post(
        f"/api/approvals/{approval_id}/decision",
        json={"decision": "rejected"},
        headers=headers,
    )
    assert second.status_code == 409


def test_only_supervisor_decides(client: TestClient, auth_headers: AuthHeadersFn) -> None:
    approval_id = _seed_pending_approval("000000000002")
    engineer = auth_headers("engineer")
    admin = auth_headers("admin")

    assert (
        client.post(
            f"/api/approvals/{approval_id}/decision",
            json={"decision": "approved"},
            headers=engineer,
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/approvals/{approval_id}/decision",
            json={"decision": "approved"},
            headers=admin,
        ).status_code
        == 403
    )


def test_invalid_decision_rejected_by_validation(
    client: TestClient,
    auth_headers: AuthHeadersFn,
) -> None:
    approval_id = _seed_pending_approval("000000000003")
    headers = auth_headers("supervisor")
    response = client.post(
        f"/api/approvals/{approval_id}/decision",
        json={"decision": "maybe"},
        headers=headers,
    )
    assert response.status_code == 422


def test_audit_chain_valid_after_job_activity(
    client: TestClient,
    auth_headers: AuthHeadersFn,
) -> None:
    engineer = auth_headers("engineer")
    created = client.post(
        "/api/jobs",
        json={"objective": "Audit chain test."},
        headers=engineer,
    )
    assert created.status_code == 201
    headers = auth_headers("safety_officer")
    body = client.get("/api/audit", headers=headers).json()
    assert body["chain_valid"] is True
    actions = [e["action"] for e in body["events"]]
    assert "job.created" in actions


def test_approval_for_equipmentless_job_creates_work_order(
    client: TestClient,
    auth_headers: AuthHeadersFn,
) -> None:
    """Regression: job without equipment_id must not crash work-order creation."""
    engineer = auth_headers("engineer")
    created = client.post(
        "/api/jobs",
        json={"objective": "Equipment-less approval regression test."},
        headers=engineer,
    )
    assert created.status_code == 201
    job_id = created.json()["job_id"]

    from app.db import SessionLocal
    from app.models import Approval

    db = SessionLocal()
    try:
        approval = Approval(
            id=str(uuid.uuid4()),
            job_id=job_id,
            proposal_id=f"PROP-{uuid.uuid4()}",
            action="approve_work_order",
            arguments_summary="generic action without equipment id",
            evidence_refs=[],
            risk_level="medium",
        )
        db.add(approval)
        db.commit()
        approval_id = approval.id
    finally:
        db.close()

    headers = auth_headers("supervisor")
    first = client.post(
        f"/api/approvals/{approval_id}/decision",
        json={"decision": "approved"},
        headers=headers,
    )
    assert first.status_code == 200, first.text
    assert first.json()["work_order_id"]

    from app.db import SessionLocal
    from app.models import WorkOrder

    db = SessionLocal()
    try:
        wo = db.query(WorkOrder).filter(WorkOrder.approval_id == approval_id).first()
        assert wo is not None
        assert wo.asset == "unspecified"
    finally:
        db.close()


def test_audit_returns_newest_window_first(
    client: TestClient,
    auth_headers: AuthHeadersFn,
) -> None:
    """The default audit listing must include the MOST RECENT events — an
    oldest-first page hides exactly the rows a reviewer needs (regression:
    injection_blocked rows from fresh runs were beyond the window)."""
    import time
    import uuid

    from app.audit import append_audit_event
    from app.db import SessionLocal

    marker = f"newest-window-marker-{uuid.uuid4().hex[:8]}"
    db = SessionLocal()
    try:
        append_audit_event(
            db,
            actor="agent:test",
            actor_role="system",
            action="test.marker",
            argument_summary=marker,
        )
    finally:
        db.close()

    time.sleep(0.05)
    headers = auth_headers("admin")
    body = client.get("/api/audit", params={"limit": 50}, headers=headers).json()
    summaries = [e["argument_summary"] for e in body["events"]]
    assert marker in summaries, "newest event missing from the default audit window"
    assert body["chain_valid"] is True
    # chronological display order within the returned window
    timestamps = [e["ts"] for e in body["events"]]
    assert timestamps == sorted(timestamps)


@pytest.mark.parametrize("role", ["engineer"])
def test_engineer_cannot_read_audit(
    client: TestClient, auth_headers: AuthHeadersFn, role: str
) -> None:
    headers = auth_headers(role)
    assert client.get("/api/audit", headers=headers).status_code == 403
