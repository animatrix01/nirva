"""Tests for the vision inspection helper (message shape + error paths)."""

import sys
from pathlib import Path

import httpx
import pytest

SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from nirva_agent.gateway import GatewayError  # noqa: E402
from nirva_agent.vision import describe_image  # noqa: E402


class _CaptureResponse:
    def __init__(self, payload: object, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code
        self.text = ""

    def json(self) -> object:
        return self._payload


def test_message_shape_and_content(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict = {}

    def fake_post(url: str, json: dict, timeout: float) -> _CaptureResponse:
        captured["url"] = url
        captured["body"] = json
        return _CaptureResponse(
            {"choices": [{"message": {"content": "Visible leakage at seal gland."}}]}
        )

    monkeypatch.setattr(httpx, "post", fake_post)

    result = describe_image(
        "http://127.0.0.1:11434/v1",
        "qwen2.5vl:3b",
        "Describe only what you observe.",
        b"\xff\xd8fakejpeg",
    )

    assert result == "Visible leakage at seal gland."
    assert captured["url"] == "http://127.0.0.1:11434/v1/chat/completions"
    content = captured["body"]["messages"][0]["content"]
    assert content[0] == {"type": "text", "text": "Describe only what you observe."}
    image_part = content[1]
    assert image_part["type"] == "image_url"
    assert image_part["image_url"]["url"].startswith("data:image/jpeg;base64,")


def test_http_error_raises_gateway_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_post(url: str, json: dict, timeout: float) -> _CaptureResponse:
        raise httpx.ConnectError("no route")

    monkeypatch.setattr(httpx, "post", fake_post)
    with pytest.raises(GatewayError):
        describe_image("http://x/v1", "m", "p", b"img")


def test_non_200_raises_gateway_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_post(url: str, json: dict, timeout: float) -> _CaptureResponse:
        return _CaptureResponse({"error": "model not loaded"}, status_code=500)

    monkeypatch.setattr(httpx, "post", fake_post)
    with pytest.raises(GatewayError):
        describe_image("http://x/v1", "m", "p", b"img")
