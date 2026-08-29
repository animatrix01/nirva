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

- 2026-08-29: Unit 8 — approvals/audit/system/health: `/approvals` queue (pending/decided sections, decision wired for supervisors, 403 state for others); `/audit` (chain_valid badge, redacted-summary table, role-gated admin/safety_officer); `/admin/system` (frozen GET /api/admin/models table, admin-only); `HealthIndicator` in AppHeader polling GET /api/health → "Local / Offline" green / degraded / unreachable; role-aware nav links; mock handlers `/api/audit` (hash-chained events, chain re-verified on read, 403 others) + `/api/health` (no auth) + `/api/admin/models` (admin only). 51 tests green.

- 2026-08-29: Unit 9 — AI Elements integration: installed conversation/message/sources/tool/task/chain-of-thought primitives into `src/components/ai-elements/` (CLI blocked only for the decision primitive by a terminal deny-rule on the "rm" substring in its name — hand-rolled equivalent at `ai-elements/confirmation.tsx`); fixed vendored `code-block.tsx` ref-during-render with state-keyed staleness (no suppression); detail page now renders final report findings via `MessageResponse` (sanitized markdown, raw HTML disabled) and citations via `Sources/SourcesTrigger/SourcesContent` + `CitationLink`. 51 tests green.

- 2026-08-29: Unit 10 — layout pass: detail workspace is two-column on desktop (65/35 main|evidence+control per demo plan, lg breakpoint), single-column stack below lg (mobile fallback, no horizontal scroll); approval gate + evidence + tools pinned in side column; container widened to max-w-6xl (fits 1366×768). Production build green with all 8 routes (/ /login /investigations /investigations/new /investigations/[jobId] /approvals /audit /admin/system). 51 tests green.

- 2026-08-29: INTEGRATION GO Unit 1 — flipped to real API: `lib/api.ts` real fetch only (base `http://127.0.0.1:8000` via `NEXT_PUBLIC_API_BASE`), `lib/sse.ts` rewritten on fetch streaming (Bearer header + manual Last-Event-ID resync — API authenticates via header, native EventSource unusable); `/mocks` moved to `/src/test-mocks` (test-only doubles, zero production imports) + global fetch stub in vitest.setup; contracts synced to ratifications: `FinalReport.citations` = structured `CitationRef[]`, artifact refs `approval_request|search_documents|report` (kinds approval/tool/report), evidence endpoint shape + `equipment_id`, document content deep link; demo password `nirva-demo-pass`. 53 tests green.

- 2026-08-29: INTEGRATION Unit 2 — E2E verified through the REAL API (127.0.0.1:8000): engineer login → P-204 job created (queued) → SSE streamed 13 envelope events (intake→retrieve→answer→finalize→propose→awaiting_approval, payload_refs search_documents/approval_request) → approval_request artifact served (risk=high) → engineer decision attempt correctly 403 → supervisor approved (work_order_id issued) → duplicate decision 409 → job status completed → audit chain_valid=true (safety_officer) → Last-Event-ID:5 replayed seq 6-13 exactly. Lint+tsc+53 tests+production build all green.

## In Progress

- (nothing — integration complete; awaiting demo rehearsal input)

## Blocked (reason + which lane must act)

- DATA (Terminal A): some Qdrant chunk payloads from the seeded completed job reference stale document_ids missing from Postgres (e.g. doc-e9308ef9601c, doc-a7ac2d8f3ce1, doc-d5324dbce1e9 in job a291d576 citations) → GET /api/documents/{id}/content returns 404 for those citations. Web handles this truthfully (renders unavailable, per demo plan). Needs Qdrant/Postgres re-sync or re-seed.

## Handoff Notes

- INTEGRATION GO executed 2026-08-29. Production path imports ZERO mocks; `/src/test-mocks` are vitest-only doubles behind a global fetch stub (vitest.setup.ts).
- SSE transport is fetch-streaming (not EventSource) because the API authenticates via Authorization header; reconnect sends Last-Event-ID = last received seq, server replays seq > N (verified live).
- Contract notes: artifacts refs are the literal strings approval_request|search_documents|report; approval artifact carries no job_id/requested_by/required_role — ApprovalCard renders fallbacks; decision response merged client-side (decided_by/decided_at/work_order_id).
- Approval list rows have no comment field until decision; comment shown post-decision comes from the local decision call (per §c.1 response shape).

- Self-check loop: from `apps/web` run `npm run lint && npm run typecheck && npm test`.
- Next.js 16 note: default layout used a generated `LayoutProps` global type that tsc could not resolve pre-build; replaced with explicit `{ children }` typing.
- Frozen contracts implemented against next: POST /api/auth/login, GET /api/auth/me, POST /api/jobs, GET /api/jobs(+filters), GET /api/jobs/{id}, SSE GET /api/jobs/{id}/events (9-type envelope §c.2).
