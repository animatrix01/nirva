import os
import sys
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
API_DIR = ROOT / "apps" / "api"
TOOLS_SRC = ROOT / "packages" / "tools" / "src"
for path in (str(API_DIR), str(TOOLS_SRC)):
    if path not in sys.path:
        sys.path.insert(0, path)

_TEST_DB = Path(__file__).parent / "_api_test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"
os.environ["JWT_SECRET"] = "test-only-secret-not-the-default"
if _TEST_DB.exists():
    _TEST_DB.unlink()

from app.main import create_app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

DEMO_PASSWORD = "nirva-demo-pass"

AuthHeadersFn = Callable[[str], dict[str, str]]


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def auth_headers(client: TestClient) -> AuthHeadersFn:
    def _login(username: str) -> dict[str, str]:
        response = client.post(
            "/api/auth/login",
            json={"username": username, "password": DEMO_PASSWORD},
        )
        assert response.status_code == 200, response.text
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _login


@pytest.fixture(scope="session", autouse=True)
def fake_graph_backend() -> Iterator[None]:
    """Route job runs through the REAL LangGraph adapter with a fake gateway.

    Keeps API tests offline and deterministic while still exercising the
    production graph code path (no mock graph, no network).
    """
    import app.graph_client as gc
    from nirva_agent.gateway import ChatResponse

    class FakeGateway:
        def chat(
            self,
            messages: list[object],
            *,
            temperature: float = 0.0,
            max_tokens: int = 1024,
            extra: dict[str, object] | None = None,
        ) -> ChatResponse:
            return ChatResponse(
                content="Seal wear is the likely cause. [chunk-9]",
                finish_reason="stop",
                model="fake",
                prompt_tokens=1,
                completion_tokens=1,
            )

    original = gc.get_graph

    def _fake_get_graph(retriever: object = None) -> gc.InvestigationGraph:
        return gc.LangGraphInvestigationGraph(FakeGateway())  # type: ignore[arg-type]

    gc.get_graph = _fake_get_graph  # type: ignore[assignment]
    yield
    gc.get_graph = original
