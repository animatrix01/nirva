import uuid

import httpx
import pytest
from conftest import AuthHeadersFn
from fastapi.testclient import TestClient

UPLOAD_OK_ROLES = ["engineer", "admin"]
UPLOAD_DENIED_ROLES = ["supervisor", "safety_officer"]


def _attempt_upload(
    client: TestClient,
    headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    role: str,
) -> httpx.Response:
    monkeypatch.setattr(
        "app.routers.documents._parse_and_index", lambda *args, **kwargs: 3
    )
    # unique bytes per role so hash-dedup never collides across the matrix
    content = b"%PDF-1.4 synthetic role-matrix upload for " + role.encode()
    return client.post(
        "/api/documents/upload",
        files={"file": (f"matrix-{role}.pdf", content)},
        data={
            "title": f"Role Matrix Manual ({role})",
            "document_type": "manual",
            "revision": "1",
            "effective_date": "2026-01-01",
            "department": "Maintenance",
            "allowed_roles": "engineer,admin",
        },
        headers=headers,
    )


@pytest.mark.parametrize("role", UPLOAD_OK_ROLES)
def test_allowed_roles_can_upload(
    client: TestClient,
    auth_headers: AuthHeadersFn,
    monkeypatch: pytest.MonkeyPatch,
    role: str,
) -> None:
    response = _attempt_upload(client, auth_headers(role), monkeypatch, role)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "indexed"
    assert body["chunks"] == 3
    assert body["duplicate"] is False


@pytest.mark.parametrize("role", UPLOAD_DENIED_ROLES)
def test_reviewer_roles_cannot_upload(
    client: TestClient,
    auth_headers: AuthHeadersFn,
    monkeypatch: pytest.MonkeyPatch,
    role: str,
) -> None:
    response = _attempt_upload(client, auth_headers(role), monkeypatch, role)
    assert response.status_code == 403
    assert "engineer or admin" in response.json()["detail"]


def test_upload_matrix_covers_all_roles(
    client: TestClient,
    auth_headers: AuthHeadersFn,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for role in UPLOAD_OK_ROLES + UPLOAD_DENIED_ROLES:
        response = _attempt_upload(client, auth_headers(role), monkeypatch, role)
        expected = 201 if role in UPLOAD_OK_ROLES else 403
        assert response.status_code == expected, (role, response.status_code)


def test_evidence_response_includes_numeric_score(
    client: TestClient,
    auth_headers: AuthHeadersFn,
) -> None:
    from app.db import SessionLocal
    from app.models import Job, JobEvidence, User

    db = SessionLocal()
    chunk_id = ""
    jid = ""
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        assert admin is not None
        jid = str(uuid.uuid4())
        db.add(Job(id=jid, objective="evidence score test", created_by=admin.id))
        chunk_id = f"chk-score-{uuid.uuid4().hex[:8]}"
        db.add(
            JobEvidence(
                job_id=jid,
                chunk_id=chunk_id,
                payload={
                    "chunk_id": chunk_id,
                    "document_id": "doc-d",
                    "document_title": "Scored Manual",
                    "document_type": "manual",
                    "revision": "1",
                    "section": "4.2",
                    "text": "passage text",
                    "score": 0.83,
                    "source": "retrieval",
                },
            )
        )
        db.commit()
    finally:
        db.close()

    headers = auth_headers("admin")
    response = client.get(f"/api/jobs/{jid}/evidence/{chunk_id}", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["score"], (int, float))
    assert body["score"] == pytest.approx(0.83)
    assert body["passage_text"] == "passage text"
