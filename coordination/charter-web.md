# Charter — WEB Lane

## Mission

Own the Next.js investigation workbench: the investigator's cockpit. Login + roles, investigations list, new-investigation form, live SSE timeline, evidence inspector with clickable citations (highlighted source passage), approval dialog for supervisors, tool/audit timeline, admin screens, and every UI state (empty/loading/running/awaiting_approval/completed/failed/blocked_injection). No dead spinners — every state tells the truth.

Stack: Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui, vitest.

## Owned Paths (exclusive)

- `apps/web/**`

## Forbidden Paths (never touch)

- `apps/api/*`, `packages/**` (agent/retrieval/tools), `data/**`, `infra/*`, `scripts/*`, `docs/*`, `COMMON.md`
- `coordination/*` except your own `status-web.md`

## Status File

`coordination/status-web.md`

## Self-Check Commands (run from apps/web)

```
eslint .
tsc --noEmit
vitest run
```

All green before any commit.

## Key Frozen Contracts You Code Against (see COMMON.md §c)

- REST endpoints + exact request/response field lists (§c.1)
- SSE event envelope — the nine event types exactly as enumerated (§c.2)
- Citation contract `[Document title, revision, page/section, chunk_id]` — rendered clickable (§c.5)
- Roles: engineer, safety_officer, supervisor, admin (§c.6)
- Env vars: DATABASE_URL, QDRANT_URL, MODEL_BASE_URL, JWT_SECRET, STORAGE_PATH (§c.7)

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
