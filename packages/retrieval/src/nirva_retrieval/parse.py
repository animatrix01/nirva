"""Docling-backed parsing into ParsedDocument trees (Phase 2, demo plan §6).

PDFs: Docling extracts text per page; each page becomes a child SectionNode so
chunk metadata keeps an exact page locator for citations. CSVs become one child
SectionNode per record row, giving row-precise citations (crucial for the
work-order contradiction demo). PDF parsing via Docling is the plan's mandated
local parser (layout + OCR); OCR runs only when a page yields no embedded text.
"""

from __future__ import annotations

import csv
from pathlib import Path

from nirva_retrieval.chunking import ParsedDocument, SectionNode

__all__ = ["parse_pdf", "parse_csv"]


def _docling_pages(path: Path) -> list[tuple[int, str]]:
    from docling.document_converter import DocumentConverter

    converter = DocumentConverter()
    result = converter.convert(str(path))
    doc = result.document
    page_texts: dict[int, list[str]] = {}
    for item, _level in doc.iterate_items():
        prov = getattr(item, "prov", None)
        page_no = int(prov[0].page_no) if prov else 1
        text = getattr(item, "text", None)
        if isinstance(text, str) and text.strip():
            page_texts.setdefault(page_no, []).append(text.strip())
    if not page_texts:
        plain = doc.export_to_text()
        return [(1, plain)] if plain.strip() else []
    return [(page, "\n\n".join(items)) for page, items in sorted(page_texts.items())]


def _pypdf_pages(path: Path) -> list[tuple[int, str]]:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    pages: list[tuple[int, str]] = []
    for index, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            pages.append((index, text))
    return pages


def parse_pdf(path: Path, base: dict[str, object]) -> ParsedDocument:
    """Parse a PDF with Docling (fallback: pypdf for trivial text-only PDFs)."""
    title = str(base["document_title"])
    try:
        pages = _docling_pages(path)
    except Exception:
        pages = _pypdf_pages(path)
    children = [SectionNode(title=f"Page {page}", page=page, text=text) for page, text in pages]
    root = SectionNode(title=title, children=children)
    return ParsedDocument(root=root, **base)  # type: ignore[arg-type]


def parse_csv(path: Path, base: dict[str, object]) -> ParsedDocument:
    """Parse a CSV into one SectionNode per record (row-precise citations)."""
    title = str(base["document_title"])
    children: list[SectionNode] = []
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for index, row in enumerate(reader, start=1):
            lines = [f"{key}: {value}" for key, value in row.items() if value]
            children.append(
                SectionNode(
                    title=f"Record {index:03d}",
                    page=None,
                    text="\n".join(lines),
                )
            )
    root = SectionNode(title=title, children=children)
    return ParsedDocument(root=root, **base)  # type: ignore[arg-type]
