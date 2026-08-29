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


@pytest.mark.parametrize("role", ["engineer"])
def test_engineer_cannot_read_audit(
    client: TestClient, auth_headers: AuthHeadersFn, role: str
) -> None:
    headers = auth_headers(role)
    assert client.get("/api/audit", headers=headers).status_code == 403
