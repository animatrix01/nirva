# NIRVA — COMMON.md (SINGLE SOURCE OF TRUTH)

> **Project:** NIRVA — SIH Problem Statement PSC26117, for Mangalore Refinery and Petrochemicals Limited (MRPL).
> **Status:** FROZEN. Only the INFRA lane may edit this file, and only via the proposal process in `coordination/DECISIONS.md`.
> Every lane reads this file fully at the start of every session. Parallel lanes code against the frozen contracts below WITHOUT talking to each other.

---

## a) PRODUCT SUMMARY

NIRVA is an **offline, air-gapped industrial investigation workbench** — not a chatbot. It runs entirely inside the organization's network (MRPL refinery context): no cloud AI services, no cloud embeddings, no cloud telemetry, ever.

**Golden workflow (the flagship demo):** an engineer submits:

> "Investigate why Pump P-204 has failed repeatedly. Compare its maintenance history with the OEM manual and safety SOP, check spare-part availability, and prepare a cited maintenance recommendation."

The system then:
1. Shows a visible, bounded investigation plan.
2. Retrieves evidence from manuals, SOPs, incident reports, work orders, sensor tables, and equipment images — every piece with page/section citations.
3. Queries approved read-only operational tools.
4. Detects missing or CONTRADICTORY evidence and surfaces conflicts instead of hiding them.
5. Produces a cited recommendation with confidence, assumptions, and gaps; abstains when evidence is insufficient.
6. PAUSES at a human approval gate before any consequential action (e.g., work-order creation). Zero bypass.
7. Writes a tamper-evident hash-chained audit record.

**Sovereignty is binary.** If ANY essential model, embedding, telemetry, auth, or storage call reaches the internet, we do not call the system air-gapped. Zero internet calls. Non-negotiable.

Other non-negotiable principles:
- Never retrieve first and filter later — ACL filtering happens DURING retrieval.
- Every operational claim cites its source or is labeled an assumption.
- Retrieved content is EVIDENCE, not instructions (prompt-injection defense by zoning).
- Measure, don't claim. Abstention is success when evidence is thin.
- No consequential action without human approval. Ever.

---

## b) STACK TABLE (from Winning Plan §8)

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js App Router, TypeScript, Tailwind, shadcn/ui | Strong dashboard UX, typed components |
| API | FastAPI + Pydantic | Python AI ecosystem; explicit validated schemas |
| Workflow | LangGraph | Durable graphs, checkpoints, interrupts, memory |
| Inference | vLLM (prod) / Ollama-compatible gateway (dev), OpenAI-compatible API | Standard clients, local inference; engine swap via env var only |
| Retrieval | Qdrant | Dense + sparse + metadata-filtered multi-stage retrieval in one engine |
| Primary data | PostgreSQL | Transactions, permissions, audit data, LangGraph checkpoints |
| Parsing | Docling | Local PDF layout, OCR, and table extraction |
| Object storage | Filesystem (MVP) / MinIO | Local document storage with content hashes |
| Observability | OpenTelemetry + LOCAL collector | Vendor-neutral local traces/metrics — no cloud telemetry |
| Deployment | Docker Compose | Repeatable OFFLINE multi-service deployment |
| Tests | pytest + Playwright (+ vitest on web) | Backend/agent/security + UI verification |

---

## c) FROZEN CONTRACTS

Parallel agents implement against EXACTLY these definitions. Changing any of them requires a `[PROPOSAL]` in `coordination/DECISIONS.md` converted to `[DECISION]` by INFRA, then an edit of this file. Until then, code to what is written here.

### c.1 REST endpoints

All routes are prefixed `/api`. Auth via `Authorization: Bearer <JWT>` except login and health. Roles: `engineer`, `safety_officer`, `supervisor`, `admin`.

