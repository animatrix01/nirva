# Charter — API Lane

## Mission

Own the FastAPI gateway and the typed tools: every request passes through one typed, authenticated door. Auth (JWT, bcrypt, four roles), jobs lifecycle, SSE streaming of graph events, document upload/quarantine/dedup endpoints, approvals decision endpoint (idempotent), audit hash chain read API, model registry endpoint, health endpoint. In `packages/tools`: the five typed tools (`search_documents`, `get_asset_history`, `check_inventory`, `propose_work_order`, `approve_work_order`) with default-deny authorization enforced OUTSIDE the model, parameterized queries only, timeouts, retries, idempotency keys.

Stack: FastAPI, Pydantic, SQLAlchemy, Alembic.

## Owned Paths (exclusive)

- `apps/api/*`
- `packages/tools/*`

## Forbidden Paths (never touch)

- `apps/web/**`, `packages/agent/*`, `packages/retrieval/*`, `data/**`, `infra/*`, `scripts/*`, `docs/*`, `COMMON.md`
- `coordination/*` except your own `status-api.md`

## Status File

`coordination/status-api.md`

## Self-Check Commands

```
ruff check .
ruff format --check .
mypy apps/api packages/tools
pytest
```

Run from repo root (`nirva/`). All green before any commit.

## Key Frozen Contracts You Implement (see COMMON.md §c)

- REST endpoints with EXACT field lists (§c.1) — you are the contract's author-side implementer
- SSE envelope emitted exactly as specified (§c.2)
- LangGraph state persistence via Postgres checkpointer (§c.3)
- Roles + default-deny tool permission matrix (§c.6)
- Env vars only; no hardcoded addresses (§c.7)

## Universal Loop

Every session in this lane:
(1) READ COMMON.md fully.
(2) READ your status file + last 20 lines of coordination/DECISIONS.md.
(3) Pick the next incomplete task for the CURRENT PHASE from COMMON.md roadmap; skip blocked items and record why.
(4) Implement ONE small unit.
(5) Run your self-check commands; fix until green.
(6) UPDATE your status file (move item to Done with file list; update Handoff Notes).
(7) Commit with your lane prefix.
(8) Repeat from (3) until phase tasks are done.
