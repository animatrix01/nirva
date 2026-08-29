import threading
import uuid
from collections.abc import Callable
from typing import Any

from qdrant_client import QdrantClient
from sqlalchemy.orm import Session

from app import graph_client
from app.config import get_settings
from app.db import SessionLocal
from app.events import emit_event
from app.graph_client import GraphRunContext
from app.models import Approval, Job, User, utcnow

QDRANT_TIMEOUT_SECONDS = 30.0


def _make_retriever(role_hint: str) -> Callable[[str, str], list[dict[str, Any]]]:
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
            top_k=5,
        )
        return [
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
        graph = graph_client.get_graph(retriever=_make_retriever(user_role))
        try:
            result = graph.run(ctx)
        except Exception as exc:
            failing_node = getattr(exc, "node", failing_node)
            raise
        job = db.get(Job, job_id)
        if job is None:
            return
        actions = (result or {}).get("proposed_actions") or []
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
        else:
            job.status = "completed"
            job.current_node = None
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
