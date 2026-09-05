# DECISIONS.md — Append-Only Log

> Append entries only. Never edit or delete existing lines.
>
> Format: `YYYY-MM-DD | <lane> | [PROPOSAL]|[DECISION] | text`
>
> Contract-change process:
> 1. Any lane writes a `[PROPOSAL]` entry describing the change to a frozen contract in COMMON.md.
> 2. ONLY the infra lane may convert a `[PROPOSAL]` to `[DECISION]` and edit COMMON.md accordingly.
> 3. Until converted, ALL lanes keep coding against the frozen contract as written.

---

2026-08-26 | infra | [DECISION] | Workspace bootstrap. COMMON.md frozen: REST contracts, SSE envelope, 17-field LangGraph state schema (Winning Plan §9's 15 canonical fields + operational fields `current_node`, `last_event_seq` added to support SSE streaming and checkpoint resume), chunk metadata schema with allowed_roles ACL, citation contract, roles/default-deny permissions, five env vars.
2026-08-29 | infra | [DECISION] | 24h demo sprint: api + ai + infra lanes merged into a single EXECUTION terminal (Terminal A); web stays a separate lane (Terminal B). Scope = Phases 0-4 of docs/demo-ready-plan.md only; Phase 5 dropped; precomputed structured contradiction acceptable. Frozen contracts unchanged. Sprint ends after Phase 4 support (artifacts endpoint).
2026-08-29 | api | [PROPOSAL] | Add optional env var DEMO_MODE (bool, default false) alongside the frozen five. Reason: demo plan Phase 0 mandates "API startup rejects an unchanged JWT secret outside explicit demo mode"; the flag names that explicit demo mode. It is a mode toggle, not a service address. Compose api healthcheck keeps requiring HTTP 200. Ratify by editing COMMON.md §c.7; until then implementation proceeds since the user directive requires the guard.
2026-08-29 | api | [DECISION] | Interpretation note (no contract change): final_report.citations in §c.1 are structured citation refs per §c.5 — [{title, revision, locator, chunk_id}] — not plain strings. Documented here because the web terminal codes against it.
2026-08-29 | web | [PROPOSAL] | Evidence inspector gap: COMMON.md c.5 requires click-through to highlighted passage with title/revision/page/classification/hash + why-retrieved, but no frozen c.1 endpoint serves chunk content, chunk metadata, or retrieval rationale. Web displays only what the citation string carries today. Proposal: add GET /api/jobs/{job_id}/evidence/{chunk_id} returning { chunk_id, document_id, document_title, document_type, revision, page, section, confidentiality_level, content_hash, passage_text, why_retrieved } (ACL-filtered by caller role); alternatively define payload_ref resolution semantics for evidence_added SSE events.
2026-08-29 | infra | [DECISION] | Ratify DEMO_MODE proposal: COMMON.md §c.7 now lists optional DEMO_MODE (bool, default false) — mode toggle, not a service address. Startup guard active outside demo mode.
2026-08-29 | infra | [DECISION] | Ratify web evidence proposal: GET /api/jobs/{job_id}/evidence/{chunk_id} delivered exactly per proposed shape (ACL filtered inside the Qdrant query; why_retrieved included); document-level deep link GET /api/documents/{document_id}/content already live since Phase 2. Artifacts resolution: payload_ref "approval_request" | "search_documents" | "report" via GET /api/jobs/{job_id}/artifacts/{payload_ref}. Web is cleared to flip NEXT_PUBLIC_MOCK off.
2026-08-30 | api | [DECISION] | Job visibility extended: safety_officer now has READ-ONLY visibility of all investigations (list, detail, evidence, artifacts) — matching the audit/reviewer persona in the demo plan ("audit who accessed which source and why"). Write powers unchanged: safety_officer still cannot propose work orders (403) or approve (403). Engineer visibility unchanged (own jobs only). Enforced server-side in list_jobs, get_job, evidence, artifacts.
2026-08-30 | api | [DECISION] | Document upload authorization (Tier 1, refinery document-control model): POST /api/documents/upload restricted to engineer + admin. Rationale: admin acts as document control/publisher (owns allowed_roles + confidentiality classification at intake); engineer is the investigator attaching evidence; supervisor and safety_officer are reviewers (decisions and audit, not contributors) and receive 403 detail "Document upload requires engineer or admin role". Listing stays ACL-filtered per caller role for all roles. Evidence endpoint additionally returns numeric "score" (additive field).
2026-08-30 | infra | [DECISION] | Landing round-3 rewrite (dark hero per operator reference image) is owned by Terminal B — uncommitted in-flight, to be executed untouched by Terminal A. Web tests mid-iteration are Terminal B's to green.
2026-08-30 | web | [PROPOSAL] | GET /api/jobs list response carries additive fields beyond frozen c.1 JobSummary: equipment_id (string|null), sources (number of cited sources), confidence (number|null) — already consumed by the shipped investigations reference UI (stats, filters, table). Request ratification of these additive fields in COMMON.md c.1; additive-only, no shape change.

## [DECISION] 2026-09-05 � W2: Postgres checkpointer live-verified
- Live check against docker compose Postgres (scripts/postgres_checkpointer_live_check.py): setup() DDL ok, 8 checkpoints persisted per thread, fresh-process resume returns identical completed_steps with no restart from scratch.
- PostgresSaver wired with explicit serde allowlist (JsonPlusSerializer allowed_msgpack_modules) for all nirva_agent.state pydantic models � removes LangGraph 'unregistered type' future-compat warning.
- Re-run after planner node: Recall@5 1.0, citation validity 1.0, abstention 1.0, unauthorized 0, injection block 1.0 (results-20260905-105044).

## [DECISION] 2026-09-05 � W3: Docker VM disk instability on the demo laptop
- Three Docker Desktop crashes, each during heavy pip I/O inside image builds; pip logs show [Errno 5] I/O errors and Bus error core dumps; site-packages files written as null bytes (uvicorn main.py 0 bytes / null-filled).
- Policy: NO heavy image builds on this host. Surgical path only: run container, force-reinstall uvicorn in-place, docker commit, then compose up. Dockerfile carries the equivalent repair layer for healthy hosts/CI.
- Compose fixes landed: container-internal hostnames, native Ollama via host.docker.internal, qdrant bash TCP healthcheck (no wget in image), distroless otel-collector as started-dep (no shell, no healthcheck possible).
