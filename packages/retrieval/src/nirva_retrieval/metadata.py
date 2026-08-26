"""Chunk metadata schema (COMMON.md c.4) — ALL fields mandatory before Qdrant."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

RoleName = Literal["engineer", "safety_officer", "supervisor", "admin"]

ALL_ROLES: frozenset[str] = frozenset(
    {"engineer", "safety_officer", "supervisor", "admin"}
)

DocumentType = Literal["manual", "sop", "work_order", "incident", "data"]


__all__ = ["ALL_ROLES", "Chunk", "ChunkMetadata", "sha256_hex"]


class ChunkMetadata(BaseModel):
    """Every indexed chunk carries ALL frozen fields BEFORE entering Qdrant.

    ``allowed_roles`` is THE ACL field: it must be enforced INSIDE the Qdrant
    query filter, never applied after retrieval.
    """

    document_id: str = Field(min_length=1)
    document_title: str = Field(min_length=1)
    document_type: DocumentType
    revision: str = Field(min_length=1)
    effective_date: str = Field(min_length=8)
    department: str = Field(min_length=1)
    equipment_id: str | None = None
    confidentiality_level: str = Field(min_length=1)
    allowed_roles: list[RoleName] = Field(min_length=1)
    page: int | None = Field(default=None, ge=1)
    section: str = Field(min_length=1)
    chunk_id: str = Field(min_length=1)
    content_hash: str = Field(min_length=64, max_length=64)

    @field_validator("allowed_roles")
    @classmethod
    def _roles_must_be_known_and_unique(
        cls, value: list[RoleName]
    ) -> list[RoleName]:
        if len(set(value)) != len(value):
            raise ValueError("allowed_roles contains duplicates")
        unknown = set(value) - ALL_ROLES
        if unknown:
            raise ValueError(f"unknown roles in allowed_roles: {sorted(unknown)}")
        return value

    @field_validator("content_hash")
    @classmethod
    def _hash_must_be_sha256_hex(cls, value: str) -> str:
        if value != value.lower():
            raise ValueError("content_hash must be lowercase hex")
        try:
            bytes.fromhex(value)
        except ValueError as exc:
            raise ValueError("content_hash must be sha256 hex") from exc
        return value


class Chunk(BaseModel):
    """A structural chunk plus its complete metadata and raw text."""

    text: str = Field(min_length=1)
    metadata: ChunkMetadata


def sha256_hex(payload: bytes) -> str:
    """Content hash used for dedup (document level) and provenance (chunk level)."""
    import hashlib

    return hashlib.sha256(payload).hexdigest()
