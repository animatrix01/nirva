"""Tests for the frozen chunk metadata schema (COMMON.md c.4)."""

import pytest
from pydantic import ValidationError

from nirva_retrieval.metadata import ALL_ROLES, ChunkMetadata, sha256_hex

FIELDS = [
    "document_id",
    "document_title",
    "document_type",
    "revision",
    "effective_date",
    "department",
    "equipment_id",
    "confidentiality_level",
    "allowed_roles",
    "page",
    "section",
    "chunk_id",
    "content_hash",
]


def _meta(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "document_id": "doc-1",
        "document_title": "P-204 OEM Manual",
        "document_type": "manual",
        "revision": "B",
        "effective_date": "2025-03-01",
        "department": "rotating_equipment",
        "equipment_id": "P-204",
        "confidentiality_level": "internal",
        "allowed_roles": ["engineer", "safety_officer", "supervisor", "admin"],
        "page": 12,
        "section": "4 Maintenance > 4.2 Seal Replacement",
        "chunk_id": "chk-doc-1-0007",
        "content_hash": sha256_hex(b"seal text"),
    }
    base.update(overrides)
    return base


def test_metadata_has_exactly_the_13_frozen_fields() -> None:
    assert list(ChunkMetadata.model_fields) == FIELDS


def test_valid_metadata_round_trips() -> None:
    meta = ChunkMetadata.model_validate(_meta())
    assert meta.equipment_id == "P-204"
    assert set(meta.allowed_roles) == ALL_ROLES


def test_every_field_is_required_except_page_and_equipment() -> None:
    required = {name for name, f in ChunkMetadata.model_fields.items() if f.is_required()}
    assert required == {"document_id", "document_title", "document_type", "revision",
                        "effective_date", "department", "confidentiality_level",
                        "allowed_roles", "section", "chunk_id", "content_hash"}


def test_missing_any_required_field_rejected() -> None:
    for field in FIELDS:
        payload = _meta()
        if field in ("page", "equipment_id"):
            continue
        del payload[field]
        with pytest.raises(ValidationError):
            ChunkMetadata.model_validate(payload)


def test_unknown_role_rejected_zero_tolerance() -> None:
    with pytest.raises(ValidationError, match="Input should be"):
        ChunkMetadata.model_validate(_meta(allowed_roles=["engineer", "contractor"]))


def test_duplicate_roles_rejected() -> None:
    with pytest.raises(ValidationError, match="duplicates"):
        ChunkMetadata.model_validate(_meta(allowed_roles=["engineer", "engineer"]))


def test_empty_allowed_roles_rejected_never_unprotected_chunk() -> None:
    with pytest.raises(ValidationError):
        ChunkMetadata.model_validate(_meta(allowed_roles=[]))


def test_content_hash_must_be_sha256_hex() -> None:
    with pytest.raises(ValidationError):
        ChunkMetadata.model_validate(_meta(content_hash="not-a-hash"))
    with pytest.raises(ValidationError):
        ChunkMetadata.model_validate(_meta(content_hash=sha256_hex(b"x").upper()))


def test_document_type_constrained_to_contract_values() -> None:
    for doc_type in ("manual", "sop", "work_order", "incident", "data"):
        assert ChunkMetadata.model_validate(_meta(document_type=doc_type))
    with pytest.raises(ValidationError):
        ChunkMetadata.model_validate(_meta(document_type="blog"))
