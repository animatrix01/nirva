import json
from pathlib import Path
from typing import Annotated, Any

import httpx
import yaml
from fastapi import APIRouter, Depends

from app.config import get_settings
from app.deps import require_roles
from app.models import User
from app.schemas import ModelInfo

router = APIRouter(prefix="/api/admin", tags=["admin"])

MODEL_CONFIG_DIR = Path(__file__).resolve().parents[4] / "infra" / "model-config"


def _registry_entries() -> list[dict[str, Any]]:
    """Read model registry entries from infra/model-config (yaml preferred)."""
    entries: list[dict[str, Any]] = []
    if not MODEL_CONFIG_DIR.is_dir():
        return entries
    for path in sorted(MODEL_CONFIG_DIR.glob("*.yaml")) + sorted(
        MODEL_CONFIG_DIR.glob("*.yml")
    ):
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
        except yaml.YAMLError:
            continue
        if not isinstance(data, dict):
            continue
        registry = data.get("registry")
        if isinstance(registry, list):
            entries.extend(e for e in registry if isinstance(e, dict))
    for path in sorted(MODEL_CONFIG_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        entries.extend(e for e in (data.get("models", [data]) or []) if isinstance(e, dict))
    return entries


def _locally_pulled_models(root: str) -> set[str]:
    """Model names present in the local Ollama store (best-effort)."""
    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{root.rstrip('/').removesuffix('/v1')}/api/tags")
        response.raise_for_status()
        models = response.json().get("models", [])
        names: set[str] = set()
        for entry in models:
            name = str(entry.get("name", ""))
            names.add(name)
            names.add(name.removesuffix(":latest"))
        return names
    except (httpx.HTTPError, OSError, ValueError):
        return set()


@router.get("/models", response_model=list[ModelInfo])
def list_models(_: Annotated[User, Depends(require_roles("admin"))]) -> list[ModelInfo]:
    settings = get_settings()
    pulled = _locally_pulled_models(settings.model_base_url)
    models: list[ModelInfo] = []
    for entry in _registry_entries():
        model_name = str(entry.get("model_name", ""))
        checksum = str(entry.get("checksum_sha256", ""))
        models.append(
            ModelInfo(
                model_name=model_name,
                purpose=str(entry.get("purpose", "generation")),
                quantization=str(entry.get("quantization", "unknown")),
                checksum_sha256=checksum,
                profile=str(entry.get("profile", "dev")),
                loaded=model_name in pulled,
            )
        )
    return models

