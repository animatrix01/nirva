import io
from pathlib import Path

import httpx
import pytest
from conftest import AuthHeadersFn
from fastapi.testclient import TestClient


def _upload_image(
    client: TestClient,
    auth_headers: AuthHeadersFn,
    monkeypatch: pytest.MonkeyPatch,
    *,
    role: str = "engineer",
    observation: str = "Visible oil leakage at the seal gland. Coupling shim appears missing.",
) -> httpx.Response:
    """Upload a synthetic image with the VLM + indexing layers mocked out."""
    monkeypatch.setattr(
        "nirva_agent.vision.describe_image",
        lambda **kwargs: observation,
    )
    monkeypatch.setattr(
        "app.routers.documents._parse_and_index", lambda *args, **kwargs: 1
    )

    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (320, 200), (140, 140, 140)).save(buffer, format="PNG")
    buffer.seek(0)

    return client.post(
        "/api/documents/upload",
        files={"file": ("P204_photo_test.png", buffer, "image/png")},
        data={
            "title": "P-204 Photo (vision inspection)",
            "document_type": "data",
            "revision": "1",
            "effective_date": "2026-01-01",
            "department": "Reliability",
            "equipment_id": "P-204",
            "allowed_roles": "engineer,safety_officer,supervisor,admin",
        },
        headers=auth_headers(role),
    )


def test_image_upload_accepted_for_engineer(
    client: TestClient,
    auth_headers: AuthHeadersFn,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = _upload_image(client, auth_headers, monkeypatch)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "indexed"
    assert body["chunks"] == 1
    assert body["duplicate"] is False


def test_image_upload_hidden_for_reviewers(
    client: TestClient,
    auth_headers: AuthHeadersFn,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for role in ("supervisor", "safety_officer"):
        response = _upload_image(client, auth_headers, monkeypatch, role=role)
        assert response.status_code == 403
        assert "engineer or admin" in response.json()["detail"]


def test_parse_and_index_image_uses_observations_prompt(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """The image branch must call the VLM with the observations-only prompt."""
    captured: dict = {}

    def fake_describe(**kwargs: object) -> str:
        captured.update(kwargs)
        return "Visible oil leakage at the seal gland."

    monkeypatch.setattr("nirva_agent.vision.describe_image", fake_describe)
    monkeypatch.setattr(
        "nirva_retrieval.embed.dense_embeddings",
        lambda texts, base_url: [[0.0] * 4 for _ in texts],
    )
    monkeypatch.setattr(
        "nirva_retrieval.embed.sparse_embedding", lambda text: {1: 1.0}
    )
    monkeypatch.setattr("nirva_retrieval.store.ensure_collection", lambda client: None)
    monkeypatch.setattr(
        "nirva_retrieval.store.upsert_chunks",
        lambda client, chunks, vectors: len(chunks),
    )


    from app.routers.documents import _parse_and_index
    from PIL import Image

    path = tmp_path / "capture.png"
    Image.new("RGB", (32, 32), (100, 100, 100)).save(path, format="PNG")

    base = {
        "document_id": "doc-vision-test",
        "document_title": "P-204 Photo (vision inspection)",
        "document_type": "data",
        "revision": "1",
        "effective_date": "2026-01-01",
        "department": "Reliability",
        "equipment_id": "P-204",
        "confidentiality_level": "internal",
        "allowed_roles": ["engineer"],
    }
    count = _parse_and_index(path, base, "engineer")

    assert count == 1
    assert captured["model"] == "qwen2.5vl:3b"
    prompt = str(captured["prompt"])
    assert "Do not conclude causes" in prompt
    assert "recommend actions" in prompt
