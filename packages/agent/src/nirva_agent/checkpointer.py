"""Checkpointer factories for durable LangGraph runs.

thread_id = request_id = job_id (COMMON.md c.1/c.3): killed runs resume from
the Postgres checkpoint without repeating tool calls.
"""

from __future__ import annotations

from typing import Any, Protocol

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import InMemorySaver


class CheckpointerFactory(Protocol):
    def __call__(self) -> BaseCheckpointSaver[Any]: ...


def in_memory_checkpointer() -> InMemorySaver:
    """Fake/test checkpointer with identical semantics to the Postgres one."""
    return InMemorySaver()


def postgres_checkpointer(database_url: str) -> BaseCheckpointSaver[Any]:
    """Build a Postgres-backed checkpointer from DATABASE_URL (COMMON.md c.7).

    Uses a psycopg pool so multiple API workers share checkpoints. Call
    ``setup()`` once before first use (idempotent DDL creation).
    """
    if not database_url:
        raise ValueError("database_url must not be empty")

    from langgraph.checkpoint.postgres import PostgresSaver

    pool = _make_pool(database_url)
    saver = PostgresSaver(pool, serde=_make_serializer())  # type: ignore[arg-type]
    saver.setup()
    return saver


def _make_serializer() -> Any:
    """Explicit msgpack allowlist for our state models (future-compat:
    LangGraph will block unregistered pydantic deserialization)."""
    from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer

    return JsonPlusSerializer(
        allowed_msgpack_modules=[
            ("nirva_agent.state", "EvidenceItem"),
            ("nirva_agent.state", "FinalReport"),
            ("nirva_agent.state", "ProposedAction"),
            ("nirva_agent.state", "Citation"),
            ("nirva_agent.state", "Contradiction"),
            ("nirva_agent.state", "ToolResult"),
        ]
    )


def _make_pool(database_url: str) -> object:
    from psycopg_pool import ConnectionPool

    return ConnectionPool(
        conninfo=database_url,
        max_size=10,
        open=True,
        kwargs={"autocommit": True, "prepare_threshold": 0},
    )
