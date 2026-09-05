"""Serving endpoint for evaluation runs (B4 unblock for the web lane).

Reads the newest packages/evals/results/results-*.json and returns a
UI-trimmed payload. Filesystem paths and infra connection strings
(dataset_path, qdrant_url, model_base_url) are never served — the response
model enforces the exact shape.
"""

import json
import os
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import require_roles
from app.models import User
from app.schemas import EvalsCase, EvalsGates, EvalsResponse, EvalsSummary

router = APIRouter(prefix="/api/evals", tags=["evals"])

def results_dir() -> Path:
    """Monkeypatchable in tests; env override first, then walk up from this
    file looking for packages/evals/results (works for both source checkouts
    and copied site-packages installs), then the compose container mount."""
    env_dir = os.getenv("NIRVA_EVALS_RESULTS_DIR")
    if env_dir:
        return Path(env_dir)
    here = Path(__file__).resolve()
    for base in (here, *here.parents):
        candidate = base / "packages" / "evals" / "results"
        if candidate.is_dir():
            return candidate
    return Path("/srv/packages/evals/results")


def _latest_results_file() -> Path | None:
    candidates = sorted(results_dir().glob("results-*.json"))
    return candidates[-1] if candidates else None


@router.get("", response_model=EvalsResponse)
def latest_evals(_: Annotated[User, Depends(require_roles("admin", "safety_officer"))]) -> EvalsResponse:
    path = _latest_results_file()
    if path is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No evaluation run yet",
        )
    try:
        raw: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No evaluation run yet",
        ) from exc

    # Trim: the response model keeps only UI fields and drops infra paths
    # (dataset_path / qdrant_url / model_base_url) by construction.
    return EvalsResponse(
        dataset_version=str(raw.get("dataset_version", "")),
        executed_at=str(raw.get("executed_at", "")),
        summary=EvalsSummary.model_validate(raw.get("summary", {})),
        gates=EvalsGates.model_validate(raw.get("gates", {})),
        cases=[
            EvalsCase(
                case_id=str(c.get("case_id", "")),
                category=str(c.get("category", "")),
                role=str(c.get("role", "")),
                question=str(c.get("question", "")),
                recall_at_5=c.get("recall_at_5"),
                citation_validity=c.get("citation_validity"),
                abstained=bool(c.get("abstained", False)),
                unauthorized=bool(c.get("unauthorized", False)),
                blocked=c.get("blocked"),
            )
            for c in raw.get("cases", [])
        ],
    )
