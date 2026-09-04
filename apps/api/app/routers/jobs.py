import json
import time
from collections.abc import Generator
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import append_audit_event
from app.db import SessionLocal, get_db
from app.deps import CurrentUser
from app.events import STREAM_STOP_EVENT_TYPES, fetch_events_after, render_envelope
from app.models import Job, JobEvidence
from app.runner import new_job_id, start_job_run
from app.schemas import (
    FinalReportOut,
    JobCreatedResponse,
    JobCreateRequest,
    JobDetailResponse,
    JobSummary,
)

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

POLL_INTERVAL_SECONDS = 0.1


def _can_view(user: CurrentUser, job: Job) -> bool:
    # safety_officer reviews all investigations (read-only audit persona)
    return (
        user.role in ("supervisor", "admin", "safety_officer")
        or job.created_by == user.id
    )


@router.post("", response_model=JobCreatedResponse, status_code=status.HTTP_201_CREATED)
def create_job(
    body: JobCreateRequest,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> JobCreatedResponse:
    job = Job(
        id=new_job_id(),
        objective=body.objective,
        equipment_id=body.equipment_id,
        created_by=user.id,
    )
    db.add(job)
    db.commit()
    append_audit_event(
        db,
        actor=user.username,
        actor_role=user.role,
        action="job.created",
        argument_summary=f"objective={body.objective[:120]!r}",
        job_id=job.id,
    )
    db.commit()
    start_job_run(job.id)
    return JobCreatedResponse(job_id=job.id, status=job.status, created_at=job.created_at)


@router.get("", response_model=list[JobSummary])
def list_jobs(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    equipment_id: str | None = None,
    limit: int = 50,
) -> list[JobSummary]:
    query = db.query(Job)
    # safety_officer has read-visibility of all investigations (audit persona,
    # DECISIONS.md 2026-08-30); engineers see only their own
    if user.role not in ("supervisor", "admin", "safety_officer"):
        query = query.filter(Job.created_by == user.id)
    if status_filter is not None:
        query = query.filter(Job.status == status_filter)
    if equipment_id is not None:
        query = query.filter(Job.equipment_id == equipment_id)
    jobs = query.order_by(Job.created_at.desc()).limit(min(limit, 200)).all()

    # evidence-source counts + report confidence for the list view
    evidence_counts: dict[str, int] = {
        job_id: count
        for job_id, count in db.query(
            JobEvidence.job_id, func.count(JobEvidence.id)
        )
        .group_by(JobEvidence.job_id)
        .all()
    }

    def _confidence(job: Job) -> float | None:
        report = job.final_report
        if not isinstance(report, dict):
            return None
        value = report.get("confidence")
        return float(value) if isinstance(value, (int, float)) else None

    return [
        JobSummary(
            job_id=j.id,
            objective_summary=j.objective[:120],
            status=j.status,
            equipment_id=j.equipment_id,
            sources=evidence_counts.get(j.id, 0),
            confidence=_confidence(j),
            created_by=j.created_by,
            created_at=j.created_at,
        )
        for j in jobs
    ]


@router.get("/{job_id}", response_model=JobDetailResponse)
def get_job(
    job_id: str,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> JobDetailResponse:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if not _can_view(user, job):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    report = FinalReportOut.model_validate(job.final_report) if job.final_report else None
    return JobDetailResponse(
        job_id=job.id,
        objective=job.objective,
        status=job.status,
        current_node=job.current_node,
        created_by=job.created_by,
        created_at=job.created_at,
        updated_at=job.updated_at,
        final_report=report,
    )


def _sse_format(data: dict[str, object]) -> str:
    return f"data: {json.dumps(data, separators=(',', ':'))}\n\n"


def _event_stream(job_id: str, after_seq: int) -> Generator[str, None, None]:
    local_db: Session = SessionLocal()
    try:
        cursor = after_seq
        while True:
            events = fetch_events_after(local_db, job_id, cursor)
            if events:
                local_db.expire_all()
                for event in events:
                    cursor = event.seq
                    yield _sse_format(render_envelope(event))
                    if event.type in STREAM_STOP_EVENT_TYPES:
                        return
                local_db.rollback()
            else:
                job = local_db.get(Job, job_id)
                if job is None:
                    return
                if job.status in ("completed", "failed", "blocked_injection", "awaiting_approval"):
                    return
                local_db.expire(job)
                local_db.rollback()
                time.sleep(POLL_INTERVAL_SECONDS)
    finally:
        local_db.close()


@router.get("/{job_id}/events")
def stream_events(
    job_id: str,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    last_event_id: Annotated[str | None, Header(alias="Last-Event-ID")] = None,
) -> StreamingResponse:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if not _can_view(user, job):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    try:
        after_seq = int(last_event_id) if last_event_id is not None else -1
    except ValueError:
        after_seq = -1
    return StreamingResponse(
        _event_stream(job_id, after_seq),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
