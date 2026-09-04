"""A4: planner whitelist validation + plan node integration."""

import sys
from pathlib import Path

from nirva_agent.gateway import ChatResponse
from nirva_agent.graph import plan_node
from nirva_agent.planner import DEFAULT_PLAN, validate_plan

SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))


class FakeGateway:
    def __init__(self, reply: str) -> None:
        self.reply = reply

    def chat(self, messages: object, **kwargs: object) -> ChatResponse:
        return ChatResponse(
            content=self.reply,
            finish_reason="stop",
            model="fake",
            prompt_tokens=1,
            completion_tokens=1,
        )


def test_valid_plan_passes_through() -> None:
    assert validate_plan('["retrieve", "retrieve_refine", "answer"]') == [
        "retrieve",
        "retrieve_refine",
        "answer",
    ]


def test_non_whitelisted_steps_are_dropped() -> None:
    plan = validate_plan('["retrieve", "delete_all_documents", "answer"]')
    assert plan == ["retrieve", "answer"]


def test_malformed_output_falls_back_to_default() -> None:
    assert validate_plan("just do the thing please") == DEFAULT_PLAN
    assert validate_plan(None) == DEFAULT_PLAN
    assert validate_plan('{"not": "a list"}') == DEFAULT_PLAN
    assert validate_plan('["answer"]') == DEFAULT_PLAN  # must start with retrieve
    assert validate_plan('["retrieve", "retrieve"]') == DEFAULT_PLAN  # answer last


def test_answer_must_appear_exactly_once() -> None:
    assert validate_plan('["retrieve", "answer", "answer"]') == DEFAULT_PLAN


def test_plan_node_uses_model_output_when_valid() -> None:
    gateway = FakeGateway(reply='["retrieve", "retrieve_refine", "answer"]')
    result = plan_node(
        {"request_id": "j1", "user_id": "u1", "user_role": "engineer", "objective": "x"},  # type: ignore[typeddict-item]
        gateway,
    )
    assert result["plan"] == ["retrieve", "retrieve_refine", "answer"]
    assert result["completed_steps"] == ["plan"]


def test_plan_node_falls_back_when_gateway_fails() -> None:
    class BrokenGateway:
        def chat(self, *args: object, **kwargs: object) -> object:
            raise RuntimeError("gateway down")

    result = plan_node(
        {"request_id": "j1", "user_id": "u1", "user_role": "engineer", "objective": "x"},  # type: ignore[typeddict-item]
        BrokenGateway(),  # type: ignore[arg-type]
    )
    assert result["plan"] == DEFAULT_PLAN
