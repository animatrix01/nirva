import json
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.deps import require_roles
from app.models import User
from app.schemas import ModelInfo

router = APIRouter(prefix="/api/admin", tags=["admin"])

MODEL_CONFIG_DIR = Path(__file__).resolve().parents[3] / "infra" / "model-config"


@router.get("/models", response_model=list[ModelInfo])
def list_models(
    _: Annotated[User, Depends(require_roles("admin"))],
) -> list[ModelInfo]:
    models: list[ModelInfo] = []
    if MODEL_CONFIG_DIR.is_dir():
        for path in sorted(MODEL_CONFIG_DIR.glob("*.json")):
            try:
                data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            entries = data.get("models", [data])
            if isinstance(entries, dict):
                entries = [entries]
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                models.append(
                    ModelInfo(
                        model_name=str(entry.get("model_name", path.stem)),
                        purpose=str(entry.get("purpose", "generation")),
                        quantization=str(entry.get("quantization", "unknown")),
                        checksum_sha256=str(entry.get("checksum_sha256", "")),
                        profile=str(entry.get("profile", "dev")),
                        loaded=bool(entry.get("loaded", False)),
                    )
                )
    return models
