# NIRVA — Sovereign Industrial Investigation Workbench

Offline, air-gapped agentic RAG workbench for **SIH26117** (MRPL). NIRVA investigates
equipment failures (golden scenario: refinery pump **P-204**) over local documents and
operational data, produces cited findings, and gates every consequential action behind
human approval with a tamper-evident audit trail. **Zero internet calls** — all inference,
retrieval, storage, and telemetry stay on-machine.

See `COMMON.md` for the frozen contracts every lane codes against, and
`docs/demo-ready-plan.md` for the sprint scope (Phases 0–4).

## Architecture

```text
Next.js console  ──REST+SSE──>  FastAPI API
                                  ├─ LangGraph investigation graph (packages/agent)
                                  │    ├─ local model via MODEL_BASE_URL (Ollama/vLLM)
                                  │    ├─ Qdrant hybrid retrieval (packages/retrieval)
                                  │    └─ approval interrupt (supervisor-only)
                                  ├─ PostgreSQL: users, jobs, checkpoints, approvals, audit
                                  └─ Local storage: uploaded + synthetic documents
```

## Requirements

- Python 3.12+
- Node.js 20+ (web)
- Docker Desktop (full stack; `winget install Docker.DockerDesktop` on Windows)
- Ollama with a local model (demo plan primary: `qwen3-vl:4b-instruct-q4_K_M`)

## Quickstart (Docker)

```bash
cp .env.example .env          # then set a real JWT_SECRET (or DEMO_MODE=1)
docker compose -f infra/compose/docker-compose.yml up -d --build
# web: http://127.0.0.1:3000   api: http://127.0.0.1:8000/api/health
```

## Quickstart (local dev)

```bash
python -m venv .venv
.venv\Scripts\activate                    # Windows PowerShell
pip install -e packages/agent -e packages/retrieval -e "apps/api[dev]"

# apps/api
set DATABASE_URL=sqlite:///./nirva-dev.db   # or a PostgreSQL URL
set JWT_SECRET=some-long-random-string
uvicorn app.main:app --reload --port 8000   # run from apps/api/

# apps/web
cd apps/web && npm install && npm run dev
```

## Demo users (seeded automatically)

| Username | Role |
|---|---|
| `engineer` | engineer |
| `safety_officer` | safety_officer |
| `supervisor` | supervisor |
| `admin` | admin |

Password: `nirva-demo-pass` (development/demo only).

## Environment variables

| Var | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL (or SQLite for dev) connection string |
| `QDRANT_URL` | Qdrant endpoint |
| `MODEL_BASE_URL` | OpenAI-compatible local inference (Ollama dev / vLLM prod) |
| `JWT_SECRET` | JWT signing secret — never commit |
| `STORAGE_PATH` | Local document storage path |
| `DEMO_MODE` | Optional; allows default JWT secret in the offline demo profile |

## Commands

```bash
python -m pytest                                              # all Python tests
python -m ruff check . && python -m mypy .                    # lint + types
cd apps/web && npm run lint && npm run typecheck && npm test  # web checks
docker compose -f infra/compose/docker-compose.yml config --quiet
```

## Repository map

```text
apps/       web (Next.js) · api (FastAPI)
packages/   agent (LangGraph) · retrieval (Docling/Qdrant) · tools (typed tools)
infra/      compose · model-config
data/       synthetic (P-204 demo corpus)
coordination/  lane charters, statuses, DECISIONS.md
docs/       demo-ready-plan.md · runbook.md
```

All demo data is synthetic and clearly labeled. No real MRPL data is used or implied.
