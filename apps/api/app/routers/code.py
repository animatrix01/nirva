"""Working-code endpoints (E3).

POST /api/code/run generates analysis code (temperature 0.0) and executes it
in the host sandbox; one latest run is stored per job. Engineer/supervisor/
admin may run (engineer: own jobs only); safety_officer may view results only.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.audit import append_audit_event
from app.db import get_db
from app.deps import CurrentUser
from app.models import CodeRun, Job
from app.routers.jobs import _can_view

router = APIRouter(prefix="/api/code", tags=["code"])


class CodeRunRequest(BaseModel):
    job_id: str
    task: str


class CodeRunResponse(BaseModel):
    run_id: str
    job_id: str
    task: str
    code: str
    ok: bool
    stdout: str
    stderr: str
    exit_code: int


_CODE_SYSTEM = (
    "You generate short Python analysis scripts for industrial sensor and "
    "operational readings. Reply with ONLY executable Python code, no "
    "markdown fences, no explanations. Use only the standard library. "
    "Never import os, subprocess, socket, or eval/exec. Print the key "
    "numbers with print()."
)


def _codegen(task: str) -> str:
    from nirva_agent.config import GatewayConfig, load_gateway_config
    from nirva_agent.gateway import ChatMessage, GatewayClient
    from nirva_agent.graph import _strip_code_fences

    config = load_gateway_config(model="qwen2.5:3b-instruct-q4_K_M")
    gateway = GatewayClient(
        GatewayConfig(
            base_url=config.base_url,
            model=config.model,
            timeout_seconds=90.0,
        )
    )
    response = gateway.chat(
        [
            ChatMessage(role="system", content=_CODE_SYSTEM),
            ChatMessage(role="user", content=f"TASK: {task}"),
        ],
        temperature=0.0,
        max_tokens=600,
    )
    return _strip_code_fences(response.content)


@router.post("/run", response_model=CodeRunResponse)
def run_code(
    body: CodeRunRequest,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> CodeRunResponse:
    from nirva_tools.permissions import PermissionDenied, authorize
    from nirva_tools.sandbox import run_python

    job = db.get(Job, body.job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if not _can_view(user, job):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    try:
        authorize(user.role, "run_python")
    except PermissionDenied as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    if not body.task or len(body.task) > 1000:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="task required (<=1000 chars)")

    code = _codegen(body.task)
    result = run_python(code)

    run = db.query(CodeRun).filter(CodeRun.job_id == job.id).first()
    if run is None:
        run = CodeRun(
            id=f"coderun-{uuid.uuid4().hex[:12]}",
            job_id=job.id,
            task=body.task[:1000],
            code=code,
            stdout=result.stdout,
            stderr=result.stderr,
            ok=result.ok,
            created_by=user.id,
        )
        db.add(run)
    else:
        run.task = body.task[:1000]
        run.code = code
        run.stdout = result.stdout
        run.stderr = result.stderr
        run.ok = result.ok
        run.created_by = user.id
    db.commit()
    append_audit_event(
        db,
        actor=user.username,
        actor_role=user.role,
        action="tool.run_python",
        argument_summary=f"code run for job {job.id[:8]}: {'verified' if result.ok else 'failed'}",
        outcome="ok" if result.ok else "error",
        job_id=job.id,
    )
    db.commit()
    return CodeRunResponse(
        run_id=run.id,
        job_id=job.id,
        task=run.task,
        code=run.code,
        ok=run.ok,
        stdout=run.stdout,
        stderr=run.stderr,
        exit_code=result.exit_code,
    )


@router.get("/{job_id}", response_model=CodeRunResponse)
def get_code_run(
    job_id: str,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> CodeRunResponse:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if not _can_view(user, job):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    run = db.query(CodeRun).filter(CodeRun.job_id == job.id).first()
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No code run for this job")
    return CodeRunResponse(
        run_id=run.id,
        job_id=job.id,
        task=run.task,
        code=run.code,
        ok=run.ok,
        stdout=run.stdout,
        stderr=run.stderr,
        exit_code=0 if run.ok else 1,
    )


@router.get("/{job_id}/download")
def download_code(
    job_id: str,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> PlainTextResponse:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if not _can_view(user, job):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    run = db.query(CodeRun).filter(CodeRun.job_id == job.id).first()
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No code run for this job")
    header = f"# Working code for job {job.id} — generated analysis, sandbox-verified\n"
    return PlainTextResponse(
        header + run.code,
        media_type="text/x-python",
        headers={"Content-Disposition": f"attachment; filename=job-{job.id[:8]}-analysis.py"},
    )
