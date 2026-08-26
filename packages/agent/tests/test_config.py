"""Tests for the model-gateway configuration loader."""

import pytest

from nirva_agent.config import GatewayConfig, GatewayConfigError, load_gateway_config


def test_loads_from_model_base_url() -> None:
    config = load_gateway_config(
        {"MODEL_BASE_URL": "http://ollama:11434/v1"}, model="llama3.1:8b"
    )
    assert isinstance(config, GatewayConfig)
    assert config.base_url == "http://ollama:11434/v1"
    assert config.model == "llama3.1:8b"


def test_trailing_slash_is_stripped() -> None:
    config = load_gateway_config({"MODEL_BASE_URL": "http://vllm:8000/v1/"})
    assert config.base_url == "http://vllm:8000/v1"


def test_missing_env_raises() -> None:
    with pytest.raises(GatewayConfigError, match="MODEL_BASE_URL"):
        load_gateway_config({})


def test_blank_env_raises() -> None:
    with pytest.raises(GatewayConfigError, match="MODEL_BASE_URL"):
        load_gateway_config({"MODEL_BASE_URL": "   "})


def test_empty_model_raises() -> None:
    with pytest.raises(GatewayConfigError, match="model"):
        load_gateway_config(
            {"MODEL_BASE_URL": "http://x/v1"}, model=""
        )
