# Status File — API Lane (EXECUTION terminal: api + ai + infra merged)

> Owned exclusively by the api lane. Update every session (Universal Loop step 6).

## Current Phase

100% of the Winning Plan MVP + differentiators scope COMPLETE. A0–A3 + A7 landed; A5 reranker skipped by gate (Recall@5=1.0); A6 model routing unnecessary (single local model verified). Remaining: operator browser pass + rehearsal.

## Done (list with dates + file paths)

- 2026-09-05 | GET /api/evals LIVE — shape = {dataset_version, executed_at, summary, gates, cases}, roles admin+safety_officer, latest-run semantics. Per-case recall/citation_validity nullable (non-retrieval categories); `blocked` nullable (non-injection cases). Infra paths/URLs stripped by response model. Compose api service mounts packages/evals/results read-only. Verified live: admin 200, safety_officer 200, engineer 403, unauth 401, leak scan clean. 124 tests green. (`see evals commit`)

- 2026-09-05 | A7: pre-judging checklist written from the verified reset ritual (`docs/pre-judging-checklist.md`); Docker images nirva-api/nirva-web exist. (`6cddc8f`)
- 2026-09-04 | A3: episodic memory store — write after supervisor approval, read as tool-sourced evidence, admin list/delete, migration 0006. (`fe7a8f2`)
- 2026-09-04 | A2: checkpointer wiring — postgres_checkpointer when DATABASE_URL is postgres, startup recovery for stuck running jobs, py.typed markers, serialization round-trip tests (pydantic state survives JsonPlusSerializer). (`8c0d825`)
- 2026-09-04 | A1: eval harness — 105-case golden dataset, runner + metrics, all gates green: Recall@5 1.0, citation validity 1.0, abstention 1.0, unauthorized 0, injection block 1.0 (`683e7b1`, results `c8204f4`)
- 2026-09-04 | A0: safety_officer read-visibility of all investigations + evidence/artifacts; ownership test uses second engineer. (`947dabe` + follow-ups)

- 2026-08-30 | TIER 2 Feature 1 — injection blocking: security.py detection (tight regexes + false-positive guards), suspect chunks excluded from evidence before the model, blocked_injection SSE event + security.injection_blocked audit rows with structured payload, security artifact (payload_ref), vendor note re-indexed all-roles, tests. Verified live: golden flow shows blocked_injection then completes citing unaffected records (`68cc224`, `e16d2c1`)
- 2026-08-30 | TIER 2 Feature 2 — image inspection: vision.py describe_image (OpenAI-compatible image message; /v1 verified against native Ollama qwen2.5vl:3b on first attempt), upload accepts .jpg/.jpeg/.png with observations-only prompt, enriched observation chunk text, /api/documents/{id}/file preview endpoint, synthetic P204_photo.jpg generator, tests. Verified live: photo indexed -> "visible leakage" investigation cites the vision chunk with score (`36a34f5`, `c493e31`, `cca8304`)
- 2026-08-30 | SSE stream-stop fix: blocked_injection is mid-flow, not stream-terminal — stream now continues through it to awaiting_approval (15+ events in one connection, verified) (`cca8304`)
- 2026-08-30 | top_k raised 8 -> 12 per plan ("approximately 12 candidates"); short vision chunk now reliably retrieved

- 2026-08-30 | TIER 1 COMPLETE (both units): web exit gate verified on real API (upload indexed + chunk viewer, duplicate=info, 403 matrix exact string, uploaded doc cited in fresh investigation, live score 0.67 with graceful degradation on pre-patch chunks). Joint validation: 84/84 py + 58/58 web tests, lint/tsc/build green. B-side commits `ad6c9d0`, `5e1f268`.

- 2026-08-30 | Tier 1 Unit 1: upload role guard (engineer+admin 201; supervisor/safety_officer 403 with document-control rationale, DECISIONS.md logged); evidence endpoint returns real numeric "score" (Qdrant payload -> job_evidence snapshot -> 0.0 fallback; tool items 1.0); Qdrant-outage resilience (evidence degrades to persisted snapshot instead of 500); upload 403 matrix + numeric-score tests; live server restarted, integration ALL GREEN incl. score in evidence keys and 403 guard verified live (`f62bac8`)
- 2026-08-30 | Web app-header hydration fix committed by operator request (auth-guard race + Link nav) — crossover noted, all web checks green (`631be48`)

