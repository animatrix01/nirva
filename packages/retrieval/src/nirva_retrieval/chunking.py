"""Hierarchy-preserving structural chunking.

Input is a parsed document tree (sections carrying pages and text); output is
flat chunks whose metadata.section preserves the full hierarchical path
(e.g. "4 Maintenance > 4.2 Seal Replacement"). Oversized sections split on
paragraph boundaries without breaking the hierarchy path.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from nirva_retrieval.metadata import Chunk, ChunkMetadata, sha256_hex

__all__ = ["Chunk", "ParsedDocument", "SectionNode", "chunk_document"]

DEFAULT_MAX_CHARS = 1600


@dataclass
class SectionNode:
    """One node of the parsed document tree."""

    title: str
    page: int | None = None
    text: str = ""
    children: list[SectionNode] = field(default_factory=list)


@dataclass
class ParsedDocument:
    """Docling-agnostic parse result handed to the chunker."""

    document_id: str
    document_title: str
    document_type: str
    revision: str
    effective_date: str
    department: str
    equipment_id: str | None
    confidentiality_level: str
    allowed_roles: list[str]
    root: SectionNode


def _split_text(text: str, max_chars: int) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    paragraphs = text.split("\n\n")
    parts: list[str] = []
    current: list[str] = []
    length = 0
    for paragraph in paragraphs:
        para = paragraph.strip()
        if not para:
            continue
        if length + len(para) + 2 > max_chars and current:
            parts.append("\n\n".join(current))
            current, length = [], 0
        current.append(para)
        length += len(para) + 2
    if current:
        parts.append("\n\n".join(current))
    return parts or [text[:max_chars]]


def _walk(
    node: SectionNode,
    path: list[str],
    base: dict[str, object],
    max_chars: int,
) -> list[Chunk]:
    section_path = " > ".join([*path, node.title])
    chunks: list[Chunk] = []

    def emit(text: str, page: int | None) -> None:
        stripped = text.strip()
        if not stripped:
            return
        meta = ChunkMetadata.model_validate(
            {
                **base,
                "section": section_path,
                "page": page,
                "chunk_id": "pending",
                "content_hash": sha256_hex(stripped.encode("utf-8")),
            }
        )
        chunks.append(Chunk(text=stripped, metadata=meta))

    body_page = node.page
    for part in _split_text(node.text, max_chars):
        emit(part, body_page)

    for child in node.children:
        chunks.extend(_walk(child, [*path, node.title], base, max_chars))
    return chunks


def chunk_document(
    document: ParsedDocument,
    *,
    max_chars: int = DEFAULT_MAX_CHARS,
    chunk_id_prefix: str = "chk",
) -> list[Chunk]:
    """Flatten the document tree into citation-ready structural chunks."""
    base: dict[str, object] = {
        "document_id": document.document_id,
        "document_title": document.document_title,
        "document_type": document.document_type,
        "revision": document.revision,
        "effective_date": document.effective_date,
        "department": document.department,
        "equipment_id": document.equipment_id,
        "confidentiality_level": document.confidentiality_level,
        "allowed_roles": document.allowed_roles,
    }
    chunks = _walk(document.root, [], base, max_chars)
    numbered: list[Chunk] = []
    for index, chunk in enumerate(chunks):
        meta = chunk.metadata.model_copy(
            update={
                "chunk_id": f"{chunk_id_prefix}-{document.document_id}-{index:04d}",
            }
        )
        numbered.append(Chunk(text=chunk.text, metadata=meta))
    return numbered
