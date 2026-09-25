"""Shared report-data collection for the export endpoints (E1/E2).

Reads the job's FinalReport JSON, role-filtered evidence rows, contradictions,
asset-history events, and the latest approval — the same live data the UI
shows. Evidence rows honor per-chunk allowed_roles exactly like the evidence
endpoint: chunks the role may not read are EXCLUDED, not leaked into exports.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, cast

from app.models import Approval, AssetEvent, CodeRun, Job, JobEvidence
from sqlalchemy.orm import Session


@dataclass
class EvidenceRow:
    chunk_id: str
    title: str
    revision: str
    locator: str
    passage: str
    score: float


@dataclass
class ContradictionRow:
    topic: str
    source_a: str
    claim_a: str
    source_b: str
    claim_b: str


@dataclass
class ReportData:
    job_id: str
    objective: str
    equipment_id: str
    status: str
    created_at: datetime | None
    findings: str
    confidence: float
    assumptions: list[str] = field(default_factory=list)
    gaps: list[str] = field(default_factory=list)
    citations: list[dict[str, Any]] = field(default_factory=list)
    evidence: list[EvidenceRow] = field(default_factory=list)
    contradictions: list[ContradictionRow] = field(default_factory=list)
    asset_events: list[dict[str, str]] = field(default_factory=list)
    recommendation: str = ""
    recommendation_risk: str = ""
    recommendation_action: str = ""
    working_code: str | None = None
    working_code_result: str | None = None


def _locator(payload: dict[str, Any]) -> str:
    page = payload.get("page")
    section = payload.get("section") or ""
    if page is None:
        return str(section)
    return f"p.{page} {section}".strip()


def evidence_for_role(db: Session, job_id: str, role: str) -> list[EvidenceRow]:
    rows = (
        db.query(JobEvidence)
        .filter(JobEvidence.job_id == job_id)
        .order_by(JobEvidence.id.asc())
        .all()
    )
    out: list[EvidenceRow] = []
    for row in rows:
        payload = dict(row.payload or {})
        allowed = cast(list[str], payload.get("allowed_roles") or [])
        if allowed and role not in allowed:
            # chunks carrying ACL metadata are gated strictly (same as the
            # evidence endpoint); legacy rows without any ACL metadata fall
            # back to the job-level visibility check already applied
            continue
        score = payload.get("score")
        out.append(
            EvidenceRow(
                chunk_id=str(payload.get("chunk_id", "")),
                title=str(payload.get("document_title", "")),
                revision=str(payload.get("revision", "")),
                locator=_locator(payload),
                passage=str(payload.get("text", "")),
                score=float(score) if isinstance(score, (int, float)) else 0.0,
            )
        )
    return out


def collect(db: Session, job: Job, role: str) -> ReportData:
    report = dict(job.final_report or {})
    findings = str(report.get("findings", ""))
    confidence = report.get("confidence")
    evidence = evidence_for_role(db, job.id, role)

    contradictions: list[ContradictionRow] = []
    raw_contradictions = cast(list[Any], job.contradictions or [])
    for raw in raw_contradictions:
        c = dict(raw) if isinstance(raw, dict) else {}
        sa = dict(c.get("source_a") or {})
        sb = dict(c.get("source_b") or {})

        def src(d: dict[str, Any]) -> str:
            return f"{d.get('title', '')} {d.get('locator', '')}".strip()

        contradictions.append(
            ContradictionRow(
                topic=str(c.get("topic", "")),
                source_a=src(sa),
                claim_a=str(c.get("claim_a", "")),
                source_b=src(sb),
                claim_b=str(c.get("claim_b", "")),
            )
        )

    equipment = job.equipment_id or "P-204"
    asset_events = [
        {
            "event_type": str(e.event_type or ""),
            "description": str(e.description or ""),
            "source_timestamp": str(e.source_timestamp or ""),
        }
        for e in (
            db.query(AssetEvent)
            .filter(AssetEvent.equipment_id == equipment)
            .order_by(AssetEvent.id.asc())
            .all()
        )
    ]

    approval = (
        db.query(Approval)
        .filter(Approval.job_id == job.id)
        .order_by(Approval.requested_at.desc())
        .first()
    )
    code_run = db.query(CodeRun).filter(CodeRun.job_id == job.id).first()

    return ReportData(
        job_id=job.id,
        objective=str(job.objective or ""),
        equipment_id=equipment,
        status=str(job.status or ""),
        created_at=job.created_at,
        findings=findings,
        confidence=float(confidence) if isinstance(confidence, (int, float)) else 0.0,
        assumptions=[str(a) for a in cast(list[Any], report.get("assumptions") or [])],
        gaps=[str(g) for g in cast(list[Any], report.get("gaps") or [])],
        citations=[dict(c) for c in cast(list[Any], report.get("citations") or [])],
        evidence=evidence,
        contradictions=contradictions,
        asset_events=asset_events,
        recommendation=str(approval.arguments_summary or "") if approval else "",
        recommendation_risk=str(approval.risk_level or "") if approval else "",
        recommendation_action=str(approval.action or "") if approval else "",
        working_code=code_run.code if code_run else None,
        working_code_result=code_run.stdout if code_run else None,
    )


def reports_dir() -> str:
    from pathlib import Path

    path = Path(__file__).resolve().parents[2] / "storage" / "reports"
    path.mkdir(parents=True, exist_ok=True)
    return str(path)
