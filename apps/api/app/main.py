from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings, validate_secret
from app.db import Base, SessionLocal, engine
from app.routers import (
    admin,
    approvals,
    artifacts,
    audit,
    auth,
    documents,
    evals,
    evidence,
    health,
    jobs,
    memories,
)
from app.seed import seed_users_if_empty


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_users_if_empty(db)
    finally:
        db.close()
    from app.runner import recover_running_jobs

    recover_running_jobs()
    yield


def create_app() -> FastAPI:
    validate_secret(get_settings())
    app = FastAPI(title="NIRVA API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Last-Event-ID", "X-Accel-Buffering"],
    )
    app.include_router(auth.router)
    app.include_router(jobs.router)
    app.include_router(artifacts.router)
    app.include_router(evidence.router)
    app.include_router(memories.router)
    app.include_router(documents.router)
    app.include_router(approvals.router)
    app.include_router(audit.router)
    app.include_router(admin.router)
    app.include_router(evals.router)
    app.include_router(health.router)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_: Request, __: Exception) -> JSONResponse:
        # Unhandled errors must stay CORS-visible: a header-less 500 makes the
        # browser report a confusing "blocked by CORS policy" instead of the
        # real server fault.
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    return app


app = create_app()
