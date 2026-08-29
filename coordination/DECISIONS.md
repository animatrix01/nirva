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
