# Status File — WEB Lane

> Owned exclusively by the web lane. Update every session (Universal Loop step 6).

## Current Phase

Phase 1 — Skeleton

## Done (list with dates + file paths)

- 2026-08-26: Scaffolded Next.js 16 App Router app in `apps/web/` (TypeScript, Tailwind v4, src dir, `@/*` alias). `src/app/*`, `package.json`.
- 2026-08-26: Installed + wired shadcn/ui (radix/nova preset): button, card, input, label, badge, select, table, separator, tabs, dialog, sonner under `src/components/ui/`; `src/lib/utils.ts`; `components.json`.
- 2026-08-26: Vitest + Testing Library setup: `vitest.config.ts`, `vitest.setup.ts`, scripts `lint`/`typecheck`/`test` in `package.json`. Landing page replaced with NIRVA entry (`src/app/page.tsx`) + smoke test (`src/app/page.test.tsx`). Self-check green.

## In Progress

- Typed API client against frozen contracts (§c.1) + `/mocks` handlers (API lane not started — mocking rule active).

## Blocked (reason + which lane must act)

- Nothing blocked; real API absent so all HTTP/SSE goes through mocks until status-api.md reports endpoints live.

## Handoff Notes

- Self-check loop: from `apps/web` run `npm run lint && npm run typecheck && npm test`.
- Next.js 16 note: default layout used a generated `LayoutProps` global type that tsc could not resolve pre-build; replaced with explicit `{ children }` typing.
- Frozen contracts implemented against next: POST /api/auth/login, GET /api/auth/me, POST /api/jobs, GET /api/jobs(+filters), GET /api/jobs/{id}, SSE GET /api/jobs/{id}/events (9-type envelope §c.2).
