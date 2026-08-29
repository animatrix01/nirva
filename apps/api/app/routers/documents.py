"""Document ingestion + library endpoints (Phase 2, frozen contract §c.1).

Upload flow: hash dedup -> quarantine on disk -> Docling parse -> structural
chunking with full §c.4 metadata + ACL -> local embeddings -> Qdrant upsert.
Retrieval-time ACL filtering lives in packages/retrieval.search, never here.
"""

from __future__ import annotations

import hashlib
import uuid
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.deps import CurrentUser
from app.models import Document
from app.schemas import DocumentOut, DocumentUploadResponse

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _document_out(doc: Document) -> DocumentOut:
    return DocumentOut(
        document_id=doc.document_id,
        title=doc.title,
        document_type=doc.document_type,
        revision=doc.revision,
        effective_date=doc.effective_date,
        department=doc.department,
        equipment_id=doc.equipment_id,
        confidentiality_level=doc.confidentiality_level,
        content_hash=doc.content_hash,
        status=doc.status,
        uploaded_at=doc.uploaded_at,
    )


@router.get("", response_model=list[DocumentOut])
def list_documents(user: CurrentUser, db: Annotated[Session, Depends(get_db)]) -> list[DocumentOut]:
    docs = db.query(Document).order_by(Document.uploaded_at.desc()).all()
    return [_document_out(doc) for doc in docs if user.role in (doc.allowed_roles or [])]


def _parse_and_index(path: Path, base: dict[str, Any], role_hint: str) -> int:
    from nirva_agent.vision import VLM_OBSERVATIONS_PROMPT, describe_image
    from nirva_retrieval.chunking import (
        ParsedDocument,
        SectionNode,
        chunk_document,
    )
    from nirva_retrieval.embed import dense_embeddings, sparse_embedding
    from nirva_retrieval.parse import parse_csv, parse_pdf
    from nirva_retrieval.store import ensure_collection, upsert_chunks
    from qdrant_client import QdrantClient, models

    settings = get_settings()
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        parsed = parse_pdf(path, base)
    elif suffix == ".csv":
        parsed = parse_csv(path, base)
    elif suffix in (".jpg", ".jpeg", ".png"):
        observation = describe_image(
            base_url=settings.model_base_url,
            model="qwen2.5vl:3b",
            prompt=VLM_OBSERVATIONS_PROMPT,
            image_bytes=path.read_bytes(),
            image_format="png" if suffix == ".png" else "jpeg",
        )
        parsed = ParsedDocument(
            root=SectionNode(
                title=str(base["document_title"]),
                children=[SectionNode(title="Vision inspection", text=observation)],
            ),
            **base,  # type: ignore[arg-type]
        )
    else:
        msg = f"unsupported document type: {suffix}"
        raise ValueError(msg)
    chunks = chunk_document(parsed, chunk_id_prefix="chk")
    if not chunks:
        return 0
    texts = [chunk.text for chunk in chunks]
    dense = dense_embeddings(texts, base_url=settings.model_base_url)
    vectors = []
    for d, text in zip(dense, texts, strict=True):
        sparse = sparse_embedding(text)
        vectors.append(
            {
                "dense": d,
                "sparse": models.SparseVector(indices=list(sparse.keys()), values=list(sparse.values())),
            }
        )
    client = QdrantClient(url=settings.qdrant_url, timeout=30, check_compatibility=False)
    ensure_collection(client)
    return upsert_chunks(client, chunks, vectors)


UPLOAD_ALLOWED_ROLES = ("engineer", "admin")


@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    file: Annotated[UploadFile, File()],
    title: Annotated[str, Form()],
    document_type: Annotated[str, Form()],
    revision: Annotated[str, Form()],
    effective_date: Annotated[str, Form()],
    department: Annotated[str, Form()],
    confidentiality_level: Annotated[str, Form()] = "internal",
    equipment_id: Annotated[str | None, Form()] = None,
    allowed_roles: Annotated[str | None, Form()] = None,
) -> DocumentUploadResponse:
    if user.role not in UPLOAD_ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Document upload requires engineer or admin role",
        )
    settings = get_settings()
    payload = file.file.read()
    if not payload:
        raise HTTPException(status_code=status.HTTP_422_UNAUTHORIZED, detail="Empty file")
    digest = hashlib.sha256(payload).hexdigest()
    existing = db.query(Document).filter(Document.content_hash == digest).first()
    if existing is not None:
        return DocumentUploadResponse(
            document_id=existing.document_id,
            status=existing.status,
            content_hash=digest,
            duplicate=True,
        )

    roles = (
        [role.strip() for role in allowed_roles.split(",") if role.strip()]
        if allowed_roles
        else ["engineer", "safety_officer", "supervisor", "admin"]
    )
    storage = Path(settings.storage_path) / "documents"
    storage.mkdir(parents=True, exist_ok=True)
    doc_id = f"doc-{uuid.uuid4().hex[:12]}"
    file_path = storage / f"{digest[:16]}{Path(file.filename or 'upload').suffix.lower()}"
    file_path.write_bytes(payload)

    doc = Document(
        document_id=doc_id,
        title=title,
        document_type=document_type,
        revision=revision,
        effective_date=effective_date,
        department=department,
        equipment_id=equipment_id,
        confidentiality_level=confidentiality_level,
        allowed_roles=roles,
        content_hash=digest,
        status="quarantined",
        file_path=str(file_path),
        file_size=len(payload),
        uploaded_by=user.id,
    )
    db.add(doc)
    db.commit()

    base: dict[str, Any] = {
        "document_id": doc_id,
        "document_title": title,
        "document_type": document_type,
        "revision": revision,
        "effective_date": effective_date,
        "department": department,
        "equipment_id": equipment_id,
        "confidentiality_level": confidentiality_level,
        "allowed_roles": roles,
    }
    try:
        indexed = _parse_and_index(file_path, base, user.role)
    except Exception:
        doc.status = "quarantined"
        db.commit()
        raise
    doc.status = "indexed"
    db.commit()
    return DocumentUploadResponse(
        document_id=doc_id, status=doc.status, content_hash=digest, duplicate=False, chunks=indexed
    )


@router.get("/{document_id}/content")
def document_content(
    document_id: str,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if user.role not in (doc.allowed_roles or []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    from qdrant_client import QdrantClient, models

    from app.config import get_settings as _settings

    settings = _settings()
    client = QdrantClient(url=settings.qdrant_url, timeout=30, check_compatibility=False)
    result = client.scroll(
        collection_name="nirva_chunks",
        scroll_filter=models.Filter(
            must=[models.FieldCondition(key="document_id", match=models.MatchValue(value=document_id))]
        ),
        limit=100,
        with_payload=True,
    )
    points, _next = result
    chunks = sorted(
        (
            {
                "chunk_id": p.payload.get("chunk_id"),
                "page": p.payload.get("page"),
                "section": p.payload.get("section"),
                "text": p.payload.get("text"),
            }
            for p in points
            if p.payload
        ),
        key=lambda c: (c["page"] or 0, str(c["chunk_id"])),
    )
    return {
        "document": _document_out(doc).model_dump(mode="json"),
        "chunks": chunks,
    }


@router.get("/{document_id}/file")
def document_file(
    document_id: str,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> FileResponse:
    """Serve the stored original (e.g. image preview in the library)."""
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if user.role not in (doc.allowed_roles or []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    path = Path(doc.file_path)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored file missing")
    media = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
    }.get(path.suffix.lower(), "application/octet-stream")
    return FileResponse(path, media_type=media)
