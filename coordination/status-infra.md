# Status File — INFRA Lane

> Owned exclusively by the infra lane. Update every session (Universal Loop step 6).

## Current Phase

Phase 1 — Skeleton (infra deliverables built; runtime verification blocked on Docker availability)

## Done (list with dates + file paths)

- 2026-08-26 | Workspace bootstrap: directory tree, COMMON.md, coordination/ charters+statuses+DECISIONS+INTEGRATION-CHECKLIST, .gitignore, .env.example, initial commit (`nirva/.gitignore`, `nirva/.env.example`, `nirva/COMMON.md`, `nirva/coordination/*`)
- 2026-08-26 | Compose stack: `infra/compose/docker-compose.yml` — web:3000, api:8000, postgres:5432, qdrant:6333(+6334), ollama:11434, otel-collector(4317/4318); healthchecks on ALL six, depends_on service_healthy chain, persistent volumes (pgdata, qdrant-data, ollama-models, otel-data, nirva-storage), env via `.env`, ports loopback-bound; egress-denied demo profile included but commented (header block)
- 2026-08-26 | Local-only OTel config: `infra/compose/otel-collector-config.yaml` (OTLP -> local file exporters + health_check ext :13133; no cloud backends)
- 2026-08-26 | Model registry: `infra/model-config/models.yaml` — text qwen2.5:7b-instruct-q4_K_M (fallback qwen2.5:3b <=6GB VRAM), vision qwen2.5vl:3b, embeddings bge-m3; checksum fields present, filled by first pull (`PENDING_FIRST_PULL_VERIFY` policy documented)
- 2026-08-26 | Scripts: `scripts/bootstrap-offline.sh` (.env creation, image pre-pull, VRAM detection + model fallback, one-time model pulls, stack up, --verify-models recheck), `scripts/seed-demo-data.sh` (health wait, admin login, idempotent corpus upload via real API), `scripts/verify-no-egress.sh` (per-container TCP/DNS leak probes + internal-network audit; Phase 5 gate rehearsed early), `scripts/run-evals.sh` (Recall@5 >= 0.85 gate, refuses fake pass when fixtures absent). All pass `bash -n`.
- 2026-08-26 | Runbook: `docs/runbook.md` — zero-to-running for a human operator incl. air-gapped demo mode and checkpoint-resume drill

## In Progress

- (nothing)

## Blocked (reason + which lane must act)

- INTEGRATION-CHECKLIST.md Phase 1 execution: Docker is NOT installed/running on this workstation (`docker` command not found) -> cannot `compose up` or even `compose config --quiet`. ACTION: human/operator must install Docker Desktop; then infra runs the full checklist (compose up -> health green -> login engineer -> submit job -> SSE stream -> citation click -> supervisor approve -> audit row -> kill+restart api -> checkpoint resume) and logs results here.
- Checklist items also gated on API lane landing `/api/auth/login`, `/api/jobs`, SSE endpoint + Dockerfile at `apps/api/Dockerfile`, and WEB lane Dockerfile at `apps/web/Dockerfile` (compose builds reference these paths).

## Handoff Notes

- All lanes: start Phase 1 per COMMON.md §f. Compose now exists — services postgres/qdrant/ollama are updatable independently (`docker compose -f infra/compose/docker-compose.yml up -d <svc>`) so you have real endpoints to code against.
- API lane: compose healthcheck hits `GET /api/health` returning exactly 200 only when all essential services up (COMMON §c.1); provide `apps/api/Dockerfile`. Seed the four demo-role users via migrations.
- WEB lane: provide `apps/web/Dockerfile`; compose sets `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`.
