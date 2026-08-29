from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    user_id: str
    username: str
    role: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class MeResponse(BaseModel):
    user_id: str
    username: str
    display_name: str
    role: str


class JobCreateRequest(BaseModel):
    objective: str = Field(min_length=1)
    equipment_id: str | None = None


class JobCreatedResponse(BaseModel):
    job_id: str
    status: str
    created_at: datetime


class JobSummary(BaseModel):
    job_id: str
    objective_summary: str
    status: str
    created_by: str
    created_at: datetime


class CitationOut(BaseModel):
    title: str
    revision: str
    locator: str
    chunk_id: str


class FinalReportOut(BaseModel):
    findings: str
    confidence: float
    assumptions: list[str]
    gaps: list[str]
    citations: list[CitationOut]


class JobDetailResponse(BaseModel):
    job_id: str
    objective: str
    status: str
    current_node: str | None
    created_by: str
    created_at: datetime
    updated_at: datetime
    final_report: FinalReportOut | None = None


class ApprovalOut(BaseModel):
    approval_id: str
    job_id: str
    proposal_id: str
    action: str
    arguments_summary: str
    evidence_refs: list[str]
    risk_level: str
    status: str
    requested_at: datetime


class ApprovalDecisionRequest(BaseModel):
    decision: str = Field(pattern="^(approved|rejected)$")
    comment: str | None = None


class ApprovalDecisionResponse(BaseModel):
    approval_id: str
    status: str
    decided_by: str
    decided_at: datetime
    work_order_id: str | None = None


class AuditEventOut(BaseModel):
    event_id: str
    job_id: str | None
    actor: str
    actor_role: str
    action: str
    argument_summary: str
    outcome: str
    prev_hash: str
    hash: str
    ts: datetime


class AuditResponse(BaseModel):
    chain_valid: bool
    events: list[AuditEventOut]


class DocumentOut(BaseModel):
    document_id: str
    title: str
    document_type: str
    revision: str
    effective_date: str
    department: str
    equipment_id: str | None
    confidentiality_level: str
    content_hash: str
    status: str
    uploaded_at: datetime


class DocumentUploadResponse(BaseModel):
    document_id: str
    status: str
    content_hash: str
    duplicate: bool
    chunks: int = 0


class ModelInfo(BaseModel):
    model_name: str
    purpose: str
    quantization: str
    checksum_sha256: str
    profile: str
    loaded: bool


class HealthServices(BaseModel):
    postgres: str
    qdrant: str
    model_gateway: str
    storage: str


class HealthResponse(BaseModel):
    status: str
    services: HealthServices
    version: str


def to_iso_utc(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def envelope(
    job_id: str,
    seq: int,
    type_: str,
    node: str,
    payload_ref: str | None,
    ts: datetime,
) -> dict[str, Any]:
    return {
        "job_id": job_id,
        "seq": seq,
        "type": type_,
        "node": node,
        "payload_ref": payload_ref,
        "ts": to_iso_utc(ts),
    }
