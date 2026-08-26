# INTEGRATION-CHECKLIST.md — Infra Lane

Infra verifies these end-to-end after each phase lands. All checks run locally, offline.

## Phase 1
- [ ] `docker compose up` brings up web, api, postgres, qdrant, ollama, otel-collector — ALL healthchecks green
- [ ] Login works for all four seeded roles; JWT accepted on protected routes
- [ ] Job stream works: POST /api/jobs -> SSE events arrive in order (intake -> answer -> finalize)
- [ ] Postgres checkpointer row visible for the job thread

## Phase 2
- [ ] Upload PDF/CSV -> quarantined then indexed; duplicate upload rejected by hash
- [ ] Citation click works: answer citation opens source viewer at correct page/section, passage highlighted
- [ ] Qdrant hybrid search returns chunks with full metadata incl. allowed_roles

## Phase 3
- [ ] Approval gate works: propose_work_order pauses graph; supervisor approves; work order created exactly once (idempotency verified under retry)
- [ ] Kill api container mid-job, restart -> job resumes from checkpoint without repeating tool calls
- [ ] Audit hash chain verifies (`chain_valid: true`); tampering an event flips it visibly

## Phase 4
- [ ] Image evidence cited from VLM node observations
- [ ] Contradiction displayed side-by-side (seal-replaced report vs missing-part work order)

## Phase 5
- [ ] Offline run works: internet disconnected, entire golden workflow completes
- [ ] `verify-no-egress.sh` passes with zero external calls during golden flow
- [ ] Injection blocked: malicious PDF yields `blocked_injection` event + audit entry, task continues
- [ ] Security suite green; eval dashboard shows Recall@5 >= 0.85 target status

## Universal
- [ ] Every service healthy per GET /api/health before declaring integration done
