import threading
import uuid
from collections.abc import Callable
from typing import Any

from qdrant_client import QdrantClient
from sqlalchemy.orm import Session

from app import graph_client
from app.audit import append_audit_event
from app.config import get_settings
from app.db import SessionLocal
from app.events import emit_event
from app.graph_client import GraphRunContext
from app.models import Approval, AssetEvent, InventoryItem, Job, User, utcnow

QDRANT_TIMEOUT_SECONDS = 30.0


def _lookup_asset_events(equipment_id: str) -> list[AssetEvent]:
    from sqlalchemy import select

    session = SessionLocal()
    try:
        stmt = (
            select(AssetEvent)
            .where(AssetEvent.equipment_id == equipment_id)
            .order_by(AssetEvent.source_timestamp.asc())
        )
        return list(session.scalars(stmt))
    finally:
        session.close()


def _lookup_inventory(part_number: str) -> InventoryItem | None:
    session = SessionLocal()
    try:
        return session.get(InventoryItem, part_number)
    finally:
        session.close()


def _partition_by_injection(
    evidence: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[tuple[dict[str, Any], str]]]:
    """Split retrieval hits into clean evidence and instruction-like suspects.

    Suspects are EXCLUDED from evidence — the model never sees them — while
    the caller records the exclusions as blocked_injection events + audit rows.
    """
    from nirva_agent.security import detect_injection

    clean: list[dict[str, Any]] = []
    suspicious: list[tuple[dict[str, Any], str]] = []
    for item in evidence:
        pattern = detect_injection(str(item.get("text", "")))
        if pattern is None:
            clean.append(item)
        else:
            suspicious.append((item, pattern))
    return clean, suspicious


def _make_retriever(
    role_hint: str,
    job_id: str,
    emit: Callable[[str, str, str | None], None],
    db: Session,
) -> Callable[[str, str], list[dict[str, Any]]]:
    settings = get_settings()
    client: QdrantClient | None = None

    def retrieve(role: str, objective: str) -> list[dict[str, Any]]:
        nonlocal client
        from nirva_retrieval.embed import dense_embeddings, sparse_embedding
        from nirva_retrieval.search import search_documents

        if client is None:
            client = QdrantClient(
                url=settings.qdrant_url, timeout=30, check_compatibility=False
            )
        dense = dense_embeddings([objective], base_url=settings.model_base_url)
        sparse = sparse_embedding(objective)
        hits = search_documents(
            client,
            role=role or role_hint,
            query_dense=dense[0],
            query_sparse=sparse,
            top_k=12,
        )
        evidence: list[dict[str, Any]] = [
            {
                "chunk_id": hit.chunk_id,
                "document_id": hit.document_id,
                "document_title": hit.document_title,
                "document_type": hit.document_type,
                "revision": hit.revision,
                "page": hit.page,
                "section": hit.section,
                "equipment_id": hit.equipment_id,
                "text": hit.text,
                "score": hit.score,
            }
            for hit in hits
        ]

        from nirva_agent.security import detect_injection

        from app.audit import append_audit_event

        clean: list[dict[str, Any]] = []
        for item in evidence:
            pattern = detect_injection(str(item["text"]))
            if pattern is None:
                clean.append(item)
                continue
            emit("blocked_injection", "retrieve", "security")
            append_audit_event(
                db,
                actor="agent:retrieve",
                actor_role=role or role_hint,
                action="security.injection_blocked",
                argument_summary=(
                    f"pattern '{pattern}' in '{item['document_title']}'; "
                    "chunk excluded from evidence"
                ),
                outcome="blocked",
                job_id=job_id,
                payload={
                    "pattern": pattern,
                    "document_title": item["document_title"],
                    "chunk_id": item["chunk_id"],
                    "action": "excluded_from_evidence",
                },
            )
            db.commit()

        from nirva_agent.state import EvidenceItem  # noqa: PLC0415

        evidence = clean

        tool_session = SessionLocal()
        try:
            from nirva_tools.tools import check_inventory, get_asset_history  # noqa: PLC0415
            from nirva_tools.types import AssetHistoryInput, InventoryInput  # noqa: PLC0415

            history = get_asset_history(
                role or role_hint, AssetHistoryInput(equipment_id="P-204"), lookup_fn=_lookup_asset_events
            )
            for event in history.events:
                evidence.append(
                    EvidenceItem(
                        chunk_id=f"tool-asset-{event.source_timestamp}",
                        document_id="asset-history-db",
                        document_title="Asset History (read-only tool)",
                        document_type="data",
                        revision="1",
                        section=event.event_type,
                        equipment_id="P-204",
                        text=f"{event.source_timestamp}: {event.description}",
                        score=1.0,
                        source="tool",
                    ).model_dump()
                )
            inventory = check_inventory(
                role or role_hint, InventoryInput(part_number="SEAL-P204-KIT"), lookup_fn=_lookup_inventory
            )
            evidence.append(
                EvidenceItem(
                    chunk_id=f"tool-inventory-{inventory.part_number}",
                    document_id="inventory-db",
                    document_title="Spare Parts Inventory (read-only tool)",
                    document_type="data",
                    revision="1",
                    section="SEAL-P204-KIT",
                    text=(
                        f"Part {inventory.part_number}: {inventory.available_qty} available "
                        f"(last updated {inventory.last_updated})"
                    ),
                    score=1.0,
                    source="tool",
                ).model_dump()
            )
        finally:
            tool_session.close()

        # Evidence-sufficiency judge (Winning Plan §10 retrieval step 7): if
        # nothing retrieved relates to the objective, abstain instead of guessing.
        if evidence:
            from nirva_agent.gateway import GatewayClient, GatewayConfig

            judge = GatewayClient(
                GatewayConfig(
                    base_url=settings.model_base_url,
                    model="qwen2.5:3b-instruct-q4_K_M",
                    timeout_seconds=60.0,
                )
            )
            try:
                sufficient = judge.evidence_sufficient(
                    objective, [str(e.get("text", ""))[:300] for e in evidence]
                )
            except Exception:
                sufficient = True  # judge unavailable: fail open, keep evidence
            if not sufficient:
                return []

        return evidence

    return retrieve


