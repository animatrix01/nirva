# Status File — API Lane (EXECUTION terminal: api + ai + infra merged)

> Owned exclusively by the api lane. Update every session (Universal Loop step 6).

## Current Phase

Phase 3 — Tools + Approval (Phase 0, 1, 2 COMPLETE)

## Done (list with dates + file paths)

- 2026-08-29 | Phase 2 COMPLETE + live gate: synthetic corpus generators (contradiction + injection fixtures); Docling parse -> structural chunking -> Ollama bge-m3 dense + local sparse -> Qdrant hybrid (RRF) with allowed_roles filter INSIDE query; ACL leakage 0; documents router (upload w/ hash dedup + quarantine -> indexed, list, content); retrieve graph node added (intake->retrieve->answer->finalize); golden investigation through real API produced structured citations [title, revision, locator, chunk_id] grounded in retrieved chunks (`116f3fa`, `a94e5e8`, `b03d973`)

## In Progress

- Phase 3: operational tools (asset history, inventory) + work-order proposal approval gate

## Blocked (reason + which lane must act)

- (nothing)

## Handoff Notes

- Self-checks: ruff check clean, mypy clean (46 files), pytest 75/75.
- PostgresSaver checkpointer deferred to Phase 3: state contains pydantic models; verify msgpack serialization compat before wiring (flagged for that unit).
- Model name is a code default (DEFAULT_MODEL in graph_client.py) matching infra/model-config registry; model-name env var deliberately NOT added (frozen 5-var contract).
- DEMO_MODE env var is a [PROPOSAL] pending infra-ratification edit of COMMON.md §c.7 (entry in DECISIONS.md 2026-08-29).
- Web exit-gate item `npm run build` belongs to Terminal B environment; not run here.
- Compose api healthcheck expects /api/health 200 — current impl returns 200 when postgres is up; acceptable for sprint, revisit post-demo.