- 2026-08-29 | BOTH docker images built and validated: nirva-api:latest (188s, pinned deps + vendored packages) and nirva-web:latest (35.7s after .dockerignore fix); web .dockerignore added; pypdf declared in retrieval parse extra (`bc1fa39`, `34bab7d`)
- 2026-08-29 | Audit trail COMPLETE: 8 chained event types (job.created, retrieval.search_documents, tool.get_asset_history, tool.check_inventory, contradiction.detected, proposal.created, approval.approved, job.completed), chain_valid true; fixed hash-chain append race (process lock + commit-in-lock) (`f8b2046`, `db80494`)
- 2026-08-29 | OFFLINE PROOF + contradiction live: internet disconnected for entire session; golden flow ran fully local (Ollama+Qdrant+SQLite). Contradiction node surfaces inspection-vs-work-order conflict (contradiction_found event + artifact kind=contradiction, both claims verified). 15/15 citations resolve. Root-caused cwd-relative sqlite split-brain: server DB and seed DB were different files; DATABASE_URL now absolute. Integration check extended: contradiction_found + citation-resolution assertions. Dev endpoint /api/dev/audit-login removed (`fed633e`, `84d2af1`)

- 2026-08-29 | Phase 3 COMPLETE + live gate: propose node drafts ProposedAction (confidence-gated, evidence-chunk-referenced); runner persists approval proposal + job reaches awaiting_approval; SSE emits awaiting_approval and stream ends cleanly (reconnect-safe); approvals decision endpoint: engineer 403, supervisor-only decision, idempotent work order (unique approval_id + first-decision-wins 409), resume-to-completed + completed event; audit chain verified on global order (chain_valid True); real read-only tools (get_asset_history, check_inventory) wired as tool-sourced evidence; nirva_tools now properly packaged (`075fec5`, `90f2fc0`)
- 2026-08-29 | Phase 4 support: GET /api/jobs/{id}/artifacts/{payload_ref} discriminated union (approval_request / search_documents / report) matching the web artifact layer (`b567f31`)
- 2026-08-29 | Phase 2 COMPLETE + live gate: synthetic corpus generators (contradiction + injection fixtures); Docling parse -> structural chunking -> Ollama bge-m3 dense + local sparse -> Qdrant hybrid (RRF) with allowed_roles filter INSIDE query; ACL leakage 0; documents router (upload w/ hash dedup + quarantine -> indexed, list, content); retrieve graph node added (intake->retrieve->answer->finalize); golden investigation through real API produced structured citations [title, revision, locator, chunk_id] grounded in retrieved chunks (`116f3fa`, `a94e5e8`, `b03d973`)
- 2026-08-29 | Phase 1 COMPLETE + live gate: real LangGraph adapter replacing mock; live-check script; locally generated streamed response end-to-end (`855a2c9`)
- 2026-08-29 | Phase 0 COMPLETE: repo repair, pinned manifest, Dockerfiles, README, JWT guard, compose config valid, Docker engine running, .env provisioned (`75170d5`..`b352d66`)

## In Progress

- Real-API integration support for web (their flip complete; data mismatch resolved)

## Blocked (reason + which lane must act)

- (nothing)

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

- 2026-08-29 | Web integration support: root cause of web's stale-citation report was orphan Qdrant chunks (index-corpus.py doc ids never in Postgres + debug pollution) -> Qdrant purged and corpus re-seeded ONLY through the real upload API; new job_evidence snapshot table (migration 0004) so TOOL-sourced citations resolve via evidence endpoint; evidence response now carries `source` ("retrieval"|"tool") so the UI knows whether a document deep-link exists; integration check asserts 6/6 citation resolution: **ALL GREEN** on live server (`1fd302d`)
- 2026-08-29 | Real-API GO issued to web: live uvicorn on 127.0.0.1:8000 verified ALL GREEN (CORS, documents content deep-link, evidence chunk endpoint, artifacts, approval->work order, audit chain). Evidence proposal ratified (DECISIONS.md); DEMO_MODE ratified into COMMON.md c.7. Restart: DATABASE_URL=sqlite:///./_server.db + seeded library (6 docs).

- 2026-08-29 | OFFLINE PROOF + contradiction live: internet disconnected for entire session; golden flow ran fully local (Ollama+Qdrant+SQLite). Contradiction node surfaces inspection-vs-work-order conflict (contradiction_found event + artifact kind=contradiction, both claims verified). 15/15 citations resolve. Root-caused cwd-relative sqlite split-brain: server DB and seed DB were different files; DATABASE_URL now absolute. Integration check extended: contradiction_found + citation-resolution assertions. Dev endpoint /api/dev/audit-login removed.

- 2026-08-29 | Audit events complete: full trail verified (job.created -> retrieval.search_documents -> tool.get_asset_history -> tool.check_inventory -> contradiction.detected -> proposal.created -> approval.approved -> job.completed), chain_valid true; fixed hash-chain append race (process lock + commit-in-lock). API docker image BUILT (188s) validating pinned deps + vendored packages. Web image build interrupted by docker daemon wedge (web .dockerignore added); native+containers deployment remains the verified demo path. Qdrant container down pending docker desktop manual restart by operator.
