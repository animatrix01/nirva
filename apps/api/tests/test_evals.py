"""Contract tests for GET /api/evals (B4 unblock)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

# the repo's real results produced by the live eval runner
REAL_RESULTS = (
    Path(__file__).resolve().parents[3] / "packages" / "evals" / "results"
)


@pytest.fixture()
def use_real_results(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NIRVA_EVALS_RESULTS_DIR", str(REAL_RESULTS))


FORBIDDEN_KEYS = {
    "dataset_path",
    "qdrant_url",
    "model_base_url",
    "expected_docs",
    "retrieved_docs",
    "retrieved_scores",
    "citations_count",
    "findings_present",
    "expect",
}


def _no_forbidden_keys(payload: dict[str, Any]) -> None:
    def walk(node: Any) -> None:
        if isinstance(node, dict):
            for key in node:
                assert key not in FORBIDDEN_KEYS, f"leaked key: {key}"
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(payload)


def test_admin_gets_trimmed_shape(client: Any, auth_headers: Any, use_real_results: None) -> None:
    resp = client.get("/api/evals", headers=auth_headers("admin"))
    assert resp.status_code == 200
    payload = resp.json()

    assert set(payload) == {"dataset_version", "executed_at", "summary", "gates", "cases"}
    assert set(payload["summary"]) == {
        "cases_executed",
        "recall_at_5",
        "citation_validity",
        "grounded_answer_rate",
        "correct_abstention_rate",
        "unauthorized_retrieval_count",
        "injection_block_rate",
        "cite_cases",
    }
    assert set(payload["gates"]) == {
        "recall_at_5_min",
        "citation_validity_min",
        "unauthorized_max",
        "recall_pass",
        "citation_pass",
        "unauthorized_pass",
    }
    assert payload["summary"]["cases_executed"] >= 100
    assert payload["gates"]["recall_pass"] is True

    case = payload["cases"][0]
    assert set(case) == {
        "case_id",
        "category",
        "role",
        "question",
        "recall_at_5",
        "citation_validity",
        "abstained",
        "unauthorized",
        "blocked",
    }
    assert len(payload["cases"]) == payload["summary"]["cases_executed"]
    _no_forbidden_keys(payload)


def test_safety_officer_allowed(client: Any, auth_headers: Any, use_real_results: None) -> None:
    resp = client.get("/api/evals", headers=auth_headers("safety_officer"))
    assert resp.status_code == 200


def test_engineer_forbidden(client: Any, auth_headers: Any, use_real_results: None) -> None:
    resp = client.get("/api/evals", headers=auth_headers("engineer"))
    assert resp.status_code == 403


def test_unauthenticated_unauthorized(client: Any, use_real_results: None) -> None:
    resp = client.get("/api/evals")
    assert resp.status_code == 401


def test_404_when_no_results(client: Any, auth_headers: Any, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NIRVA_EVALS_RESULTS_DIR", str(tmp_path))
    resp = client.get("/api/evals", headers=auth_headers("admin"))
    assert resp.status_code == 404
    assert resp.json()["detail"] == "No evaluation run yet"
