from pathlib import Path
from typing import Annotated

import httpx
import sqlalchemy as sa
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.schemas import HealthResponse, HealthServices

router = APIRouter(prefix="/api", tags=["health"])

VERSION = "0.1.0"


@router.get("/health", response_model=HealthResponse)
def health(db: Annotated[Session, Depends(get_db)]) -> HealthResponse:
    settings = get_settings()
    postgres_status = "down"
    try:
        db.execute(text("SELECT 1"))
        postgres_status = "up"
    except sa.exc.SQLAlchemyError:
        postgres_status = "down"

    qdrant_status = _probe(settings.qdrant_url.rstrip("/") + "/healthz")
    model_status = _probe(settings.model_base_url.rstrip("/") + "/models")

    storage_path = Path(settings.storage_path)
    storage_status = "up" if storage_path.exists() or storage_path.parent.exists() else "down"

    return HealthResponse(
        status="ok" if postgres_status == "up" else "degraded",
        services=HealthServices(
            postgres=postgres_status,
            qdrant=qdrant_status,
            model_gateway=model_status,
            storage=storage_status,
        ),
        version=VERSION,
    )


def _probe(url: str) -> str:
    try:
        with httpx.Client(timeout=1.0) as client:
            response = client.get(url)
            return "up" if response.status_code < 500 else "down"
    except (httpx.HTTPError, OSError):
        return "down"
