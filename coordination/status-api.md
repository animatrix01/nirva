# Status File — API Lane (EXECUTION terminal: api + ai + infra merged)

> Owned exclusively by the api lane. Update every session (Universal Loop step 6).

## Current Phase

Phase 4 support COMPLETE — Execution terminal sprint scope (Phases 0-4 support) DONE. Remaining: demo rehearsal + offline verification with Terminal B.

## Done (list with dates + file paths)

- 2026-08-29 | Phase 3 COMPLETE + live gate: propose node drafts ProposedAction (confidence-gated, evidence-chunk-referenced); runner persists approval proposal + job reaches awaiting_approval; SSE emits awaiting_approval and stream ends cleanly (reconnect-safe); approvals decision endpoint: engineer 403, supervisor-only decision, idempotent work order (unique approval_id + first-decision-wins 409), resume-to-completed + completed event; audit chain verified on global order (chain_valid True); real read-only tools (get_asset_history, check_inventory) wired as tool-sourced evidence; nirva_tools now properly packaged (`075fec5`, `90f2fc0`)
- 2026-08-29 | Phase 4 support: GET /api/jobs/{id}/artifacts/{payload_ref} discriminated union (approval_request / search_documents / report) matching the web artifact layer (`b567f31`)
- 2026-08-29 | Phase 2 COMPLETE + live gate: synthetic corpus generators (contradiction + injection fixtures); Docling parse -> structural chunking -> Ollama bge-m3 dense + local sparse -> Qdrant hybrid (RRF) with allowed_roles filter INSIDE query; ACL leakage 0; documents router (upload w/ hash dedup + quarantine -> indexed, list, content); retrieve graph node added (intake->retrieve->answer->finalize); golden investigation through real API produced structured citations [title, revision, locator, chunk_id] grounded in retrieved chunks (`116f3fa`, `a94e5e8`, `b03d973`)
- 2026-08-29 | Phase 1 COMPLETE + live gate: real LangGraph adapter replacing mock; live-check script; locally generated streamed response end-to-end (`855a2c9`)
- 2026-08-29 | Phase 0 COMPLETE: repo repair, pinned manifest, Dockerfiles, README, JWT guard, compose config valid, Docker engine running, .env provisioned (`75170d5`..`b352d66`)

## In Progress

- (nothing — handoff to integration/rehearsal)

## Blocked (reason + which lane must act)

- Docker compose api/web image builds not yet exercised (engine runs; native Ollama on 11434 replaces the container ollama). ACTION: integration checkpoint during rehearsal.

## Handoff Notes

- Self-checks at handoff: ruff clean, mypy clean (61 files), pytest 75/75.
- Live gates all passed on the real stack: Phase 1 (local-model response), Phase 2 (citations), Phase 3 (approval gate + work order + audit chain).
- Graph is now 5 nodes: intake -> retrieve -> answer -> finalize -> propose. propose is confidence-gated (>= 0.5): thin evidence -> abstain -> no proposal -> completed.
- Model: qwen2.5:3b-instruct-q4_K_M on NATIVE Ollama (127.0.0.1:11434); container ollama skipped (port conflict). For compose runs set MODEL_BASE_URL=http://host.docker.internal:11434/v1.
- Approval pause is application-level (job status + SSE), not a LangGraph interrupt; the consequential action (work order) executes only post-decision — zero bypass holds. LangGraph-interrupt purism deferred post-demo.
- tools.propose/approve raise ApprovalFlowRequired and route through the approvals endpoint (authorization enforced outside the model).
- Web exit-gate item `npm run build` belongs to Terminal B.

## Handoff Notes

- Self-checks: ruff check clean, mypy clean (46 files), pytest 75/75.
- PostgresSaver checkpointer deferred to Phase 3: state contains pydantic models; verify msgpack serialization compat before wiring (flagged for that unit).
- Model name is a code default (DEFAULT_MODEL in graph_client.py) matching infra/model-config registry; model-name env var deliberately NOT added (frozen 5-var contract).
- DEMO_MODE env var is a [PROPOSAL] pending infra-ratification edit of COMMON.md §c.7 (entry in DECISIONS.md 2026-08-29).
- Web exit-gate item `npm run build` belongs to Terminal B environment; not run here.
- Compose api healthcheck expects /api/health 200 — current impl returns 200 when postgres is up; acceptable for sprint, revisit post-demo.
