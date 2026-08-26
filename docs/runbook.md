# NIRVA Runbook — from zero to running stack

Audience: a human operator with no prior context. Everything local; the only
internet use in this entire document is the ONE-TIME model/image pre-pull in
step 2. After that, NIRVA runs air-gapped.

## 0. Prerequisites

| Requirement | Notes |
|---|---|
| Docker Desktop (compose v2) | Windows/macOS/Linux |
| bash + curl + python3 | for `scripts/*.sh` (Git Bash works on Windows) |
| 16 GB RAM recommended, GPU optional | <=6 GB VRAM auto-falls back to qwen2.5:3b |

## 1. Get the workspace

```bash
git clone <repo-url> nirva && cd nirva
```

## 2. One-time online bootstrap

```bash
bash scripts/bootstrap-offline.sh
```

What it does:
1. Copies `.env.example` -> `.env` (**edit `.env`, set a long random `JWT_SECRET`**).
2. Pre-pulls pinned images (postgres:16-alpine, qdrant:v1.12.4, ollama:0.5.7,
   otel-collector-contrib:0.113.0) so later offline `up` never needs network.
3. Detects VRAM; <=6 GB pins fallback text model qwen2.5:3b.
4. Pulls models into the local Ollama registry: text `qwen2.5:7b-instruct-q4_K_M`
   (or fallback), vision `qwen2.5vl:3b`, embeddings `bge-m3`.
5. Starts the full compose stack (`infra/compose/docker-compose.yml`).

After the first pull, open `infra/model-config/models.yaml` and replace each
`PENDING_FIRST_PULL_VERIFY` checksum with the real digest:
`docker exec nirva-ollama sha256sum /root/.ollama/models/blobs/*`.

Re-verify any time with:

```bash
bash scripts/bootstrap-offline.sh --verify-models
```

## 3. Seed demo data

```bash
bash scripts/seed-demo-data.sh
```

Waits for `/api/health == 200`, logs in as seeded admin, uploads the synthetic
corpus (`data/synthetic/*`) through the real upload API. Idempotent: hash-dup
uploads are reported and skipped.

Demo accounts (seeded by API migrations): `admin`, plus one user per role
(`engineer`, `safety_officer`, `supervisor`) — see API lane docs for passwords.

## 4. Verify the golden workflow (INTEGRATION-CHECKLIST Phase 1)

1. All six containers healthy:
   ```bash
   docker compose -f infra/compose/docker-compose.yml ps
   ```
2. Health endpoint green: `curl http://127.0.0.1:8000/api/health`.
3. Open http://127.0.0.1:3000 -> login as engineer.
4. Submit: *"Investigate why Pump P-204 has failed repeatedly..."*
5. Watch the live SSE timeline (intake -> answer -> finalize events arrive in order).
6. Supervisor login -> approve pending work-order proposal (Phase 3+).
7. Admin/safety_officer -> audit view shows hash-chained rows (`chain_valid: true`).

Checkpoint-resume drill (Phase 3): submit a job, then mid-run
`docker restart nirva-api` — the job must resume from its Postgres checkpoint.

## 5. Air-gapped demo mode (egress-denied)

The dev compose keeps loopback ports for convenience. For the demo, uncomment
the DEMO PROFILE block at the top of `infra/compose/docker-compose.yml`,
then:

```bash
docker compose -f infra/compose/docker-compose.yml --profile demo up -d
bash scripts/verify-no-egress.sh   # must PASS with zero leaks
```

Optionally disconnect the host NIC entirely for belt-and-braces.

## 6. Evaluations (Phase 5)

```bash
bash scripts/run-evals.sh
```

Requires AI-lane fixtures at `data/synthetic/evals/`; writes results to
`docs/eval-results/`. Gate: Recall@5 >= 0.85.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `nirva-api` unhealthy | `docker logs nirva-api`; usually postgres/qdrant still warming or bad `.env` |
| Qdrant healthcheck fails | image lacks wget on some versions — pin v1.12.4 as this file does |
| Model pull fails | you are offline before bootstrap step 2 — reconnect once, re-run script |
| Port already bound | compose binds only 127.0.0.1; free the port or change mapping |
