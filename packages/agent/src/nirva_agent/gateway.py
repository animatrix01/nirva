"""OpenAI-compatible model gateway client.

Talks to any server implementing ``POST {base_url}/chat/completions`` with an
OpenAI-shaped request/response (Ollama's ``/v1`` and vLLM both qualify). The
base URL comes from ``MODEL_BASE_URL`` only; swapping inference engines is a
config change, never a code change.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Literal

import httpx

from nirva_agent.config import GatewayConfig, load_gateway_config

Role = Literal["system", "user", "assistant"]


@dataclass(frozen=True)
class ChatMessage:
    """One message in a zoned prompt (system / user / evidence are separate messages)."""

    role: Role
    content: str

    def as_dict(self) -> dict[str, str]:
        return {"role": self.role, "content": self.content}


@dataclass(frozen=True)
class ChatResponse:
    content: str
    finish_reason: str | None
    model: str
    prompt_tokens: int | None
    completion_tokens: int | None


class GatewayError(RuntimeError):
    """Base error for gateway failures."""


class GatewayRequestError(GatewayError):
    """The gateway returned a non-2xx status."""

    def __init__(self, status_code: int, body: str) -> None:
        super().__init__(f"gateway returned HTTP {status_code}: {body[:500]}")
        self.status_code = status_code
        self.body = body


class GatewayResponseError(GatewayError):
    """The gateway response did not match the OpenAI completion shape."""


def _build_body(
    config: GatewayConfig,
    messages: list[ChatMessage],
    *,
    temperature: float,
    max_tokens: int,
    extra: dict[str, Any] | None,
) -> dict[str, Any]:
    if not messages:
        raise ValueError("messages must not be empty")
    body: dict[str, Any] = {
        "model": config.model,
        "messages": [m.as_dict() for m in messages],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if extra:
        body.update(extra)
    return body


def _extract_content(payload: dict[str, Any]) -> ChatResponse:
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise GatewayResponseError(f"missing choices in response: {payload!r}")
    first = choices[0]
    if not isinstance(first, dict):
        raise GatewayResponseError(f"malformed choice entry: {first!r}")
    message = first.get("message")
    if not isinstance(message, dict) or not isinstance(message.get("content"), str):
        raise GatewayResponseError(f"missing message.content in response: {payload!r}")
    usage = payload.get("usage")
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    if isinstance(usage, dict):
        raw_prompt = usage.get("prompt_tokens")
        raw_completion = usage.get("completion_tokens")
        prompt_tokens = raw_prompt if isinstance(raw_prompt, int) else None
        completion_tokens = raw_completion if isinstance(raw_completion, int) else None
    finish_reason = first.get("finish_reason")
    model = payload.get("model")
    return ChatResponse(
        content=message["content"],
        finish_reason=finish_reason if isinstance(finish_reason, str) else None,
        model=model if isinstance(model, str) else "",
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
    )


def _raise_for_status(response: httpx.Response) -> None:
    if response.status_code >= 400:
        raise GatewayRequestError(response.status_code, response.text)


def _parse_json(payload_bytes: bytes) -> dict[str, Any]:
    try:
        parsed: Any = json.loads(payload_bytes)
    except ValueError as exc:
        raise GatewayResponseError(f"non-JSON response body: {payload_bytes[:200]!r}") from exc
    if not isinstance(parsed, dict):
        raise GatewayResponseError(f"unexpected JSON root type: {type(parsed)!r}")
    return parsed


class GatewayClient:
    """Synchronous OpenAI-compatible chat client bound to one local model."""

    def __init__(
        self,
        config: GatewayConfig | None = None,
        *,
        http_client: httpx.Client | None = None,
    ) -> None:
        self._config = config or load_gateway_config()
        self._owns_client = http_client is None
        self._client = http_client or httpx.Client(timeout=self._config.timeout_seconds)

    @property
    def config(self) -> GatewayConfig:
        return self._config

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.0,
        max_tokens: int = 1024,
        extra: dict[str, Any] | None = None,
    ) -> ChatResponse:
        """Send a zoned conversation and return the assistant reply."""
        try:
            response = self._client.post(
                f"{self._config.base_url}/chat/completions",
                json=_build_body(
                    self._config,
                    messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    extra=extra,
                ),
                headers={"Authorization": f"Bearer {self._config.api_key}"},
            )
        except httpx.HTTPError as exc:
            raise GatewayError(
                f"gateway unreachable at {self._config.base_url}: {exc}"
            ) from exc
        _raise_for_status(response)
        return _extract_content(_parse_json(response.content))


class AsyncGatewayClient:
    """Async variant sharing request building with :class:`GatewayClient`."""

    def __init__(
        self,
        config: GatewayConfig | None = None,
        *,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._config = config or load_gateway_config()
        self._owns_client = http_client is None
        self._client = http_client or httpx.AsyncClient(
            timeout=self._config.timeout_seconds
        )

    @property
    def config(self) -> GatewayConfig:
        return self._config

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.0,
        max_tokens: int = 1024,
        extra: dict[str, Any] | None = None,
    ) -> ChatResponse:
        try:
            response = await self._client.post(
                f"{self._config.base_url}/chat/completions",
                json=_build_body(
                    self._config,
                    messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    extra=extra,
                ),
                headers={"Authorization": f"Bearer {self._config.api_key}"},
            )
        except httpx.HTTPError as exc:
            raise GatewayError(
                f"gateway unreachable at {self._config.base_url}: {exc}"
            ) from exc
        _raise_for_status(response)
        return _extract_content(_parse_json(response.content))
