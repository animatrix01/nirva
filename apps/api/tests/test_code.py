"""Contract tests for the working-code endpoints (E3)."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def stub_codegen(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.routers.code._codegen",
        lambda task: "readings = [2.0, 3.9, 4.1]\nprint(max(readings))",
    )


def _create_job(client: TestClient, auth_headers: Any) -> str:
    response = client.post(
        "/api/jobs",
        json={"objective": "Parse vibration log for P-204, flag readings over 3.5."},
        headers=auth_headers("engineer"),
    )
    assert response.status_code == 201
    return str(response.json()["job_id"])


def test_code_run_executes_and_persists(client: TestClient, auth_headers: Any, stub_codegen: None) -> None:
    job_id = _create_job(client, auth_headers)
    response = client.post(
        "/api/code/run",
        json={"job_id": job_id, "task": "Parse vibration log for P-204, flag readings over 3.5."},
        headers=auth_headers("engineer"),
    )
    assert response.status_code == 200, response.text[:200]
    body = response.json()
    assert body["job_id"] == job_id
    assert body["ok"] is True
    assert "4.1" in body["stdout"]
    assert "max(readings)" in body["code"]

    # persisted: latest run readable by another staff role
    fetched = client.get(f"/api/code/{job_id}", headers=auth_headers("supervisor"))
    assert fetched.status_code == 200
    assert fetched.json()["code"] == body["code"]

    # download serves the .py
    dl = client.get(f"/api/code/{job_id}/download", headers=auth_headers("engineer"))
    assert dl.status_code == 200
    assert "max(readings)" in dl.text
    assert "attachment" in dl.headers["content-disposition"]


def test_safety_officer_cannot_run_but_can_view(
    client: TestClient, auth_headers: Any, stub_codegen: None
) -> None:
    job_id = _create_job(client, auth_headers)
    denied = client.post(
        "/api/code/run",
        json={"job_id": job_id, "task": "x"},
        headers=auth_headers("safety_officer"),
    )
    assert denied.status_code == 403

    client.post(
        "/api/code/run",
        json={"job_id": job_id, "task": "x"},
        headers=auth_headers("engineer"),
    )
    viewed = client.get(f"/api/code/{job_id}", headers=auth_headers("safety_officer"))
    assert viewed.status_code == 200


def test_code_run_guards(client: TestClient, auth_headers: Any, stub_codegen: None) -> None:
    anon = client.post("/api/code/run", json={"job_id": "x", "task": "x"})
    assert anon.status_code == 401
    missing = client.post(
        "/api/code/run",
        json={"job_id": "does-not-exist", "task": "x"},
        headers=auth_headers("admin"),
    )
    assert missing.status_code == 404
    bad = client.post(
        "/api/code/run",
        json={"job_id": "does-not-exist", "task": ""},
        headers=auth_headers("admin"),
    )
    # unknown job is checked before task validation
    assert bad.status_code == 404
