"""Deterministic injection detection for retrieved content.

Retrieved documents are DATA, never instructions (COMMON.md principle 5).
When a chunk matches an instruction-like pattern it is excluded from evidence
by the runner, the exclusion is emitted as a blocked_injection event and
recorded in the audit trail — and the investigation continues with the
unaffected evidence.

Patterns are intentionally TIGHT: a false positive on legitimate maintenance
text ("torque to 45 Nm", "alignment completed successfully") would wrongly
hide real evidence.
"""

from __future__ import annotations

import re

INJECTION_PATTERNS: tuple[str, ...] = (
    r"ignore (all )?previous instructions",
    r"disregard .{0,40}(instructions|rules)",
    r"export all .{0,40}(records|data)",
    r"mark the task (as )?completed",
    r"reveal (your )?(system )?prompt",
)

_COMPILED = [re.compile(pattern, re.IGNORECASE) for pattern in INJECTION_PATTERNS]

__all__ = ["INJECTION_PATTERNS", "detect_injection"]


def detect_injection(text: str) -> str | None:
    """Return the matched pattern string if the text is instruction-like."""
    for pattern, compiled in zip(INJECTION_PATTERNS, _COMPILED, strict=True):
        if compiled.search(text):
            return pattern
    return None