#### POST /api/auth/login
Request:
```json
{ "username": "str", "password": "str" }
```
Response 200:
```json
{
  "access_token": "str (JWT)",
  "token_type": "bearer",
  "user": { "user_id": "str (uuid)", "username": "str", "role": "engineer|safety_officer|supervisor|admin" }
}
```
Errors: 401 invalid credentials.

#### GET /api/auth/me
Response 200:
```json
{ "user_id": "str", "username": "str", "display_name": "str", "role": "str" }
```
Auth required. 401 otherwise.

#### POST /api/jobs
Request:
```json
{ "objective": "str", "equipment_id": "str|null" }
```
Response 201:
```json
{ "job_id": "str (uuid)", "status": "queued", "created_at": "iso8601" }
```
Auth required. Creates job row and starts the LangGraph run (thread_id = job_id).

#### GET /api/jobs
Query params: `status` (optional), `equipment_id` (optional), `limit` (int, default 50).
Response 200:
```json
[ { "job_id": "str", "objective_summary": "str (first 120 chars)", "status": "queued|running|awaiting_approval|completed|failed|blocked_injection", "created_by": "user_id", "created_at": "iso8601" } ]
```

#### GET /api/jobs/{id}
Response 200:
```json
{
  "job_id": "str", "objective": "str",
  "status": "queued|running|awaiting_approval|completed|failed|blocked_injection",
  "current_node": "str|null",
  "created_by": "user_id", "created_at": "iso8601", "updated_at": "iso8601",
  "final_report": { "findings": "str", "confidence": "float", "assumptions": ["str"], "gaps": ["str"], "citations": ["citation_ref"] } | null
}
```
404 if unknown id. Users see only their jobs unless role = supervisor/admin.

#### GET /api/jobs/{id}/events  (SSE)
Server-Sent Events stream of envelopes defined in §c.2, ordered by `seq`. Client reconnect sends `Last-Event-ID`; server replays from that seq. Content-Type: `text/event-stream`.

#### GET /api/documents
Query params: `department`, `equipment_id`, `type`.
Response 200:
```json
[ {
  "document_id": "str", "title": "str", "document_type": "manual|sop|work_order|incident|data",
  "revision": "str", "effective_date": "date", "department": "str", "equipment_id": "str|null",
  "confidentiality_level": "str", "content_hash": "sha256-hex", "status": "indexed|quarantined", "uploaded_at": "iso8601"
} ]
```
Filtered by caller's role ACL (documents whose allowed_roles exclude the caller never appear).

#### POST /api/documents/upload
Multipart form: `file` (binary) plus fields `title`, `document_type`, `revision`, `effective_date`, `department`, `equipment_id` (optional), `confidentiality_level`, `allowed_roles` (comma-separated subset of roles).
Response 201:
```json
{ "document_id": "str", "status": "indexed|quarantined", "content_hash": "sha256-hex", "duplicate": false }
```
Files are quarantined before parsing; exact-hash duplicates are rejected with `duplicate: true`.

#### GET /api/approvals
Supervisor/admin only.
Response 200:
```json
[ {
  "approval_id": "str", "job_id": "str", "proposal_id": "str",
  "action": "approve_work_order",
  "arguments_summary": "str (safe summary: asset, justification, parts, steps)",
  "evidence_refs": ["chunk_id"], "risk_level": "low|medium|high",
  "status": "pending|approved|rejected", "requested_at": "iso8601"
} ]
```

#### POST /api/approvals/{id}/decision
Supervisor only. Idempotent per approval_id — first decision wins atomically, duplicates rejected with 409.
Request:
```json
{ "decision": "approved|rejected", "comment": "str|null" }
```
Response 200:
```json
{ "approval_id": "str", "status": "approved|rejected", "decided_by": "user_id", "decided_at": "iso8601", "work_order_id": "str|null (present only if approved)" }
```
Resumes the interrupted LangGraph thread with the injected decision.

