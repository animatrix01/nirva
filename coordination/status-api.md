# Status File — API Lane (EXECUTION terminal: api + ai + infra merged)

> Owned exclusively by the api lane. Update every session (Universal Loop step 6).

## Current Phase

Phase 2 — Ingestion + Citations (Phase 0 and Phase 1 COMPLETE)

## Done (list with dates + file paths)

- 2026-08-29 | Repo repair: docs/demo-ready-plan.md saved; .gitignore restored; 58 tracked junk files (dbs/journals/pycache) untracked+deleted; lane-merge decision logged (`75170d5`, `5d1bfa3`)
- 2026-08-29 | Fixed final_report serialization bug in job detail + full typing/lint cleanup; mypy clean, 75/75 tests green incl. agent+retrieval suites now in default pytest scope (`4aaa271`)
- 2026-08-29 | Phase 0: pinned apps/api/pyproject.toml; apps/api + apps/web Dockerfiles; compose api build context widened to repo root; README; JWT-secret startup guard + DEMO_MODE proposal; compose config VALID; Docker engine started (was installed but not running); .env provisioned (`b352d66`)
- 2026-08-29 | Infra live: postgres 16 healthy, qdrant v1.12.4 up, otel-collector up; NATIVE Ollama on 127.0.0.1:11434 already serving qwen2.5:3b-instruct-q4_K_M, qwen2.5vl:3b, bge-m3 (container ollama skipped — port occupied; native use sanctioned by plan recovery table)
- 2026-08-29 | Phase 1: MockIntakeAnswerFinalizeGraph REPLACED by LangGraphInvestigationGraph adapter around packages/agent build_investigation_graph(); stream bridge emits frozen SSE node events live (commit per emit); failures attributed to executing node; GatewayClient from MODEL_BASE_URL with 90s timeout; real owner role into state; job id = thread_id; fake-gateway fixture keeps API tests offline+real-graph (`855a2c9`)
- 2026-08-29 | PHASE 1 EXIT GATE PASSED: live run through real graph + real Ollama model produced local-model report, status completed (scripts/phase1_live_check.py)

## In Progress

- Phase 2 unit #1: synthetic P-204 corpus generators (data/synthetic)

## Blocked (reason + which lane must act)

- (nothing)

## Handoff Notes

- Self-checks: ruff check clean, mypy clean (46 files), pytest 75/75.
- PostgresSaver checkpointer deferred to Phase 3: state contains pydantic models; verify msgpack serialization compat before wiring (flagged for that unit).
- Model name is a code default (DEFAULT_MODEL in graph_client.py) matching infra/model-config registry; model-name env var deliberately NOT added (frozen 5-var contract).
- DEMO_MODE env var is a [PROPOSAL] pending infra-ratification edit of COMMON.md §c.7 (entry in DECISIONS.md 2026-08-29).
- Web exit-gate item `npm run build` belongs to Terminal B environment; not run here.
- Compose api healthcheck expects /api/health 200 — current impl returns 200 when postgres is up; acceptable for sprint, revisit post-demo.
