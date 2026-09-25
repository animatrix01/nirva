"""XLSX exporter (E2): workbook with numbered evidence sheets.

1_Summary (with live formula steps) / 2_Evidence / 3_Citations /
4_Contradictions / 7_Asset History / 9_WorkingCode (E3 populates when a
code artifact exists; header-only otherwise).
"""

from __future__ import annotations

import openpyxl  # type: ignore[import-untyped]
from app.exporters.report_data import ReportData
from openpyxl.styles import Font  # type: ignore[import-untyped]
from openpyxl.workbook import Workbook  # type: ignore[import-untyped]
from openpyxl.worksheet.worksheet import Worksheet  # type: ignore[import-untyped]

BOLD = Font(bold=True, size=12)


def _header(sheet: Worksheet, headers: list[str]) -> None:
    for col, name in enumerate(headers, start=1):
        cell = sheet.cell(row=1, column=col, value=name)
        cell.font = BOLD
    sheet.sheet_view.showGridLines = True


def _sheet_summary(wb: Workbook, data: ReportData) -> None:
    sheet = wb.active
    sheet.title = "1_Summary"
    _header(sheet, ["Field", "Value"])
    rows = [
        ("Equipment", data.equipment_id),
        ("Objective", data.objective[:300]),
        ("Status", data.status),
        ("Confidence (reported)", data.confidence),
        ("Sources (counted)", len(data.evidence)),
        ("Contradictions", len(data.contradictions)),
    ]
    for idx, (field, value) in enumerate(rows, start=2):
        sheet.cell(row=idx, column=1, value=field)
        sheet.cell(row=idx, column=2, value=value)
    # calculation steps shown as live formulas over the sibling sheets
    base = len(rows) + 3
    sheet.cell(row=base, column=1, value="CALCULATIONS (live formulas)").font = BOLD
    sheet.cell(row=base + 1, column=1, value="Sources in 2_Evidence")
    sheet.cell(row=base + 1, column=2, value="=COUNTA('2_Evidence'!A2:A200)")
    sheet.cell(row=base + 2, column=1, value="Mean retrieval score")
    sheet.cell(row=base + 2, column=2, value="=AVERAGE('2_Evidence'!F2:F200)")
    sheet.cell(row=base + 3, column=1, value="Confidence %")
    sheet.cell(row=base + 3, column=2, value="=B5*100")
    sheet.column_dimensions["A"].width = 28
    sheet.column_dimensions["B"].width = 60


def _sheet_evidence(wb: Workbook, data: ReportData) -> None:
    sheet = wb.create_sheet("2_Evidence")
    _header(sheet, ["No", "Title", "Page/Locator", "Passage", "Revision", "Score"])
    for idx, item in enumerate(data.evidence, start=1):
        sheet.cell(row=idx + 1, column=1, value=idx)
        sheet.cell(row=idx + 1, column=2, value=item.title)
        sheet.cell(row=idx + 1, column=3, value=item.locator)
        sheet.cell(row=idx + 1, column=4, value=item.passage[:500])
        sheet.cell(row=idx + 1, column=5, value=item.revision)
        sheet.cell(row=idx + 1, column=6, value=item.score)
    sheet.column_dimensions["B"].width = 34
    sheet.column_dimensions["C"].width = 18
    sheet.column_dimensions["D"].width = 80


def _sheet_citations(wb: Workbook, data: ReportData) -> None:
    sheet = wb.create_sheet("3_Citations")
    _header(sheet, ["No", "Title", "Revision", "Locator", "Chunk ID"])
    for idx, citation in enumerate(data.citations, start=1):
        sheet.cell(row=idx + 1, column=1, value=idx)
        sheet.cell(row=idx + 1, column=2, value=str(citation.get("title", "")))
        sheet.cell(row=idx + 1, column=3, value=str(citation.get("revision", "")))
        sheet.cell(row=idx + 1, column=4, value=str(citation.get("locator", "")))
        sheet.cell(row=idx + 1, column=5, value=str(citation.get("chunk_id", "")))
    sheet.column_dimensions["B"].width = 34
    sheet.column_dimensions["D"].width = 18


def _sheet_contradictions(wb: Workbook, data: ReportData) -> None:
    sheet = wb.create_sheet("4_Contradictions")
    _header(sheet, ["Topic", "Source A", "Claim A", "Source B", "Claim B"])
    for idx, row in enumerate(data.contradictions, start=1):
        sheet.cell(row=idx + 1, column=1, value=row.topic)
        sheet.cell(row=idx + 1, column=2, value=row.source_a)
        sheet.cell(row=idx + 1, column=3, value=row.claim_a[:400])
        sheet.cell(row=idx + 1, column=4, value=row.source_b)
        sheet.cell(row=idx + 1, column=5, value=row.claim_b[:400])
    for col in ("A", "B", "C", "D", "E"):
        sheet.column_dimensions[col].width = 30


def _sheet_asset_history(wb: Workbook, data: ReportData) -> None:
    sheet = wb.create_sheet("7_Asset History")
    _header(sheet, ["Event type", "Description", "Source timestamp"])
    for idx, event in enumerate(data.asset_events, start=1):
        sheet.cell(row=idx + 1, column=1, value=event["event_type"])
        sheet.cell(row=idx + 1, column=2, value=event["description"][:300])
        sheet.cell(row=idx + 1, column=3, value=event["source_timestamp"])
    sheet.column_dimensions["B"].width = 60


def _sheet_working_code(wb: Workbook, code: str | None, result: str | None) -> None:
    sheet = wb.create_sheet("9_WorkingCode")
    _header(sheet, ["Code", "Result"])
    if code:
        sheet.cell(row=2, column=1, value=code[:2000])
        sheet.cell(row=2, column=2, value=(result or "")[:1000])
    else:
        sheet.cell(row=2, column=1, value="No code run recorded for this job yet.")
    sheet.column_dimensions["A"].width = 70
    sheet.column_dimensions["B"].width = 50


def build_xlsx(data: ReportData, out_path: str, *, code: str | None = None, result: str | None = None) -> str:
    wb = openpyxl.Workbook()
    _sheet_summary(wb, data)
    _sheet_evidence(wb, data)
    _sheet_citations(wb, data)
    _sheet_contradictions(wb, data)
    _sheet_asset_history(wb, data)
    _sheet_working_code(wb, code, result)
    wb.save(out_path)
    return out_path
