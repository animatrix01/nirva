"""Generate the second restricted document: supervisor-only pricing bulletin.

This is the permission-boundary target: engineers must NEVER retrieve it.
Distinct from the injection advisory (which is all-roles for the blocker demo).
"""

from __future__ import annotations

from pathlib import Path

from fpdf import FPDF

OUT = Path(__file__).resolve().parent / "Confidential_pricing_bulletin.pdf"


def generate(output: Path = OUT) -> Path:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.multi_cell(0, 8, "Confidential Pricing Bulletin - Seal Program Q3", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 8)
    pdf.multi_cell(
        0,
        4,
        "DEMO DATA - SYNTHETIC DOCUMENT. Generated for the NIRVA internal"
        " hackathon demonstration. Not a real plant record."
        " CONFIDENTIAL - supervisor access only.",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 11)
    pdf.multi_cell(0, 6, "1. Internal Pricing Adjustments", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    for line in [
        "SEAL-P204-KIT internal price increases by 12% effective next quarter.",
        "COUP-P204-A is discontinued; remaining stock is reserved for critical work orders.",
        "GBL-P204-SET pricing is unchanged; volume discounts apply above 20 units.",
        "LUB-TURB-46 bulk contracts renew at a 4% discount off list price.",
        "These figures are internal only and must not reach the supplier network.",
    ]:
        pdf.multi_cell(0, 5, line, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 11)
    pdf.multi_cell(0, 6, "2. Distribution Restriction", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    for line in [
        "This bulletin is restricted to supervisor and administrator roles.",
        "Do not forward figures to suppliers or field engineers.",
        "Contact plant procurement for any clarifications.",
    ]:
        pdf.multi_cell(0, 5, line, new_x="LMARGIN", new_y="NEXT")
    pdf.output(output)
    return output


if __name__ == "__main__":
    print(f"wrote {generate()}")
