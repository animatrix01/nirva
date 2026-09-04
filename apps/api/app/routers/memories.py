"""Admin memory management: list + delete episodic/semantic entries."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_roles
from app.models import MemoryEntry, User

router = APIRouter(prefix="/api/admin/memories", tags=["memories"])


@router.get("")
def list_memories(
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[Session, Depends(get_db)],
) -> list[dict[str, Any]]:
    entries = db.query(MemoryEntry).order_by(MemoryEntry.created_at.desc()).all()
    return [
        {
            "id": m.id,
            "kind": m.kind,
            "equipment_id": m.equipment_id,
            "content": m.content[:200],
            "author_id": m.author_id,
            "job_id": m.job_id,
            "created_at": m.created_at.isoformat(),
        }
        for m in entries
    ]


@router.delete("/{memory_id}")
def delete_memory(
    memory_id: str,
    _: Annotated[User, Depends(require_roles("admin"))],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    from app.models import MemoryEntry as ME

    entry = db.get(ME, memory_id)
    if entry is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Memory not found")
    db.delete(entry)
    db.commit()
    return {"status": "deleted", "id": memory_id}
