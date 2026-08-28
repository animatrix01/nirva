import pytest
from fastapi.testclient import TestClient

from conftest import AuthHeadersFn

ALL_ROLES = ["engineer", "safety_officer", "supervisor", "admin"]


@pytest.mark.parametrize("username", ALL_ROLES)
def test_login_all_roles(client: TestClient, username: str) -> None:
    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": "nirva-demo-pass"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["role"] == username
    assert body["user"]["username"] == username


def test_login_wrong_password_401(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"username": "engineer", "password": "nope"})
    assert response.status_code == 401


def test_login_unknown_user_401(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"username": "ghost", "password": "x"})
    assert response.status_code == 401


def test_me_requires_token(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer junk"}).status_code == 401


def test_me_returns_identity(client: TestClient, auth_headers: AuthHeadersFn) -> None:
    headers = auth_headers("supervisor")
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "supervisor"
    assert body["display_name"]


@pytest.mark.parametrize(
    ("endpoint", "allowed"),
    [
        ("/api/audit", ["admin", "safety_officer"]),
        ("/api/approvals", ["supervisor", "admin"]),
        ("/api/admin/models", ["admin"]),
    ],
)
def test_role_guards_matrix(
    client: TestClient,
    auth_headers: AuthHeadersFn,
    endpoint: str,
    allowed: list[str],
) -> None:
    for role in ALL_ROLES:
        headers = auth_headers(role)
        response = client.get(endpoint, headers=headers)
        if role in allowed:
            assert response.status_code == 200, f"{role} should access {endpoint}"
        else:
            assert response.status_code == 403, f"{role} must NOT access {endpoint}"
