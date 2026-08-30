"""Model registry endpoint tests (System page data source)."""

from conftest import AuthHeadersFn
from fastapi.testclient import TestClient


def test_model_registry_lists_yaml_entries(
    client: TestClient,
    auth_headers: AuthHeadersFn,
) -> None:
    """The registry yaml is parsed: 4 known models, loaded flag present."""
    headers = auth_headers("admin")
    body = client.get("/api/admin/models", headers=headers).json()
    names = [m["model_name"] for m in body]
    assert "qwen2.5:3b-instruct-q4_K_M" in names
    assert "qwen2.5vl:3b" in names
    assert "bge-m3" in names
    for entry in body:
        assert set(entry.keys()) >= {
            "model_name",
            "purpose",
            "quantization",
            "checksum_sha256",
            "profile",
            "loaded",
        }
        assert isinstance(entry["loaded"], bool)
