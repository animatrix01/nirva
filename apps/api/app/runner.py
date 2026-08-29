import threading
import uuid

from sqlalchemy.orm import Session

from app import graph_client
from app.db import SessionLocal
from app.events import emit_event
from app.graph_client import GraphRunContext
from app.models import Job, User, utcnow


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
            emit=emit,
            set_report=set_report,
        )
        graph = graph_client.get_graph()
        try:
            graph.run(ctx)
        except Exception as exc:
            failing_node = getattr(exc, "node", failing_node)
            raise
        job = db.get(Job, job_id)
        if job is not None:
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
