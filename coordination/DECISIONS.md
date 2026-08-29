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