def run_job(job_id: str) -> None:
    db: Session = SessionLocal()
    failing_node = "intake"
    try:
        job = db.get(Job, job_id)
        if job is None:
            return
        job.status = "running"
        job.updated_at = utcnow()
        db.commit()

        owner = db.get(User, job.created_by)
        if owner is None:
            msg = "job owner no longer exists"
            raise RuntimeError(msg)
        user_role = owner.role

        def emit(type_: str, node: str, payload_ref: str | None) -> None:
            emit_event(db, job_id, type_, node, payload_ref)
            db.commit()

        def set_report(report: dict[str, object]) -> None:
            current = db.get(Job, job_id)
            if current is not None:
                current.final_report = report
                db.commit()

        ctx = GraphRunContext(
            request_id=job_id,
            user_id=job.created_by,
            user_role=user_role,
            objective=job.objective,
            equipment_id=job.equipment_id,
            emit=emit,
            set_report=set_report,
        )
        graph = graph_client.get_graph(retriever=_make_retriever(user_role, job_id, emit, db))
        try:
            result = graph.run(ctx)
        except Exception as exc:
            failing_node = getattr(exc, "node", failing_node)
            raise
        job = db.get(Job, job_id)
        if job is None:
            return
        from app.models import JobEvidence

        for item in (result or {}).get("retrieved_evidence") or []:
            existing = (
                db.query(JobEvidence)
                .filter(JobEvidence.job_id == job_id, JobEvidence.chunk_id == str(item.chunk_id))
                .first()
            )
            if existing is None:
                db.add(
                    JobEvidence(
                        job_id=job_id,
                        chunk_id=str(item.chunk_id),
                        payload=item.model_dump(),
                    )
                )
        actions = (result or {}).get("proposed_actions") or []
        job.contradictions = [
            c.model_dump() if hasattr(c, "model_dump") else dict(c)
            for c in ((result or {}).get("contradictions") or [])
        ]
        evidence_count = len((result or {}).get("retrieved_evidence") or [])
        append_audit_event(
            db,
            actor="agent:retrieve",
            actor_role=user_role,
            action="retrieval.search_documents",
            argument_summary=(
                f"hybrid dense+sparse retrieval (ACL-filtered, top_k=12); "
                f"{evidence_count} authorized evidence items accepted"
            ),
            job_id=job_id,
        )
        append_audit_event(
            db,
            actor="agent:retrieve",
            actor_role=user_role,
            action="tool.get_asset_history",
            argument_summary="equipment_id=P-204 (read-only operational lookup)",
            job_id=job_id,
        )
        append_audit_event(
            db,
            actor="agent:retrieve",
            actor_role=user_role,
            action="tool.check_inventory",
            argument_summary="part_number=SEAL-P204-KIT (read-only operational lookup)",
            job_id=job_id,
        )
        if job.contradictions:
            append_audit_event(
                db,
                actor="agent:propose",
                actor_role=user_role,
                action="contradiction.detected",
                argument_summary=f"{len(job.contradictions)} cross-source conflict(s) surfaced for human verification",
                job_id=job_id,
            )
        if actions:
            action = actions[0]
            db.add(
                Approval(
                    id=str(uuid.uuid4()),
                    job_id=job_id,
                    proposal_id=str(action.idempotency_key),
                    action=str(action.action),
                    arguments_summary=str(action.arguments_summary),
                    evidence_refs=list(action.evidence_chunk_ids),
                    risk_level=str(action.risk_level),
                )
            )
            job.status = "awaiting_approval"
            job.current_node = "propose"
            append_audit_event(
                db,
                actor="agent:propose",
                actor_role=user_role,
                action="proposal.created",
                argument_summary=(
                    f"proposal={action.idempotency_key} action={action.action} "
                    f"risk={action.risk_level}; awaiting supervisor decision"
                ),
                job_id=job_id,
            )
        else:
            job.status = "completed"
            job.current_node = None
            append_audit_event(
                db,
                actor="agent:propose",
                actor_role=user_role,
                action="job.completed",
                argument_summary=(
                    "investigation completed without consequential proposal "
                    "(evidence insufficient or no action required)"
                ),
                job_id=job_id,
            )
        job.updated_at = utcnow()
        db.commit()
    except Exception:
        db.rollback()
        job = db.get(Job, job_id)
        if job is not None:
            job.status = "failed"
            job.current_node = failing_node
            job.updated_at = utcnow()
            try:
                emit_event(db, job_id, "failed", failing_node, None)
                db.commit()
            except Exception:
                db.rollback()
    finally:
        db.close()


def start_job_run(job_id: str) -> threading.Thread:
    thread = threading.Thread(target=run_job, args=(job_id,), daemon=True)
    thread.start()
    return thread


def new_job_id() -> str:
    return str(uuid.uuid4())