#### GET /api/audit
Admin/safety_officer. Query params: `job_id`, `actor`, `action`, `limit`.
Response 200:
```json
{
  "chain_valid": true,
  "events": [ {
    "event_id": "str", "job_id": "str", "actor": "user_id|agent:<node>", "actor_role": "str",
    "action": "str (node/tool/approval/injection-block event)", "argument_summary": "str (redacted)",
    "outcome": "ok|error|blocked", "prev_hash": "hex", "hash": "hex", "ts": "iso8601"
  } ]
}
```
Hash chain: `hash = H(payload || prev_hash)`; verified on read.

#### GET /api/admin/models
Admin only.
Response 200:
```json
[ { "model_name": "str", "purpose": "generation|vision|embedding|reranker", "quantization": "str", "checksum_sha256": "hex", "profile": "dev|pilot|prod", "loaded": true } ]
```

#### GET /api/health
No auth. Response 200:
```json
{ "status": "ok", "services": { "postgres": "up|down", "qdrant": "up|down", "model_gateway": "up|down", "storage": "up|down" }, "version": "str" }
```
503 if any essential service is down.

Error taxonomy (all endpoints): validation errors -> 4xx with typed body `{ "detail": "str", "field": "str|null" }`; auth failures -> 401; forbidden -> 403; conflict/idempotency rejection -> 409; unknown id -> 404. No silent error swallowing.

Phase 2/4 additions (ratified in DECISIONS.md 2026-08-29):
- `GET /api/documents/{document_id}/content` -> `{ document: DocumentOut, chunks: [{chunk_id, page, section, text}] }` (caller-role ACL).
- `GET /api/jobs/{job_id}/evidence/{chunk_id}` -> `{ chunk_id, document_id, document_title, document_type, revision, page, section, equipment_id, confidentiality_level, content_hash, passage_text, why_retrieved }` (job-visibility + chunk ACL inside the vector query).
- `GET /api/jobs/{job_id}/artifacts/{payload_ref}` -> discriminated union `{kind: "approval", approval: {...}} | {kind: "tool", tool: {...}} | {kind: "report", report: {...}}`; known payload_refs: `approval_request`, `search_documents`, `report`.
- `final_report.citations` entries are structured §c.5 refs: `{title, revision, locator, chunk_id}`.

### c.2 SSE event envelope (EXACT JSON)

Every SSE event's `data:` payload is exactly:

```json
{
  "job_id": "str",
  "seq": 0,
  "type": "node_started|node_finished|tool_called|evidence_added|contradiction_found|awaiting_approval|completed|failed|blocked_injection",
  "node": "str",
  "payload_ref": null,
  "ts": "2026-01-01T00:00:00Z"
}
```

Field rules:
- `seq`: monotonically increasing int per job; used for replay/reconnect (`Last-Event-ID`).
- `node`: graph node name emitting the event.
- `payload_ref`: opaque reference key to fetch heavier payloads (report text, evidence list); `null` when inline-empty.
- `ts`: ISO 8601 UTC.
- `type` is one of the nine enumerated strings — nothing else may appear on the wire.

### c.3 LangGraph state schema (frozen)

The workflow state (single typed object flowing through the graph). Winning Plan §9 fields, extended with two operational fields required for SSE streaming and checkpoint resume (extension recorded in DECISIONS.md):

```text
1.  request_id          # unique job identifier; also the LangGraph thread_id
2.  user_id             # who initiated; drives ACL filtering
3.  user_role           # engineer | safety_officer | supervisor | admin
4.  objective           # normalized investigation request text
5.  plan                # bounded ordered steps chosen by planner node
6.  completed_steps     # progress marker for resume-after-restart
7.  retrieved_evidence  # citation-ready excerpts with retrieval scores
8.  tool_results        # typed outputs from SQL/inventory tools
9.  citations           # structured [title, rev, page/section, chunk_id] refs
10. assumptions         # things stated WITHOUT full evidence, labeled as such
11. contradictions      # detected conflicts between sources
12. risk_flags          # safety/policy concerns raised by reviewer
13. proposed_actions    # e.g., work-order draft awaiting approval
14. approval_status     # pending | approved | rejected (+ decided_by)
15. final_report        # composed findings document
16. current_node        # operational: node currently executing (drives SSE node_started/node_finished)
17. last_event_seq      # operational: highest seq emitted for this job (drives replay/resume)
```

