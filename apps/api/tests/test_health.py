from fastapi.testclient import TestClient


def test_health_ok_when_postgres_up(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in ("ok", "degraded")
    services = body["services"]
    assert set(services.keys()) == {"postgres", "qdrant", "model_gateway", "storage"}
    assert services["postgres"] == "up"
