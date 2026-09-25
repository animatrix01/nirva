"""A4: dynamic planner — bounded, whitelist-validated step selection.

The model proposes a retrieval plan from the objective; a strict whitelist
validator keeps every step before execution (no arbitrary instructions can
enter the plan). finalize/propose are fixed-tail nodes and never planned.
"""

from __future__ import annotations

import json
import re

PLANNING_WHITELIST = frozenset({"retrieve", "retrieve_refine", "code", "answer"})
DEFAULT_PLAN: list[str] = ["retrieve", "answer"]
MAX_PLAN_STEPS = 4

_PLANNER_SYSTEM = (
    "You are the planner of an industrial investigation engine. "
    "Choose a retrieval plan for the objective. Reply with ONLY a JSON array "
    "of steps chosen from: retrieve, retrieve_refine, code, answer. "
    "Rules: start with retrieve; answer must be last; at most 4 steps. "
    "Use retrieve_refine only for multi-part objectives that likely need a "
    "second, more specific evidence pass. "
    "Use code only when the objective asks for data analysis or computation "
    "over operational readings (vibration, temperature, inventory figures); "
    "the code step runs generated analysis code in a sandbox and records the "
    "verified result as tool evidence."
)


def planner_messages(objective: str) -> list[tuple[str, str]]:
    return [
        ("system", _PLANNER_SYSTEM),
        ("user", f"OBJECTIVE: {objective}"),
    ]


def validate_plan(raw: str | None) -> list[str]:
    """Normalize a model-proposed plan to whitelisted, sane steps.

    Any parse failure, non-whitelisted token, or ordering violation falls
    back to the deterministic default plan.
    """
    if not raw:
        return list(DEFAULT_PLAN)
    try:
        match = re.search(r"\[[^\]]*\]", raw, re.DOTALL)
        if match is None:
            return list(DEFAULT_PLAN)
        parsed = json.loads(match.group(0))
    except (json.JSONDecodeError, ValueError):
        return list(DEFAULT_PLAN)
    if not isinstance(parsed, list):
        return list(DEFAULT_PLAN)

    plan = [str(step).strip().lower() for step in parsed]
    plan = [step for step in plan if step in PLANNING_WHITELIST]
    if not plan or plan[0] != "retrieve" or plan[-1] != "answer":
        return list(DEFAULT_PLAN)
    if plan.count("answer") != 1:
        return list(DEFAULT_PLAN)
    return plan[:MAX_PLAN_STEPS]
