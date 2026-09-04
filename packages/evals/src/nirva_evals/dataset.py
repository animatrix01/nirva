"""Golden dataset loader + validation (Winning Plan §14 minimum set: 105 cases).

Case schema:
  case_id        unique id
  category       factual | part_number | synthesis | abstention |
                 contradiction | permission | injection | approval_flow | recovery
  question       the investigation objective
  role           role the case runs as
  expected_docs  document titles that MUST appear in the retrieved evidence
                 (empty for abstention/injection cases)
  expect         cite | abstain | blocked   (the behavior under test)

The dataset is validated at load: 105 cases, every category present in the
Winning Plan §14 counts, unique ids, expected docs non-empty for cite cases.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, field_validator

EXPECTED_COUNTS: dict[str, int] = {
    "factual": 30,
    "part_number": 15,
    "synthesis": 10,
    "abstention": 10,
    "contradiction": 10,
    "permission": 10,
    "injection": 10,
    "approval_flow": 5,
    "recovery": 5,
}

CATEGORY_BEHAVIOR: dict[str, Literal["cite", "abstain", "blocked"]] = {
    "factual": "cite",
    "part_number": "cite",
    "synthesis": "cite",
    "abstention": "abstain",
    "contradiction": "cite",
    "permission": "abstain",
    "injection": "blocked",
    "approval_flow": "cite",
    "recovery": "cite",
}


class EvalCase(BaseModel):
    case_id: str
    category: str
    question: str
    role: str = "engineer"
    expected_docs: list[str] = Field(default_factory=list)
    expect: Literal["cite", "abstain", "blocked"]

    @field_validator("question")
    @classmethod
    def question_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("question must not be empty")
        return v


def load_dataset(path: Path) -> list[EvalCase]:
    """Load + validate the golden dataset. Raises ValueError on any violation."""
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or "cases" not in data:
        raise ValueError("dataset must be an object with a 'cases' array")
    cases = [EvalCase.model_validate(c) for c in data["cases"]]

    if len(cases) != 105:
        raise ValueError(f"dataset must contain exactly 105 cases, got {len(cases)}")

    ids = [c.case_id for c in cases]
    if len(set(ids)) != len(ids):
        raise ValueError("duplicate case_id in dataset")

    counts: dict[str, int] = {}
    for c in cases:
        counts[c.category] = counts.get(c.category, 0) + 1
    for category, expected in EXPECTED_COUNTS.items():
        if counts.get(category, 0) != expected:
            raise ValueError(
                f"category '{category}' must have {expected} cases, got {counts.get(category, 0)}"
            )

    for c in cases:
        behavior = CATEGORY_BEHAVIOR[c.category]
        if c.expect != behavior:
            raise ValueError(
                f"case {c.case_id}: category '{c.category}' requires expect='{behavior}'"
            )
        if behavior == "cite" and not c.expected_docs:
            raise ValueError(f"case {c.case_id}: cite cases must list expected_docs")

    return cases


def dataset_version(path: Path) -> str:
    """Deterministic dataset version from content hash (sorted keys)."""
    import hashlib

    raw = path.read_bytes()
    return hashlib.sha256(raw).hexdigest()[:12]