Phase 1 uses a deterministic three-node subgraph over the same state: `intake -> answer -> finalize`, persisted with the Postgres checkpointer. The full eight-node design (intake, planner, evidence retriever, data analyst, multimodal inspector, safety reviewer, report composer, approval executor) lands in Phases 3–4 using the same schema.

### c.4 Chunk metadata schema (Winning Plan §10 — ALL fields, frozen)

Every indexed chunk carries ALL of these fields BEFORE entering Qdrant:

```text
document_id            # links chunk to source document
document_title         # human-readable name shown in citations
document_type          # manual | sop | work_order | incident | data
revision               # version; superseded revisions filtered at query time
effective_date         # validity window
department             # owning department (ACL dimension)
equipment_id           # e.g., P-204 (filter dimension)
confidentiality_level  # classification tier
allowed_roles          # THE ACL field: list subset of ["engineer","safety_officer","supervisor","admin"]; enforced INSIDE the Qdrant query filter
page                   # physical page number for viewer jump
section                # hierarchical section path
chunk_id               # stable ID cited in reports
content_hash           # integrity/provenance
```

Rule: permission filtering happens inside the retrieval query (`allowed_roles` filter composed with metadata filters). NEVER retrieve-first-filter-later. ACL leakage count must be zero.

### c.5 Citation contract

Every operational claim references exactly:

```text
[Document title, revision, page/section, chunk_id]
```

Citations render as clickable links in the UI; clicking opens the source viewer scrolled to the page/section with the passage highlighted. Uncited factual claims must be labeled assumptions.

### c.6 Roles & permissions

Roles: `engineer`, `safety_officer`, `supervisor`, `admin`.

Tool permissions are DEFAULT-DENY. Explicit grants only:

| Tool | engineer | safety_officer | supervisor | admin |
|---|---|---|---|---|
| search_documents       | yes | yes | yes | yes |
| get_asset_history      | yes | yes | yes | yes |
| check_inventory        | yes | yes | yes | yes |
| propose_work_order     | yes | no  | yes | yes |
| approve_work_order     | NO  | NO  | YES (only path; requires human approval step first) | no |

Additional rules: least privilege per role AND per agent node; read-only DB credentials for analysis tools; parameterized queries only; idempotency keys on all side effects; approval immediately before consequential execution; every tool call audited with sensitive fields redacted.

Job visibility: users see their own jobs; supervisor/admin see all. Approvals listing: supervisor/admin. Audit: admin/safety_officer. Model registry: admin.

### c.7 Environment variables (exactly five)

| Var | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (system of record + LangGraph checkpoints) |
| `QDRANT_URL` | Qdrant endpoint, e.g., `http://qdrant:6333` |
| `MODEL_BASE_URL` | OpenAI-compatible inference endpoint (Ollama in dev, vLLM in prod); engine swap is config, never code |
| `JWT_SECRET` | Signing secret for JWTs; never committed — set via `.env` from `.env.example` template |
| `STORAGE_PATH` | Local filesystem path for uploaded/quarantined documents |
| `DEMO_MODE` | Optional (ratified 2026-08-29): bool, default false. Startup refuses the default JWT secret unless true; for the offline demo profile |

No other service addresses may be hardcoded; anything new requires a contract proposal.

---

## d) LANE MAP — EXCLUSIVE OWNERSHIP

Nobody touches paths outside their own lane. Ever.

