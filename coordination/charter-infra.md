# Charter — INFRA Lane

## Mission

Own deployment, packaging, shared docs, and the frozen contracts themselves: Docker Compose services (web, api, postgres, qdrant, ollama, otel-collector) with healthchecks on every service, dev/demo profiles, egress denial in demo profile; model registry (names, checksums, quantization, hardware profiles); scripts (`bootstrap-offline.sh`, `seed-demo-data.sh`, `run-evals.sh`, `verify-no-egress.sh`); docs; `.env.example`; git hygiene. Sole editor of COMMON.md — and only via the proposal process.

## Owned Paths (exclusive)

- `infra/*` (compose/, model-config/)
- `scripts/*`
- `docs/*`
- `COMMON.md` (only lane permitted to edit it, and only via [PROPOSAL] -> [DECISION])

## Forbidden Paths (never touch)

- `apps/web/**`, `apps/api/*`, `packages/**`, `data/synthetic/*`
- `coordination/*` except your own `status-infra.md` (read all others freely)

## Status File

`coordination/status-infra.md`

## Self-Check Commands

```
docker compose -f infra/compose/docker-compose.yml config --quiet
docker compose -f infra/compose/docker-compose.yml up -d
# then verify every service healthcheck passes and GET /api/health returns ok
bash scripts/verify-no-egress.sh   # once Phase 5 lands
```

Also maintain `coordination/INTEGRATION-CHECKLIST.md` verification per phase.

## Special Responsibilities

- Process contract proposals: any lane writes `[PROPOSAL]` in DECISIONS.md; ONLY you convert to `[DECISION]` and edit COMMON.md. Other lanes keep coding to the frozen contract meanwhile.
- Keep `.env.example` current with exactly the five env vars (plus additions only via proposal).

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
