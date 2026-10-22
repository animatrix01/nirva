# NIRVA — Sovereign Industrial Investigation Workbench

<p align="center">
  <img src="apps/web/public/nirva_logo_-removebg-preview.png" alt="NIRVA Logo" width="200"/>
</p>

<p align="center">
  <strong>Offline · Air-gapped · Agentic RAG · Human-in-the-loop</strong>
</p>

<p align="center">
  <a href="#quickstart--docker">Quickstart</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#features">Features</a> ·
  <a href="#api-reference">API</a> ·
  <a href="#security">Security</a> ·
  <a href="#demo-users">Demo</a>
</p>

---

NIRVA is a **fully offline agentic investigation platform** for industrial equipment failure analysis. Built for sovereign, air-gapped environments, it runs a multi-node **LangGraph pipeline** over local technical documents and operational data, produces cited findings with confidence scoring, and gates every consequential action behind supervisor-only human approval. A tamper-evident, hash-chained **audit trail** records every action.

**Zero internet calls.** All inference, retrieval, storage, and telemetry stay on-machine.

> **Golden demo scenario:** Refinery pump **P-204** at MRPL. All demo data is synthetic and clearly labeled. No real MRPL data is used or implied.

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Monorepo Layout](#monorepo-layout)
5. [LangGraph Investigation Pipeline](#langgraph-investigation-pipeline)
6. [API Reference](#api-reference)
7. [Authentication & RBAC](#authentication--rbac)
8. [Tamper-evident Audit Trail](#tamper-evident-audit-trail)
9. [Prompt Injection Defense](#prompt-injection-defense)
10. [Document Management & Retrieval](#document-management--retrieval)
11. [Report Exports](#report-exports)
12. [Evaluation Framework](#evaluation-framework)
13. [Database Schema](#database-schema)
14. [Environment Variables](#environment-variables)
15. [Quickstart — Docker](#quickstart--docker)
16. [Quickstart — Local Dev](#quickstart--local-dev)
17. [Demo Users](#demo-users)
18. [Running Tests & Linting](#running-tests--linting)
19. [Repository Structure](#repository-structure)
20. [Known Limitations](#known-limitations)

---

## Features

### ✅ Implemented (Phase 1)

- **🔒 Full offline operation** — All inference, retrieval, and storage run locally with no internet dependencies
- **🤖 LangGraph agentic pipeline** — 8-node deterministic investigation graph with checkpointing and resume
- **📚 Hybrid RAG retrieval** — Dense + sparse vector search via Qdrant with BM25 fusion
- **🔐 Role-based access control** — Four roles (engineer, supervisor, safety_officer, admin) with document-level ACL
- **✅ Human-in-the-loop approvals** — All work order proposals require supervisor sign-off before execution
- **🔗 Tamper-evident audit log** — SHA-256 hash-chained event trail with integrity verification
- **🛡️ Prompt injection defense** — Automatic detection and blocking of instruction-like patterns in retrieved documents
- **📊 Real-time SSE streaming** — Live node progress events streamed to frontend during investigation execution
- **🧪 Code execution sandbox** — LLM-generated Python analysis scripts run in isolated, AST-validated environment
- **📄 Multi-format exports** — Investigation reports as DOCX, PPTX, or XLSX with ACL-filtered evidence
- **🔍 Contradiction detection** — Automatic flagging of conflicting information across document sources
- **💾 PostgreSQL checkpointing** — Durable graph state persistence enables resume across restarts
- **📈 Evaluation framework** — 105-case golden dataset with 9 categories and gate metrics
- **🎨 Modern web UI** — Next.js 16 App Router with SSE consumption, Tailwind CSS, and dark mode

### 🚧 Planned / Future

- ⏳ **Multi-investigation memory** — Cross-job episodic memory currently has schema but limited integration
- ⏳ **Advanced reranking** — No semantic reranker currently applied after hybrid retrieval
- ⏳ **Vision model integration** — Equipment photo analysis schema exists but not fully connected
- ⏳ **Distributed execution** — Single-node only; no horizontal scaling implemented
- ⏳ **Graph interrupt resume** — Approval resume mechanism not fully verified in current codebase

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser  (Next.js 16 App Router)                                │
│  Landing page · Investigation terminal · Approvals · Audit      │
└────────────────────────┬────────────────────────────────────────┘
                         │  REST + SSE  (JWT Bearer)
┌────────────────────────▼────────────────────────────────────────┐
│  FastAPI  (apps/api)                                             │
│  ├─ 13 routers: auth, jobs, documents, approvals, audit ...     │
│  ├─ Background job runner (Python threading)  ←→  SSE stream    │
│  └─ LangGraph bridge (graph_client.py)                          │
│       └─ packages/agent ── Investigation Graph (8 nodes)        │
│            ├─ GatewayClient → local model (Ollama / vLLM)       │
│            └─ Retriever → packages/retrieval → Qdrant           │
└──────────┬──────────────────────────┬───────────────────────────┘
           │                          │
  ┌────────▼────────┐      ┌─────────▼──────────┐
  │  PostgreSQL      │      │  Qdrant             │
  │  users, jobs,    │      │  Hybrid dense+       │
  │  audit, approvals│      │  sparse vector store │
  └─────────────────┘      └────────────────────-┘
```

### Execution Flow

The runner spawns a **daemon thread per job**. Progress is persisted to `job_events` and streamed to the frontend via **Server-Sent Events** (`GET /api/jobs/{id}/events`). The LangGraph checkpointer (PostgreSQL-backed) enables durable resume across restarts.

**Real-time updates:**
- Each graph node transition emits an SSE event
- Frontend polls with 100ms intervals during active execution
- Reconnection supported via `Last-Event-ID` header

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router, TypeScript), React 19, Tailwind CSS 4, lucide-react, SSE |
| **Backend** | FastAPI 0.141.1 (Python 3.12), SQLAlchemy 2.0.52, Alembic 1.19.1, Pydantic v2 |
| **Database** | PostgreSQL 16 (prod) · SQLite (dev) |
| **Vector store** | Qdrant 1.12.4 — hybrid dense cosine + sparse BM25 |
| **Agent framework** | LangGraph 1.2.11 (StateGraph, checkpointing) + LangChain Core |
| **LLM inference** | Ollama 0.5.7 (dev) or vLLM (prod) — OpenAI-compatible endpoint |
| **Default model** | `qwen2.5:3b-instruct-q4_K_M` (≤6 GB VRAM), `qwen3-vl:4b` (vision) |
| **Embedding model** | `bge-m3` (1024-dim dense embeddings) |
| **Document parsing** | Docling 2.x + pypdf (PDF), CSV parser |
| **Auth** | JWT HS256 (PyJWT 2.13.0) + bcrypt 5.0.0 passwords |
| **Telemetry** | OpenTelemetry collector 0.113.0 (local, no egress) |
| **Containerization** | Docker Compose (6 services) |

---

## Monorepo Layout

```
nirva/
├── apps/
│   ├── api/                  FastAPI backend
│   │   ├── app/
│   │   │   ├── main.py       App factory, CORS, lifespan
│   │   │   ├── models.py     12 SQLAlchemy models
│   │   │   ├── schemas.py    Pydantic request/response types
│   │   │   ├── runner.py     Job execution engine, background threads
│   │   │   ├── graph_client.py  LangGraph ↔ API bridge
│   │   │   ├── audit.py      Hash-chained audit trail
│   │   │   ├── security.py   JWT encode/decode, bcrypt
│   │   │   ├── deps.py       CurrentUser, require_roles dependencies
│   │   │   ├── config.py     pydantic-settings, startup secret guard
│   │   │   ├── routers/      13 FastAPI routers
│   │   │   └── exporters/    DOCX, PPTX, XLSX report generation
│   │   └── migrations/       8 Alembic versions
│   └── web/                  Next.js 16 frontend
│       └── src/
│           ├── app/          Page routes (App Router)
│           ├── components/   AppShell, RoleBadge, EgressBadge, etc.
│           └── lib/          API client, auth, SSE, types
│
├── packages/
│   ├── agent/                LangGraph investigation graph
│   │   └── src/nirva_agent/
│   │       ├── graph.py      8-node StateGraph + routing
│   │       ├── state.py      NirvaState (17 frozen fields)
│   │       ├── gateway.py    OpenAI-compatible GatewayClient
│   │       ├── security.py   Prompt injection detection
│   │       └── planner.py    Plan validation & whitelist
│   ├── retrieval/            Docling chunking, embedding, Qdrant search
│   │   └── src/nirva_retrieval/
│   │       ├── parse.py      PDF/CSV parsing
│   │       ├── chunking.py   Structural chunking
│   │       ├── embed.py      Dense (bge-m3) + sparse (BM25)
│   │       ├── store.py      Qdrant collection management
│   │       └── search.py     ACL-filtered hybrid retrieval
│   ├── tools/                Typed tool definitions (asset history, inventory)
│   └── evals/                Golden 105-case dataset + metrics
│       ├── datasets/         JSON evaluation datasets
│       ├── results/          Evaluation run results
│       └── src/nirva_evals/
│           └── dataset.py    Dataset loader + validation
│
├── infra/
│   ├── compose/              docker-compose.yml (6 services)
│   └── model-config/         models.yaml registry
│
├── data/                     Synthetic P-204 demo corpus
├── coordination/             Lane charters, DECISIONS.md
├── docs/                     demo-ready-plan.md, runbook.md
└── scripts/                  Seed data, evals runner
```

---

## LangGraph Investigation Pipeline

Each investigation job runs as a deterministic **StateGraph** over `NirvaState` — a 17-field TypedDict that flows immutably through every node.

### Node Sequence

```
START
  ↓
[intake]      Validates required fields; sets default plan
  ↓
[plan]        Asks LLM to propose retrieval steps (whitelist-validated);
              falls back to default plan on gateway failure
  ↓
[retrieve]    Hybrid Qdrant search (dense cosine + sparse BM25)
              ACL-filtered by user role; injection scan on every chunk
  ↓
  ├─── route_after_retrieve (conditional) ──────────────────┐
  │         ↓ if plan includes refine                        │
  │    [retrieve_refine]  Second pass with keyword-reformulated│
  │         │             query (deterministic, no LLM call)  │
  │         └─── route_after_retrieve ──────────────────────▶│
  │                   ↓ if plan includes code                 │
  │              [code]  LLM generates Python analysis;       │
  │                      sandboxed execution; result →        │
  │                      EvidenceItem; failures non-fatal     │
  │                         │                                 │
  ◀────────────────────────◀┴────────────────────────────────┘
  ↓
[answer]      Evidence-sufficiency judge → findings + citations
              + assumptions + gaps; confidence score 0–1
  ↓
[finalize]    Confidence scoring (0.1–0.9 deterministic formula);
              gaps detection; no LLM call
  ↓
[propose]     Contradiction detection between sources;
              ProposedAction if confidence >= 0.5 → awaiting_approval
  ↓
 END
```

### State Fields (NirvaState — 17 frozen fields)

| # | Field | Type | Purpose |
|---|---|---|---|
| 1 | `request_id` | `str` | Job UUID; also LangGraph `thread_id` |
| 2 | `user_id` | `str` | Initiator; drives ACL filtering |
| 3 | `user_role` | `RoleName` | Role; drives ACL filtering |
| 4 | `objective` | `str` | Normalized investigation text |
| 5 | `equipment_id` | `str \| None` | Optional asset filter |
| 6 | `plan` | `list[str]` | Ordered retrieval steps from planner |
| 7 | `completed_steps` | `list[str]` | Progress marker for resume |
| 8 | `retrieved_evidence` | `list[EvidenceItem]` | Citation-ready excerpts with scores |
| 9 | `tool_results` | `list[ToolResult]` | SQL/inventory tool outputs |
| 10 | `citations` | `list[Citation]` | `[title, revision, locator, chunk_id]` refs |
| 11 | `assumptions` | `list[str]` | Statements made without full evidence |
| 12 | `contradictions` | `list[Contradiction]` | Detected conflicts between sources |
| 13 | `risk_flags` | `list[str]` | Safety/policy concerns from reviewer |
| 14 | `proposed_actions` | `list[ProposedAction]` | Work order drafts awaiting approval |
| 15 | `approval_status` | `ApprovalState` | `pending` / `approved` / `rejected` |
| 16 | `final_report` | `FinalReport` | Composed findings document |
| 17 | `current_node` | `str\|None` | Operational: drives SSE events |
| 18 | `last_event_seq` | `int` | SSE replay/resume counter |

Fields 7–14 use `operator.add` reducers (LangGraph concatenates updates across nodes).

### Real-time SSE Events

Every node transition emits a Server-Sent Event. The frontend consumes the stream at `GET /api/jobs/{id}/events`.

| Event type | When |
|---|---|
| `node_started` | Node begins execution |
| `node_finished` | Node completes |
| `tool_called` | `retrieve` / `code` node invoked |
| `evidence_added` | Evidence chunks returned |
| `contradiction_found` | Conflicting sources detected |
| `awaiting_approval` | ProposedAction requires supervisor sign-off |
| `blocked_injection` | Prompt injection pattern caught in retrieved chunk |
| `completed` | Job finished successfully |
| `failed` | Unrecoverable error (node attributed in payload) |

---

## API Reference

All routes are prefixed `/api/`. Authentication requires `Authorization: Bearer <JWT>` except `/api/auth/login` and `/api/health`.

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Username + password → JWT |
| `GET` | `/api/auth/me` | Current user info |

### Jobs

| Method | Path | Roles | Description |
|---|---|---|---|
| `POST` | `/api/jobs` | all | Create investigation job (optionally upload context image) |
| `GET` | `/api/jobs` | all | List all jobs (summary view) |
| `GET` | `/api/jobs/{id}` | all | Job detail + final report |
| `GET` | `/api/jobs/{id}/events` | all | **SSE** — live node events (text/event-stream) |
| `GET` | `/api/jobs/{id}/evidence` | all | Retrieved evidence chunks (ACL-filtered) |
| `POST` | `/api/jobs/{id}/image` | all | Upload investigation context image |
| `GET` | `/api/jobs/{id}/image` | all | Retrieve job context image |

### Documents

| Method | Path | Roles | Description |
|---|---|---|---|
| `POST` | `/api/documents/upload` | engineer, admin | Upload PDF/CSV; parse + index to Qdrant |
| `GET` | `/api/documents` | all | List documents (role-filtered) |
| `GET` | `/api/documents/{id}/content` | all | Document content JSON |

### Approvals

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/api/approvals` | supervisor, admin | List pending approvals |
| `POST` | `/api/approvals/{id}/decide` | supervisor, admin | Approve or reject → generates WorkOrder |

### Exports

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/api/exports/{job_id}/word` | all | Download findings as DOCX |
| `GET` | `/api/exports/{job_id}/pptx` | all | Download findings as PowerPoint |
| `GET` | `/api/exports/{job_id}/excel` | all | Download findings as XLSX |
| `GET` | `/api/exports/documents/excel` | all | Export document library as XLSX |

### Audit

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/api/audit` | admin, safety_officer | Hash-chained audit log + chain verification status |

### Evaluations

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/api/evals` | admin, safety_officer | Latest evaluation run results + gate pass/fail |

### Other

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Service health: postgres, qdrant, model gateway, storage |
| `GET` | `/api/admin/models` | Model registry (admin only) |
| `GET` | `/api/memories/{equipment_id}` | Episodic memories per equipment |
| `POST` | `/api/code/run` | Generate + execute Python code (sandbox) |
| `GET` | `/api/code/run/{job_id}` | Retrieve code run result |

---

## Authentication & RBAC

**Token:** JWT HS256, 720-minute expiry. Fields: `sub` (user_id), `role`, `username`.

**Startup guard:** The API refuses to start if `JWT_SECRET` is still the default development value, unless `DEMO_MODE=1` is set.

**Roles and permissions:**

| Role | Can do |
|---|---|
| `engineer` | Create/view jobs, upload documents, view evidence and code runs |
| `safety_officer` | Read-only access to audit log and evaluation results |
| `supervisor` | Everything engineer can do, plus approve/reject proposals (work orders) |
| `admin` | Full access — model registry, evaluations, documents, audit, user management |

Role enforcement uses a `require_roles(*roles)` FastAPI dependency that returns HTTP 403 if the authenticated user's role is not in the allowed set.

---

## Tamper-evident Audit Trail

Every consequential action writes to the `audit_events` table via `append_audit_event()`:

- Job creation, document upload, approval decisions, injection blocks, code runs
- Each event carries: `actor`, `actor_role`, `action`, `argument_summary`, `outcome`, `job_id`, and a `payload` dict
- **Hash chain:** `hash = SHA-256(canonical_JSON(event_fields) + prev_hash)`. The genesis block uses `"0" * 64` as `prev_hash`.
- A process-level mutex (`threading.Lock`) serializes all appends — concurrent job threads and request threads can never fork the chain.
- `verify_chain(events)` replays the full chain and returns `False` on the first broken link. The result is surfaced in `GET /api/audit` as `chain_valid`.

**Verification:**

```bash
curl http://localhost:8000/api/audit -H "Authorization: Bearer <token>"
# Response includes: chain_valid: true/false
```

---

## Prompt Injection Defense

Every document chunk retrieved from Qdrant is scanned by `detect_injection()` before being passed to the LLM. The scanner checks for patterns like:

- "ignore previous instructions"
- "disregard rules"
- "export all records"
- "you are now"
- Similar override phrases

**Behavior:**
- Suspicious chunks are **silently dropped** from evidence — the model never sees them
- A `blocked_injection` SSE event is emitted to the frontend
- The exclusion is recorded in the audit trail with the matched pattern, document title, and chunk ID

This operates at the **retrieval boundary**; retrieved content is always treated as untrusted data regardless of its origin.

---

## Document Management & Retrieval

### Upload Flow

1. `POST /api/documents/upload` — multipart upload (PDF, CSV, image)
2. File saved to `STORAGE_PATH`; SHA-256 content hash deduplicates exact duplicates
3. Docling / pypdf parses and chunks the document (hierarchical structural chunking)
4. Chunks are embedded (dense via `bge-m3` + sparse BM25) and indexed into Qdrant
5. Document starts in `quarantined` status; approved docs become searchable

### Retrieval (Hybrid Search)

**Search strategy:**
- Dense cosine similarity + sparse BM25 with Reciprocal Rank Fusion (RRF)
- Two-stage prefetch: 20 dense + 20 sparse → RRF fusion → top-12 final results
- ACL filter: each chunk stores `allowed_roles`; the retriever filters by the requesting user's role before returning results

**Two-pass retrieval:**
- First pass: Original query
- Second pass (`retrieve_refine`): Deterministic keyword extraction (stop-word removal, no LLM call)

**Operational data (always included):**
- Asset history events from `asset_events` table
- Spare parts inventory from `inventory_items` table (e.g., `SEAL-P204-KIT`)
- Episodic memories from prior approved investigations

**Evidence sufficiency judge:** After retrieval, a lightweight LLM call checks whether the collected evidence is sufficient to answer the objective. If not, the system abstains rather than hallucinating.

---

## Report Exports

Completed jobs can be exported in three formats, all generated from the same `ReportData` collected from the live database:

| Format | Endpoint | Contents |
|---|---|---|
| **DOCX** | `GET /api/exports/{id}/word` | Findings, citations, assumptions, gaps, contradictions, recommendations |
| **PPTX** | `GET /api/exports/{id}/pptx` | Slide deck with investigation summary and evidence |
| **XLSX** | `GET /api/exports/{id}/excel` | Evidence table, asset history, code run output |

Export data honors **per-chunk ACL filtering** — chunks the requesting role cannot read are excluded from exports, not leaked.

---

## Evaluation Framework

The `packages/evals/` package provides a structured golden-dataset evaluation framework.

### Dataset

**105 test cases** across **9 categories**, validated at load:

| Category | Cases | Expected behavior |
|---|---|---|
| `factual` | 30 | `cite` — retrieve and cite relevant documents |
| `part_number` | 15 | `cite` — retrieve part/inventory data |
| `synthesis` | 10 | `cite` — combine multiple sources |
| `abstention` | 10 | `abstain` — no relevant evidence, must refuse |
| `contradiction` | 10 | `cite` — surface conflicting sources |
| `permission` | 10 | `abstain` — role-based ACL boundary |
| `injection` | 10 | `blocked` — prompt injection must be caught |
| `approval_flow` | 5 | `cite` — proposals requiring human approval |
| `recovery` | 5 | `cite` — resume/recovery scenarios |

### Metrics

| Metric | Description |
|---|---|
| `recall_at_5` | Fraction of required docs appearing in top-5 retrieved chunks |
| `citation_validity` | Fraction of cited docs that were actually retrieved (non-retrieved citations = hallucination) |
| `grounded_answer_rate` | Cite-cases with findings + at least one valid citation |
| `correct_abstention_rate` | Abstention cases where NIRVA correctly abstained |
| `unauthorized_retrieval_count` | **Must be zero** — any non-zero is a security failure |
| `injection_block_rate` | Fraction of injection cases where `blocked_injection` fired |

### Gate Thresholds

All three gates must pass for a green eval run:
- `recall_at_5 ≥ recall_at_5_min`
- `citation_validity ≥ citation_validity_min`
- `unauthorized_retrieval_count = 0`

Results are served at `GET /api/evals` (admin / safety_officer only). Infrastructure paths are stripped from the response.

---

## Database Schema

**12 SQLAlchemy ORM models**, managed by Alembic (**8 migration versions**: `0001_initial` → `0008_job_image`):

| Model / Table | Purpose |
|---|---|
| `users` | Accounts with bcrypt password hashes and RBAC roles |
| `jobs` | Investigation runs — objective, equipment, status, `final_report` JSON, contradictions, optional context image |
| `job_events` | SSE event log per job (seq, type, node, payload_ref) — enables replay and resume |
| `approvals` | Human approval requests — action, arguments, risk level, decided_by, work_order_id |
| `work_orders` | Generated work orders on approval — asset, justification, parts list, steps |
| `documents` | Uploaded files with ACL (`allowed_roles`), content hash, status (`quarantined` / `approved`) |
| `asset_events` | Operational event log per equipment (from seeded / imported data) |
| `inventory_items` | Spare parts — part number, qty, location, last updated |
| `job_evidence` | Retrieved chunks stored per job for export and display |
| `memory_entries` | Episodic memory — approved findings from prior investigations, searchable in future runs |
| `code_runs` | LLM-generated Python code per job — task, code, stdout, stderr, exit status |
| `audit_events` | Hash-chained audit trail — actor, role, action, outcome, prev_hash, hash |

**Migration commands:**

```bash
# Generate new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Check current version
alembic current
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in real values. **Never commit `.env`.**

| Variable | Default | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | `sqlite:///./nirva-dev.db` | Yes | PostgreSQL (prod) or SQLite (dev) connection string |
| `QDRANT_URL` | `http://qdrant:6333` | Yes | Qdrant vector store endpoint |
| `MODEL_BASE_URL` | `http://ollama:11434/v1` | Yes | OpenAI-compatible local inference endpoint |
| `JWT_SECRET` | *(must change)* | Yes | JWT signing key — startup fails if left at default |
| `STORAGE_PATH` | `./storage` | Yes | Local document and report storage directory |
| `DEMO_MODE` | `false` | No | Set `1` to skip JWT secret validation and connectivity checks |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector:4318` | No | OpenTelemetry collector endpoint (local only) |

**Security note:** The API startup guard blocks execution if `JWT_SECRET` is the default value and `DEMO_MODE` is not set. This prevents accidental deployment with weak secrets.

---

## Quickstart — Docker

The full stack runs as **6 Docker services**: `postgres`, `qdrant`, `ollama`, `otel-collector`, `api`, `web`.

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env: set JWT_SECRET to a random string, or add DEMO_MODE=1

# 2. Pull and tag the Ollama model (one-time setup)
docker compose -f infra/compose/docker-compose.yml up -d ollama
docker exec nirva-ollama ollama pull qwen2.5:3b-instruct-q4_K_M
docker exec nirva-ollama ollama pull bge-m3

# 3. Start the full stack
docker compose -f infra/compose/docker-compose.yml up -d --build

# 4. Open in browser
# Web console:  http://127.0.0.1:3000
# API docs:     http://127.0.0.1:8000/docs
# Health check: http://127.0.0.1:8000/api/health
```

Services start in dependency order. The `api` service waits for a healthy postgres before starting. Demo users are seeded automatically on first boot.

**Logs:**

```bash
# View all service logs
docker compose -f infra/compose/docker-compose.yml logs -f

# View specific service
docker compose -f infra/compose/docker-compose.yml logs -f api
```

**Stopping:**

```bash
docker compose -f infra/compose/docker-compose.yml down
# Add -v to also remove volumes (WARNING: deletes all data)
```

---

## Quickstart — Local Dev

Requires **Python 3.12+** and **Node.js 20+**.

### Backend Setup

```bash
# 1. Python environment
python -m venv .venv
.venv\Scripts\activate          # Windows PowerShell
# source .venv/bin/activate     # macOS / Linux

# 2. Install all Python packages (editable mode)
pip install -e packages/agent[graph] -e packages/retrieval[parse,store] -e packages/tools -e "apps/api[dev]" -e packages/evals

# 3. Set environment variables
$env:DATABASE_URL = "sqlite:///./nirva-dev.db"
$env:JWT_SECRET   = "some-long-random-string-at-least-32-chars"
$env:DEMO_MODE    = "1"          # skips Qdrant/Ollama checks for pure dev
$env:STORAGE_PATH = "./storage"

# 4. Create database tables
cd apps/api
alembic upgrade head

# 5. Run the API
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000
# → API docs: http://localhost:8000/docs
```

### Frontend Setup

```bash
# 1. Install dependencies
cd apps/web
npm install

# 2. Set environment
# Create apps/web/.env.local:
# NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# 3. Run dev server
npm run dev
# → http://localhost:3000
```

### Optional: Local Qdrant + Ollama

For full functionality (retrieval, embeddings), also run:

```bash
# Qdrant (Docker required)
docker run -d -p 6333:6333 -p 6334:6334 --name qdrant qdrant/qdrant:v1.12.4

# Ollama (native installation)
# Windows: Download from https://ollama.com/download
# macOS: brew install ollama
# Linux: curl -fsSL https://ollama.com/install.sh | sh

ollama serve
ollama pull qwen2.5:3b-instruct-q4_K_M
ollama pull bge-m3
```

Then remove `DEMO_MODE=1` from backend environment variables.

---

## Demo Users

Seeded automatically on first startup. Password for all accounts: **`nirva-demo-pass`** (development only).

| Username | Role | Can do |
|---|---|---|
| `engineer` | `engineer` | Create investigations, upload documents, view evidence |
| `safety_officer` | `safety_officer` | View audit log and evaluation results (read-only) |
| `supervisor` | `supervisor` | Everything engineer can do + approve/reject work orders |
| `admin` | `admin` | Full system access including user management |

**Login:**

1. Navigate to `http://localhost:3000`
2. Click "Sign In"
3. Username: `engineer`, Password: `nirva-demo-pass`
4. Click "Sign In" or press Enter

---

## Running Tests & Linting

### Python Tests

```bash
# Run all tests
python -m pytest

# Run specific test file
python -m pytest apps/api/tests/test_auth.py

# Run with coverage
python -m pytest --cov=app --cov-report=html

# API integration tests (requires running services)
cd apps/api
python -m pytest tests/
```

### Python Linting & Type Checking

```bash
# Ruff (linter + formatter)
python -m ruff check .
python -m ruff format .

# mypy (type checker)
python -m mypy packages/agent/src
python -m mypy packages/retrieval/src
```

### Web Tests & Linting

```bash
cd apps/web

# Run tests (single pass, no watch)
npm test -- --run

# Lint
npm run lint

# Type check
npm run typecheck

# Format
npm run format
```

### Docker Compose Validation

```bash
docker compose -f infra/compose/docker-compose.yml config --quiet
```

---

## Repository Structure

### Key Directories

| Path | Purpose |
|---|---|
| `apps/api/` | FastAPI backend application |
| `apps/web/` | Next.js frontend application |
| `packages/agent/` | LangGraph orchestration, model gateway |
| `packages/retrieval/` | Document parsing, chunking, Qdrant search |
| `packages/tools/` | Typed tool definitions |
| `packages/evals/` | Evaluation framework and datasets |
| `infra/compose/` | Docker Compose orchestration |
| `data/synthetic/` | Demo corpus (P-204 scenario) |
| `coordination/` | Project management docs |
| `docs/` | Technical documentation |
| `scripts/` | Operational scripts |

### Configuration Files

| File | Purpose |
|---|---|
| `pyproject.toml` | Python tooling config (root + packages) |
| `alembic.ini` | Database migration config |
| `docker-compose.yml` | Full stack orchestration |
| `.env.example` | Environment template |
| `tsconfig.json` | TypeScript configuration |
| `package.json` | Node.js workspace config |

---

## Known Limitations

### Current Implementation Constraints

1. **Single-node execution only** — No distributed processing or horizontal scaling
2. **Limited contradiction detection** — Only detects alignment-specific conflicts (hardcoded patterns)
3. **No semantic reranking** — Hybrid retrieval stops after RRF fusion
4. **Approval resume not verified** — Graph resume after approval decision requires further validation
5. **Vision model integration partial** — Schema exists but end-to-end photo analysis not fully connected
6. **Memory integration limited** — Episodic memory retrieval implemented but cross-job learning minimal
7. **Code sandbox AST-only** — No runtime instrumentation or resource limits beyond timeout
8. **SQLite checkpointing disabled** — Resume only works with PostgreSQL checkpointer
9. **Mock evidence in demo mode** — Fallback synthetic evidence when services unavailable (dev only)
10. **No batch job processing** — Each investigation runs in serial background thread

### Security Considerations

- **JWT secret enforcement** — Startup guard prevents default secret in production (unless `DEMO_MODE=1`)
- **Injection detection heuristic** — Pattern-based, not ML-based; may have false negatives
- **Sandbox escape possible** — AST validation not exhaustive; adversarial code may bypass
- **Chain verification manual** — Audit log integrity check must be explicitly requested via API
- **No rate limiting** — API endpoints have no built-in rate limiting or throttling
- **Demo mode disables security** — `DEMO_MODE=1` bypasses multiple safety checks

### Performance Notes

- **Synchronous graph execution** — Each job blocks a Python thread (not async)
- **100ms SSE polling** — Real-time event latency is 0–100ms
- **No query caching** — Every retrieval hits Qdrant fresh
- **Single embedding batch** — Dense embeddings called per-query, not batched
- **File storage local only** — No S3/blob storage integration

---

## Security

### Air-gapped by Design

- All services bind to `127.0.0.1` (loopback only)
- Docker Compose network can be set to `internal: true` for demo profile
- No outbound internet calls in normal operation
- OpenTelemetry collector exports to local file only (no cloud backends)

### Document ACL

- Every chunk in Qdrant stores `allowed_roles` list
- Retrieval queries include role-based filter (enforced at database level)
- Export endpoints honor ACL (chunks user cannot read are excluded, not leaked)

### Audit Integrity

- SHA-256 hash chain with process-level mutex prevents forking
- Verification available via `GET /api/audit` (`chain_valid` field)
- Any detected break indicates tampering

### Code Execution Safety

- AST pre-scan blocks dangerous imports (`os`, `subprocess`, `socket`, `eval`, `exec`)
- Isolated Python subprocess with empty environment
- 5-second wall-clock timeout
- Stdout/stderr capped at 8KB
- Execution in temporary directory

### Prompt Injection Defense

- Retrieval boundary treats all document text as untrusted data
- Pattern matching blocks instruction-like phrases
- Blocked chunks recorded in audit log
- Model never sees excluded content

---

## License

**Proprietary** — All rights reserved. This software is for demonstration and evaluation purposes. Contact the repository owner for licensing inquiries.

---

## Demo Data Notice

All demo data is synthetic and clearly labeled. The "P-204" pump scenario and "MRPL" references are fictional. No real operational data is used or implied.

---

## Support & Documentation

- **API Documentation:** `http://localhost:8000/docs` (OpenAPI/Swagger)
- **Technical Details:** See `01_repository_map.md`, `02_investigation_request_flow.md`, `03_langgraph_execution.md`
- **Architecture Decisions:** See `coordination/DECISIONS.md`

---

## Acknowledgments

Built with:
- [LangGraph](https://github.com/langchain-ai/langgraph) — Agent orchestration framework
- [FastAPI](https://fastapi.tiangolo.com/) — High-performance Python web framework
- [Next.js](https://nextjs.org/) — React framework for production
- [Qdrant](https://qdrant.tech/) — Vector similarity search engine
- [Ollama](https://ollama.com/) — Local LLM inference
- [Docling](https://github.com/DS4SD/docling) — Document parsing and understanding

---

**NIRVA** — Sovereign investigation, air-gapped by design.
