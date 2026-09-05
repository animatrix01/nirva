"""W2 live check: Postgres-backed checkpointer durability.

Verifies against a REAL Postgres (docker compose service):
1. postgres_checkpointer() builds and runs setup() DDL
2. a full graph run persists checkpoints for its thread
3. a FRESH process re-creates the saver + graph and resumes from the
   checkpoint without restarting the run from scratch
"""

import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "packages" / "agent" / "src"))

DATABASE_URL = "postgresql://nirva:nirva@127.0.0.1:5432/nirva"


def run_fresh(thread_id: str, resume: bool) -> list[str]:
    """Execute in a fresh interpreter context; returns completed steps."""
    # import inside so each call re-creates the pool + saver
    from typing import Any

    from langchain_core.runnables import RunnableConfig
    from nirva_agent.checkpointer import postgres_checkpointer
    from nirva_agent.gateway import ChatMessage, ChatResponse
    from nirva_agent.graph import build_investigation_graph

    class LocalGateway:
        def chat(self, messages: list[ChatMessage], **kw: Any) -> ChatResponse:
            return ChatResponse(
                content="ABSTAIN: no evidence available.",
                finish_reason="stop",
                model="qwen2.5:3b-instruct-q4_K_M",
                prompt_tokens=1,
                completion_tokens=1,
            )

    saver = postgres_checkpointer(DATABASE_URL)
    graph = build_investigation_graph(LocalGateway(), checkpointer=saver)
    config: RunnableConfig = {"configurable": {"thread_id": thread_id}}
    if resume:
        # resume: continue the interrupted thread without new input
        final = graph.invoke(None, config)  # type: ignore[arg-type]
    else:
        final = graph.invoke(
            {  # type: ignore[arg-type]
                "request_id": thread_id,
                "user_id": "u-check",
                "user_role": "engineer",
                "objective": "Why has Pump P-204 had repeated seal failures?",
                "retrieved_evidence": [],
                "completed_steps": [],
                "last_event_seq": 0,
            },
            config,
        )
    return list(final.get("completed_steps", []))  # type: ignore[union-attr]


def main() -> int:
    from nirva_agent.checkpointer import postgres_checkpointer

    saver = postgres_checkpointer(DATABASE_URL)  # proves setup() DDL runs
    thread_id = f"w2-check-{uuid.uuid4().hex[:8]}"

    steps = run_fresh(thread_id, resume=False)
    print(f"fresh run completed_steps: {steps}")

    tuples = list(saver.list({"configurable": {"thread_id": thread_id}}))
    print(f"checkpoints persisted for thread: {len(tuples)}")
    if not tuples:
        print("FAIL: no checkpoints persisted")
        return 1

    resumed = run_fresh(thread_id, resume=True)
    print(f"resumed completed_steps: {resumed}")

    if resumed == steps:
        print("PASS: fresh process resumed from checkpoint, no restart from scratch")
        return 0
    print("FAIL: resume diverged")
    return 1


if __name__ == "__main__":
    sys.exit(main())
