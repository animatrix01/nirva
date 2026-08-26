"""Tests for hierarchy-preserving structural chunking."""

from nirva_retrieval.chunking import (
    ParsedDocument,
    SectionNode,
    chunk_document,
)
from nirva_retrieval.metadata import sha256_hex


def _document() -> ParsedDocument:
    root = SectionNode(
        title="P-204 OEM Manual",
        page=1,
        children=[
            SectionNode(title="4 Maintenance", page=10),
            SectionNode(
                title="4.2 Seal Replacement",
                page=12,
                text="Replace the mechanical seal every 8000 operating hours.\n\n"
                "Torque the gland bolts to 40 Nm in a star pattern.",
            ),
            SectionNode(
                title="4.3 Bearing Checks",
                page=15,
                text="Inspect bearings for pitting at each seal service.",
            ),
        ],
    )
    return ParsedDocument(
        document_id="doc-1",
        document_title="P-204 OEM Manual",
        document_type="manual",
        revision="B",
        effective_date="2025-03-01",
        department="rotating_equipment",
        equipment_id="P-204",
        confidentiality_level="internal",
        allowed_roles=["engineer", "supervisor"],
        root=root,
    )


def test_chunks_preserve_full_section_path() -> None:
    chunks = chunk_document(_document())
    sections = [c.metadata.section for c in chunks]
    assert "P-204 OEM Manual > 4.2 Seal Replacement" in sections
    assert "P-204 OEM Manual > 4 Maintenance" not in sections or any(
        c.text for c in chunks if c.metadata.section.endswith("4 Maintenance")
    )


def test_chunks_carry_complete_acl_metadata_from_document() -> None:
    chunks = chunk_document(_document())
    assert chunks
    for chunk in chunks:
        meta = chunk.metadata
        assert meta.document_title == "P-204 OEM Manual"
        assert meta.allowed_roles == ["engineer", "supervisor"]
        assert meta.department == "rotating_equipment"
        assert meta.revision == "B"
        assert meta.content_hash == sha256_hex(chunk.text.encode("utf-8"))


def test_pages_recorded_for_viewer_jump() -> None:
    chunks = chunk_document(_document())
    by_section = {c.metadata.section: c for c in chunks}
    assert by_section["P-204 OEM Manual > 4.2 Seal Replacement"].metadata.page == 12
    assert by_section["P-204 OEM Manual > 4.3 Bearing Checks"].metadata.page == 15


def test_chunk_ids_are_stable_and_unique() -> None:
    first = chunk_document(_document())
    second = chunk_document(_document())
    ids_a = [c.metadata.chunk_id for c in first]
    ids_b = [c.metadata.chunk_id for c in second]
    assert ids_a == ids_b
    assert len(set(ids_a)) == len(ids_a)


def test_oversized_sections_split_on_paragraph_boundaries() -> None:
    doc = _document()
    long_text = "\n\n".join(f"Paragraph {i}: " + "x" * 120 for i in range(20))
    doc.root.children[1].text = long_text
    chunks = chunk_document(doc, max_chars=400)
    seal = [c for c in chunks if "4.2" in c.metadata.section]
    assert len(seal) >= 2
    for chunk in seal:
        assert len(chunk.text) <= 400


def test_empty_sections_produce_no_chunks() -> None:
    doc = _document()
    doc.root.children[0].text = ""
    chunks = chunk_document(doc)
    assert all("4 Maintenance >" not in c.metadata.section for c in chunks)
    assert any(c.metadata.section.endswith("4.2 Seal Replacement") for c in chunks)
