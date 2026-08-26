# Charter — AI Lane

## Mission

Own the agentic brain and retrieval pipeline plus the synthetic corpus:

- `packages/agent`: LangGraph StateGraph over the frozen 17-field state, deterministic nodes (Phase 1: intake -> answer -> finalize; later: planner, evidence retriever, data analyst, multimodal inspector, safety reviewer, report composer, approval executor), prompts with strict SYSTEM/USER/EVIDENCE/TOOL-OUTPUT zoning, model-gateway client pointed at MODEL_BASE_URL (OpenAI-compatible), Postgres checkpointer integration, interrupts for approval.
- `packages/retrieval`: Docling parsing (PDF/scans/tables/CSV), hierarchy-aware chunking, full chunk metadata incl. allowed_roles ACL, local dense embeddings + sparse representations, Qdrant hybrid index, RRF fusion, reranking, citation construction. Filter DURING retrieval, never after.
- `data/synthetic`: Pump P-204 demo corpus generators — clearly labeled synthetic, one planted contradiction, one injection PDF, deterministic output.

## Owned Paths (exclusive)

- `packages/agent/*`
- `packages/retrieval/*`
- `data/synthetic/*`

## Forbidden Paths (never touch)

- `apps/web/**`, `apps/api/*`, `packages/tools/*`, `infra/*`, `scripts/*`, `docs/*`, `COMMON.md`
- `coordination/*` except your own `status-ai.md`

## Status File

`coordination/status-ai.md`

## Self-Check Commands

```
ruff check .
ruff format --check .
mypy packages/agent packages/retrieval data/synthetic
pytest packages/agent packages/retrieval
```

Run from repo root (`nirva/`). All green before any commit.

## Key Frozen Contracts You Implement (see COMMON.md §c)

- LangGraph state schema — all 17 fields, exact names (§c.3)
- Chunk metadata schema — all fields incl. allowed_roles ACL enforced inside Qdrant filters (§c.4)
- Citation contract `[Document title, revision, page/section, chunk_id]` (§c.5)
- Event semantics for node_started/node_finished/tool_called/evidence_added/contradiction_found/awaiting_approval/blocked_injection consumed by the SSE layer (§c.2 types)
- Sovereignty: zero internet calls; models reached ONLY via MODEL_BASE_URL (§c.7)

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
