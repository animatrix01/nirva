from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import Base, SessionLocal, engine
from app.routers import admin, approvals, audit, auth, health, jobs
from app.seed import seed_users_if_empty


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_users_if_empty(db)
    finally:
        db.close()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="NIRVA API", version="0.1.0", lifespan=lifespan)
    app.include_router(auth.router)
    app.include_router(auth.audit_router)
    app.include_router(jobs.router)
    app.include_router(approvals.router)
    app.include_router(audit.router)
    app.include_router(admin.router)
    app.include_router(health.router)
    return app


app = create_app()
