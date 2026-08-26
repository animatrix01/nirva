"""Configuration for the model gateway client.

The gateway speaks the OpenAI-compatible chat-completions protocol and must work
unchanged against both Ollama (dev, e.g. http://ollama:11434/v1) and vLLM
(prod). The endpoint comes exclusively from the MODEL_BASE_URL environment
variable (COMMON.md c.7). No cloud calls ever: this client only ever talks to
the locally hosted inference server.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass


class GatewayConfigError(RuntimeError):
    """Raised when required gateway configuration is missing or invalid."""


@dataclass(frozen=True)
class GatewayConfig:
    """Resolved model-gateway settings."""

    base_url: str
    model: str
    api_key: str = "local"
    timeout_seconds: float = 120.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise GatewayConfigError("base_url must not be empty")
        if not self.model:
            raise GatewayConfigError("model must not be empty")


def load_gateway_config(
    env: Mapping[str, str] | None = None,
    *,
    model: str = "nirva-local",
) -> GatewayConfig:
    """Build a :class:`GatewayConfig` from environment variables.

    Only ``MODEL_BASE_URL`` (COMMON.md c.7) is read; ``model`` is supplied by
    the caller because Ollama and vLLM expose different local model names.
    """
    source = os.environ if env is None else env
    base_url = source.get("MODEL_BASE_URL", "").strip().rstrip("/")
    if not base_url:
        raise GatewayConfigError(
            "MODEL_BASE_URL is not set; expected e.g. http://ollama:11434/v1"
        )
    return GatewayConfig(base_url=base_url, model=model)
