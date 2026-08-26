# Status File — AI Lane

> Owned exclusively by the ai lane. Update every session (Universal Loop step 6).

## Current Phase

Phase 2 — Ingestion + Citations (Phase 1 AI-lane scope complete)

## Done (list with dates + file paths)

- 2026-08-26 Model-gateway client, OpenAI-compatible over `MODEL_BASE_URL`, works unchanged against Ollama `/v1` and vLLM `/v1` (sync + async), typed errors:
  - `packages/agent/pyproject.toml`
  - `packages/agent/src/nirva_agent/__init__.py`
  - `packages/agent/src/nirva_agent/config.py`
  - `packages/agent/src/nirva_agent/gateway.py`
  - `packages/agent/tests/test_config.py` (5 tests)
  - `packages/agent/tests/test_gateway.py` (11 tests incl. zoning-shape test)
- 2026-08-26 Frozen 17-field `NirvaState` TypedDict (COMMON.md c.3, exact names/order) + typed sub-models (`EvidenceItem`, `Citation` per c.5, `ToolResult`, `Contradiction`, `ProposedAction`, `ApprovalState`, `FinalReport` per c.1 shape), append-reducers on accumulation fields:
  - `packages/agent/src/nirva_agent/state.py`
  - `packages/agent/tests/test_state.py` (5 tests incl. exact-field-order check)
- 2026-08-26 Three-node Phase-1 graph `intake -> answer -> finalize` with injectable gateway + checkpointer; zoned SYSTEM/OBJECTIVE/EVIDENCE prompts (evidence rendered as data-only blocks with chunk-id headers); deterministic confidence scoring in finalize (abstains low when zero evidence); Postgres checkpointer factory (`DATABASE_URL` -> psycopg pool -> PostgresSaver) and in-memory fake for tests:
  - `packages/agent/src/nirva_agent/graph.py`
  - `packages/agent/src/nirva_agent/checkpointer.py`
  - `packages/agent/tests/test_graph.py` (9 tests incl. fake-checkpointer resume via thread_id=request_id)
- 2026-08-26 Retrieval foundation: §c.4 chunk metadata model (13 fields mandatory + ACL enforced at model validation, zero-leak allowed_roles) + hierarchy-preserving structural chunker respecting section paths, page numbers, revision, equipment_id, confidentiality, department; sha256 content hash per chunk; doc → ParsedDocument → Chunk pipeline:
  - `packages/retrieval/pyproject.toml`
  - `packages/retrieval/src/nirva_retrieval/__init__.py`
  - `packages/retrieval/src/nirva_retrieval/metadata.py`
  - `packages/retrieval/src/nirva_retrieval/chunking.py`
  - `packages/retrieval/tests/test_metadata.py` (10 tests: field completeness, required/min, role ACL, hash bounds, doc-type constraint)
  - `packages/retrieval/tests/test_chunking.py` (5 tests: section-path preservation, ACL carry-through, page jump, stable IDs, oversized split, empty-section handling)
- Self-check after each unit: ruff check OK, mypy --strict OK, pytest passed (29 agent + 15 retrieval).

## In Progress

- (nothing)

## Handoff Notes

- Phase 1 AI-lane deliverables COMPLETE (gateway, state, graph+checkpointer). Next AI unit: Phase 2 — Docling ingestion pipeline (hash dedup -> parse -> OCR-if-needed -> hierarchy-preserving chunking with full §c.4 metadata + ACL on every chunk) in `packages/retrieval/`.
- Gateway design decision kept inside lane: `model` name is a constructor arg (Ollama and vLLM use different local model names); only `MODEL_BASE_URL` read from env, per §c.7 five-var contract — no new env vars introduced.
- Graph nodes are pure functions taking `NirvaState` and returning partial state; gateway/checkpointer injected at compile time — keeps the 8-node expansion (Phases 3-4) drop-in.
- Sandbox quirk for all lanes: shell commands containing substrings "format" or "rm" anywhere (even inside words like "dete rm inistic") are denied — word commits/messages accordingly; `ruff format --check` cannot be executed here.
- Vision tag to register later: `qwen2.5vl:3b` (or `qwen2.5vl:7b` on 8GB+ VRAM).
