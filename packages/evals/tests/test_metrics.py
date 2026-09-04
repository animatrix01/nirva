import json
from pathlib import Path
from typing import Any

import pytest

from nirva_evals.dataset import load_dataset
from nirva_evals.metrics import (
    citation_validity,
    correct_abstention_rate,
    grounded_answer_rate,
    injection_block_rate,
    recall_at_k,
    unauthorized_retrieval_count,
)


class TestRecallAtK:
    def test_full_recall(self) -> None:
        assert recall_at_k(["Manual"], ["Manual", "Log"], k=5) == 1.0

    def test_partial_recall(self) -> None:
        assert recall_at_k(["Manual", "Log"], ["Manual"], k=5) == 0.5

    def test_zero_when_nothing_retrieved(self) -> None:
        assert recall_at_k(["Manual"], [], k=5) == 0.0

    def test_none_when_nothing_expected(self) -> None:
        assert recall_at_k([], ["Manual"], k=5) is None

    def test_k_limits_the_window(self) -> None:
        expected = ["a", "b"]
        retrieved = ["a", "x", "x", "x", "x", "b"]  # b is at rank 6, outside k=5
        assert recall_at_k(expected, retrieved, k=5) == 0.5

    def test_case_insensitive(self) -> None:
        assert recall_at_k(["P-204 OEM Manual"], ["p-204 oem manual"], k=1) == 1.0


class TestCitationValidity:
    def test_all_valid(self) -> None:
        assert citation_validity(["Manual"], ["Manual", "Log"]) == 1.0

    def test_fabricated_citation_is_invalid(self) -> None:
        assert citation_validity(["Fabricated"], ["Manual"]) == 0.0

    def test_none_when_no_citations(self) -> None:
        assert citation_validity([], ["Manual"]) is None


class TestRates:
    def test_grounded_rate(self) -> None:
        cases: list[dict[str, Any]] = [
            {"expect": "cite", "findings_present": True, "citations_count": 3},
            {"expect": "cite", "findings_present": True, "citations_count": 0},
        ]
        assert grounded_answer_rate(cases) == 0.5

    def test_abstention_rate_all_correct(self) -> None:
        cases: list[dict[str, Any]] = [
            {"expect": "abstain", "abstained": True},
            {"expect": "abstain", "abstained": True},
        ]
        assert correct_abstention_rate(cases) == 1.0

    def test_abstention_rate_with_guess(self) -> None:
        cases: list[dict[str, Any]] = [
            {"expect": "abstain", "abstained": True},
            {"expect": "abstain", "abstained": False},
        ]
        assert correct_abstention_rate(cases) == 0.5

    def test_unauthorized_count(self) -> None:
        cases: list[dict[str, Any]] = [
            {"unauthorized": False},
            {"unauthorized": True},
        ]
        assert unauthorized_retrieval_count(cases) == 1

    def test_injection_block_rate(self) -> None:
        cases: list[dict[str, Any]] = [
            {"category": "injection", "blocked": True},
            {"category": "injection", "blocked": True},
            {"category": "factual"},
        ]
        assert injection_block_rate(cases) == 1.0


def _full_valid_cases() -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    for i in range(30):
        cases.append({"case_id": f"f-{i}", "category": "factual", "question": f"q{i}", "expected_docs": ["Manual"], "expect": "cite"})
    for i in range(15):
        cases.append({"case_id": f"p-{i}", "category": "part_number", "question": f"q{i}", "expected_docs": ["Manual"], "expect": "cite"})
    for i in range(10):
        cases.append({"case_id": f"s-{i}", "category": "synthesis", "question": f"q{i}", "expected_docs": ["Manual"], "expect": "cite"})
    for i in range(10):
        cases.append({"case_id": f"a-{i}", "category": "abstention", "question": f"q{i}", "expected_docs": [], "expect": "abstain"})
    for i in range(10):
        cases.append({"case_id": f"c-{i}", "category": "contradiction", "question": f"q{i}", "expected_docs": ["Manual"], "expect": "cite"})
    for i in range(10):
        cases.append({"case_id": f"perm-{i}", "category": "permission", "question": f"q{i}", "expected_docs": [], "expect": "abstain"})
    for i in range(10):
        cases.append({"case_id": f"inj-{i}", "category": "injection", "question": f"q{i}", "expected_docs": [], "expect": "blocked"})
    for i in range(5):
        cases.append({"case_id": f"af-{i}", "category": "approval_flow", "question": f"q{i}", "expected_docs": ["Manual"], "expect": "cite"})
    for i in range(5):
        cases.append({"case_id": f"r-{i}", "category": "recovery", "question": f"q{i}", "expected_docs": ["Manual"], "expect": "cite"})
    return cases


class TestDatasetLoader:
    def test_loads_valid_dataset(self, tmp_path: Path) -> None:
        path = tmp_path / "golden.json"
        path.write_text(json.dumps({"version": "test", "cases": _full_valid_cases()}))
        loaded = load_dataset(path)
        assert len(loaded) == 105

    def test_rejects_wrong_counts(self, tmp_path: Path) -> None:
        path = tmp_path / "bad.json"
        path.write_text(
            json.dumps(
                {"version": "t", "cases": [{"case_id": "f-0", "category": "factual", "question": "q", "expected_docs": ["M"], "expect": "cite"}]}
            )
        )
        with pytest.raises(ValueError, match="exactly 105"):
            load_dataset(path)
