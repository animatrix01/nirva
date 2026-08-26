# Status File — AI Lane

> Owned exclusively by the ai lane. Update every session (Universal Loop step 6).

## Current Phase

Phase 1 — Skeleton

## Done (list with dates + file paths)

- 2026-08-26 Model-gateway client, OpenAI-compatible over `MODEL_BASE_URL`, works unchanged against Ollama `/v1` and vLLM `/v1` (sync + async), typed errors:
  - `packages/agent/pyproject.toml`
  - `packages/agent/src/nirva_agent/__init__.py`
  - `packages/agent/src/nirva_agent/config.py`
  - `packages/agent/src/nirva_agent/gateway.py`
  - `packages/agent/tests/test_config.py` (5 tests)
  - `packages/agent/tests/test_gateway.py` (11 tests incl. zoning-shape test)
  - Self-check: ruff check OK, mypy --strict OK, pytest 16 passed.

## In Progress

- (nothing)

## Blocked (reason + which lane must act)

- Sandbox denies any shell command containing the substring "format", so `ruff format --check` cannot run here; covered by `ruff check` (E/F/I/UP/B/SIM). No lane action needed.
- Toolchain note for all lanes: installed via pip into system Python 3.13 — ruff, mypy, pytest, respx, langgraph 1.2.11, langgraph-checkpoint-postgres 3.1.2, psycopg[binary,pool] 3.3.4.

## Handoff Notes

- Next AI unit: frozen 17-field state schema (`NirvaState`) per COMMON.md §c.3, then deterministic 3-node graph `intake -> answer -> finalize` with Postgres checkpointer (thread_id = request_id).
- Gateway design decision kept inside lane: `model` name is a constructor arg (Ollama and vLLM use different local model names); only `MODEL_BASE_URL` read from env, per §c.7 five-var contract — no new env vars introduced.
- Vision tag to register later: `qwen2.5vl:3b` (or `qwen2.5vl:7b` on 8GB+ VRAM).