| Lane | Owned paths (exclusive write access) |
|---|---|
| **WEB** | `apps/web/**` |
| **API** | `apps/api/*`, `packages/tools/*` |
| **AI** | `packages/agent/*`, `packages/retrieval/*`, `data/synthetic/*` |
| **INFRA** | `infra/*`, `scripts/*`, `docs/*`, `COMMON.md` (proposal process only) |

Shared NO-WRITE zone for ALL lanes: `coordination/*`. Exception: each lane writes ONLY its own two coordination files (`charter-<lane>.md` is read-only even for its lane; `status-<lane>.md` writable by its lane only).

Contract changes: any lane files `[PROPOSAL]` in `coordination/DECISIONS.md`; ONLY infra converts it to `[DECISION]` and edits `COMMON.md`. All other lanes keep coding to the frozen contract meanwhile.

---

## e) CODING STANDARDS

Python (apps/api, packages/*, data/synthetic):
- Lint/format: `ruff check .` and `ruff format --check .`
- Types: `mypy` — type hints everywhere, no implicit Any
- Tests: `pytest`
- No secrets in code; configuration via env vars only

Web (apps/web):
- Lint: `eslint .`
- Types: `tsc --noEmit`
- Tests: `vitest`

Commits prefixed by lane: `[web] ...`, `[api] ...`, `[ai] ...`, `[infra] ...`. One small unit per commit.

Secrets: never in code or git. Use `.env.example` templates; real values live in local `.env` (gitignored).

---

## f) PHASED ROADMAP WITH EXIT CONDITIONS

Work ONLY on the current phase unless your charter says otherwise. Order matters more than speed.

### Phase 1 — Skeleton
- Auth + roles + JWT (login/me endpoints, seeded users for all four roles).
- Job creation + SSE event streaming (envelope per §c.2).
- Deterministic 3-node LangGraph graph (`intake -> answer -> finalize`) with Postgres checkpointer.
- UI: login, investigations list, new-investigation form, live timeline.
- Compose files (web, api, postgres, qdrant, ollama, otel-collector) + healthchecks on every service.

**EXIT:** submitted job streams a locally generated response end-to-end.

### Phase 2 — Ingestion + Citations
- Upload + quarantine + dedup-by-content-hash.
- Docling parsing: PDF, scanned (OCR), tables, CSV.
- Hierarchy-aware chunking with full metadata + ACL (§c.4).
- Local embeddings (dense) + sparse representations -> Qdrant hybrid index.
- RRF fusion + reranking of top candidates.
- Clickable citations opening highlighted source passage; document library UI.

**EXIT:** answer contains clickable citations landing on the correct passage.

### Phase 3 — Tools + Approval
- Asset-history and inventory databases seeded.
- Typed read-only tools: `search_documents`, `get_asset_history`, `check_inventory`, `propose_work_order` (draft-only).
- Planning, data-analyst, evidence-sufficiency nodes added to graph.
- Timeouts + retries + idempotency keys on side effects.
- `approve_work_order` draft flow: approval interrupt, supervisor UI, audit hash chain.

**EXIT:** interrupted job resumes from checkpoint; zero actions bypass approval.

### Phase 4 — Multimodal + Memory
- VLM image-inspection node producing OBSERVATIONS (not verdicts), region-cited.
- Episodic/semantic memory store with provenance (author, timestamp, scope, expiry); scoped isolation.
- Contradiction detection surfaced side-by-side in the UI.

**EXIT:** image evidence cited in a report; contradiction shown side-by-side.

### Phase 5 — Security + Eval Polish
- Injection test suite (direct + indirect); malicious-PDF demo behavior: evidence-as-data zoning, refuse export, log `blocked_injection`, continue task.
- Permission-boundary tests with ZERO leakage tolerance.
- Eval harness: Recall@5 >= 0.85 target, groundedness, abstention scoring.
- Evaluation dashboard screen; offline bundle scripts (`bootstrap-offline`, `verify-no-egress`, `run-evals`).

**EXIT:** security suite green; golden workflow completes 5/5 consecutive runs.
