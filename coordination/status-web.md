# Status File — WEB Lane

> Owned exclusively by the web lane. Update every session (Universal Loop step 6).

## Current Phase

Phase 1 — Skeleton

## Done (list with dates + file paths)

- 2026-08-29: Unit 1-2 — investigations list complete: fixed 2 tsc errors (`e?.detail` → `ApiError` instanceof guard; removed invalid `setSearchParams`/`useSearchParams` misuse), removed unused-var warning. `src/components/InvestigationsList.tsx` rewritten: status Select (all six §c.1 statuses + All), asset filter via frozen `equipment_id` query param, client-side from-date filter, rows link to `/investigations/[jobId]`, skeleton loading/empty/error+retry states. Page layout fixed (`src/app/investigations/page.tsx`). Helper tests (`InvestigationsList.test.ts`). 21 tests green. Note: react-hooks/set-state-in-effect lint rule requires state updates only in async callbacks — fetch scheduled via queueMicrotask with cancellation signal.

- 2026-08-26: Scaffolded Next.js 16 App Router app in `apps/web/` (TypeScript, Tailwind v4, src dir, `@/*` alias). `src/app/*`, `package.json`.
- 2026-08-26: Installed + wired shadcn/ui (radix/nova preset): button, card, input, label, badge, select, table, separator, tabs, dialog, sonner under `src/components/ui/`; `src/lib/utils.ts`; `components.json`.
- 2026-08-26: Vitest + Testing Library setup: `vitest.config.ts`, `vitest.setup.ts`, scripts `lint`/`typecheck`/`test` in `package.json`. Landing page replaced with NIRVA entry (`src/app/page.tsx`) + smoke test (`src/app/page.test.tsx`). Self-check green.
- 2026-08-26: Frozen-contract layer: types `src/lib/types.ts` (§c.1 shapes + §c.2 envelope with the nine event types); API client `src/lib/api.ts` (login/me/jobs CRUD, bearer auth, typed ApiError `{detail,field}`); SSE client `src/lib/sse.ts` with reconnect + resync via Last-Event-ID semantics; `/mocks` folder (`src/mocks/db.ts|router.ts|sse.ts`) implementing §c.1 routes and a scripted §c.2 stream covering completed / awaiting_approval / failed / blocked_injection scenarios; contract tests `src/mocks/router.test.ts`, `src/mocks/sse.test.ts`. 12 tests green.

- 2026-08-26: Login screen + role display: `src/app/login/page.tsx` (POST /api/auth/login, error states, demo-account hints), `src/components/role-badge.tsx` (all four §c.6 roles), `src/components/app-header.tsx` (auth guard via `src/lib/auth-client.ts` useSyncExternalStore, username+role display, sign out). Tests: `src/app/login/page.test.tsx`, `src/components/role-badge.test.tsx`. 16 tests green.

- 2026-08-29: Unit 3 — new investigation form: `src/app/investigations/new/page.tsx` (objective textarea + optional asset ID, client validation ≥8 chars, posts frozen POST /api/jobs `{objective, equipment_id}`, routes to detail on 201, typed 422/error display). Tests `page.test.tsx` (validation + create-and-redirect). 25 tests green.

- 2026-08-29: Unit 4 — investigation detail workspace `/investigations/[jobId]`: header (status badge/current node/creator/timestamp), live SSE timeline via `src/lib/sse.ts` (seq dedupe, reconnect banner while live), all-six-state truthful banners (`timeline.ts`), Phase-1 node timeline (intake→answer→finalize+approval_executor; pending/running/done), final report section. `npm run build` green. 35 tests green.
- 2026-08-29: Unit 5 — citation evidence inspector: `src/lib/citation.ts` (§c.5 parser + tests), `src/components/investigation/CitationLink.tsx` (clickable citation dialog). [PROPOSAL] filed in DECISIONS.md re: evidence artifact endpoint (demo plan now specifies GET /api/jobs/{job_id}/artifacts/{payload_ref}).
- 2026-08-29: Unit 6 — artifact layer: `src/lib/artifacts.ts` (JobArtifact discriminated union; EvidenceReference with chunk metadata, hash, why_retrieved); `api.getArtifact()` → GET /api/jobs/{job_id}/artifacts/{payload_ref}; `/mocks/artifacts.ts` + payload_ref-backed SSE scripts; mock router serves artifacts with job-ownership check. 44 tests green.
- 2026-08-29: Unit 7a — workspace read-only panels: `src/components/investigation/EvidencePanel.tsx` (source list w/ §c.5 locator, selected passage highlighted, confidentiality/revision/page/chunk_id/content_hash/why-retrieved), `ToolActivityList.tsx` (name/status/sanitized args/output), `ContradictionView.tsx` (side-by-side sources + note). Detail page fetches artifacts on payload_ref events (fetch-once cache) and renders all panels. 44 tests green.

- 2026-08-29: Unit 7b — approval flow per frozen §c.1: `api.listApprovals()` + `api.decideApproval()`; mock routes GET /api/approvals (supervisor/admin, 403 others) + POST /api/approvals/{id}/decision (supervisor only, first-decision-wins 409, typed 422, resumes job to completed); `ApprovalCard.tsx` — engineer read-only waiting ("cannot self-approve"), supervisor enabled approve/reject + comment, post-decision shows decision/actor/timestamp/comment/work-order-id. Wired into detail page via approval payload_ref artifact. 51 tests green.

## In Progress

- /approvals queue page (supervisor), /audit screen, Local/Offline health indicator, /admin/system.

## Blocked (reason + which lane must act)

- Nothing blocked; real API absent so all HTTP/SSE goes through mocks until status-api.md reports endpoints live. Mock toggle: env `NEXT_PUBLIC_MOCK=0` + `NEXT_PUBLIC_API_BASE` switches to live fetch/EventSource.

## Handoff Notes

- Self-check loop: from `apps/web` run `npm run lint && npm run typecheck && npm test`.
- Next.js 16 note: default layout used a generated `LayoutProps` global type that tsc could not resolve pre-build; replaced with explicit `{ children }` typing.
- Frozen contracts implemented against next: POST /api/auth/login, GET /api/auth/me, POST /api/jobs, GET /api/jobs(+filters), GET /api/jobs/{id}, SSE GET /api/jobs/{id}/events (9-type envelope §c.2).
