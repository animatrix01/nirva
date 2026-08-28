import json
import time

from fastapi.testclient import TestClient

from conftest import AuthHeadersFn

ALLOWED_EVENT_TYPES = {
    "node_started",
    "node_finished",
    "tool_called",
    "evidence_added",
    "contradiction_found",
    "awaiting_approval",
    "completed",
    "failed",
    "blocked_injection",
}

ENVELOPE_KEYS = {"job_id", "seq", "type", "node", "payload_ref", "ts"}


def _create_job(client: TestClient, auth_headers: AuthHeadersFn, objective: str) -> str:
    headers = auth_headers("engineer")
    response = client.post(
        "/api/jobs",
        json={"objective": objective, "equipment_id": "P-204"},
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert set(body.keys()) >= {"job_id", "status", "created_at"}
    return body["job_id"]


def test_create_job_requires_auth(client: TestClient) -> None:
    response = client.post("/api/jobs", json={"objective": "Investigate P-204"})
    assert response.status_code == 401


def test_job_lifecycle_and_sse_envelope(client: TestClient, auth_headers: AuthHeadersFn) -> None:
    job_id = _create_job(client, auth_headers, "Investigate why Pump P-204 failed repeatedly.")
    headers = auth_headers("engineer")

    events: list[dict[str, object]] = []
    with client.stream("GET", f"/api/jobs/{job_id}/events", headers=headers) as response:
        assert response.headers["content-type"].startswith("text/event-stream")
        for line in response.iter_lines():
            if not line.startswith("data: "):
                continue
            payload = json.loads(line[len("data: ") :])
            assert set(payload.keys()) == ENVELOPE_KEYS
            assert payload["type"] in ALLOWED_EVENT_TYPES
            assert isinstance(payload["seq"], int)
            events.append(payload)

    assert [e["seq"] for e in events] == list(range(len(events)))
    assert events[-1]["type"] == "completed"
    types_seen = {str(e["type"]) for e in events}
    assert {"node_started", "node_finished"} <= types_seen

    detail = client.get(f"/api/jobs/{job_id}", headers=headers).json()
    assert detail["status"] == "completed"
    assert detail["final_report"]["findings"]
    assert detail["final_report"]["confidence"]


def test_sse_replays_from_last_event_id(client: TestClient, auth_headers: AuthHeadersFn) -> None:
    job_id = _create_job(client, auth_headers, "Replay test objective.")
    headers = auth_headers("engineer")
    deadline = time.time() + 10
    while time.time() < deadline:
        detail = client.get(f"/api/jobs/{job_id}", headers=headers).json()
        if detail["status"] == "completed":
            break
        time.sleep(0.1)

    response = client.get(
        f"/api/jobs/{job_id}/events",
        headers={**headers, "Last-Event-ID": "0"},
    )
    assert response.status_code == 200
    lines = [ln for ln in response.text.splitlines() if ln.startswith("data: ")]
    seqs = [json.loads(ln[6:])["seq"] for ln in lines]
    assert seqs and seqs[0] == 1
    assert seqs == sorted(seqs)


def test_other_user_cannot_view_engineers_job(
    client: TestClient,
    auth_headers: AuthHeadersFn,
) -> None:
    job_id = _create_job(client, auth_headers, "Privacy test.")
    other = auth_headers("safety_officer")
    assert client.get(f"/api/jobs/{job_id}", headers=other).status_code == 403
    assert client.get(f"/api/jobs/{job_id}/events", headers=other).status_code == 403


def test_unknown_job_404(client: TestClient, auth_headers: AuthHeadersFn) -> None:
    headers = auth_headers("admin")
    assert client.get("/api/jobs/does-not-exist", headers=headers).status_code == 404
