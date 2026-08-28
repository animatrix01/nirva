# NIRVA Internal Hackathon Demo-Readiness Plan

## 1. Objective

Prepare NIRVA for a college internal hackathon as a credible, end-to-end prototype for
SIH26117: a sovereign, on-premise agentic AI workbench for confidential industrial work.

The internal-round goal is not to complete every item in the long-term roadmap. The goal is
to prove one high-value investigation workflow with real local inference, grounded evidence,
controlled tool use, human approval, and an auditable result.

### Demo-ready definition

NIRVA is demo-ready when a judge can:

1. Disconnect the laptop from the internet.
2. Sign in as an engineer.
3. Ask why refinery pump `P-204` has failed repeatedly.
4. Watch a real agent retrieve local evidence and produce a cited investigation.
5. Open at least one citation and verify the supporting passage.
6. See a contradiction between two source records.
7. Review a proposed maintenance action that cannot execute without approval.
8. Sign in as a supervisor and approve or reject the proposal.
9. Inspect an audit trail covering the investigation and decision.

No step in this golden workflow may depend on a mock API, a cloud LLM, or internet access.

---

## 2. Current Baseline

### Already available

- Next.js 16 frontend with login and investigation-list foundations.
- FastAPI API with JWT authentication and four roles.
- Job creation, job listing, SSE events, approvals, and audit endpoints.
- LangGraph state contract and a three-node investigation graph.
- OpenAI-compatible local model gateway for Ollama or vLLM.
- Structural chunking and citation-oriented document metadata.
- Tool permission matrix with default-deny behavior.
- Postgres, Qdrant, Ollama, and OpenTelemetry Compose design.
- Unit tests for graph state, model gateway, permissions, authentication, and SSE contracts.

### Blocking gaps

- The API still runs `MockIntakeAnswerFinalizeGraph` instead of the real LangGraph graph.
- PDF ingestion, embeddings, Qdrant indexing, retrieval, and reranking are absent.
- All operational tool functions raise `NotImplementedError`.
- The web application uses mock HTTP and SSE by default.
- Investigation detail, evidence viewer, approval, and audit screens are absent.
- API and web Dockerfiles are absent.
- The API has no reproducible dependency manifest.
- Compose and offline execution have not been verified end to end.
- Generated databases, journals, bytecode, and caches are tracked in Git.

---

## 3. Scope For The Internal Round

### Must have: P0

- Reproducible local startup.
- Real local LLM response through Ollama.
- Local document ingestion and vector retrieval.
- At least three citations in the final report.
- Clickable source evidence.
- Role-aware access to jobs and evidence.
- One real read-only tool: asset-history lookup.
- One consequential proposal: create maintenance work-order proposal.
- Supervisor approval or rejection.
- Audit events for every important action.
- A prepared offline demo dataset.
- A rehearsed six-minute demo.

### Strong differentiators: P1

- Contradiction detection between maintenance records.
- Prompt-injection detection in an uploaded document.
- Image inspection using the same local multimodal model.
- Checkpoint resume after an API restart.
- Evaluation page with retrieval and citation metrics.

### Defer until after the internal round

- Fine-tuning or LoRA training.
- Multi-model routing across several large LLMs.
- General-purpose autonomous browsing.
- ERP/SAP integration.
- Kubernetes or multi-node deployment.
- Complex knowledge-graph infrastructure.
- Mobile application.
- More than one polished industrial workflow.

---

## 4. Golden Demo Scenario

### Investigation

> Investigate why Pump P-204 has failed repeatedly during the last three months. Identify the
> most likely cause, cite the supporting records, check spare-part availability, and propose a
> safe next action.

### Synthetic evidence corpus

Create a small but internally consistent corpus under `data/synthetic/`:

| File | Purpose |
|---|---|
| `P204_maintenance_manual.pdf` | Seal tolerances, vibration limits, approved procedure |
| `P204_inspection_2026_06.pdf` | Elevated vibration and seal leakage observations |
| `P204_inspection_2026_07.pdf` | Follow-up condition and unresolved alignment issue |
| `P204_work_orders.csv` | Repairs, parts used, dates, technician notes |
| `P204_shift_log.csv` | Operating conditions around each failure |
| `P204_inventory.csv` | Seal kit and coupling availability |
| `P204_photo.jpg` | Optional visible leakage or alignment evidence |
| `malicious_vendor_note.pdf` | Contains an instruction-like prompt-injection sentence |

All records must be synthetic and clearly labelled as demonstration data.

### Designed contradiction

- Inspection report: coupling alignment correction was not completed.
- Work-order closure: coupling alignment was completed successfully.

The agent must show both records side by side and state that the conflict requires human
verification. It must not silently choose one record.

### Expected finding

The evidence should support a likely combined cause involving misalignment, vibration, and
premature mechanical-seal wear. The agent should propose inspection and seal replacement,
but it must abstain from claiming certainty and must not create a work order without approval.

---

## 5. Target Demo Architecture

```text
Next.js console
    |
    | REST + SSE
    v
FastAPI API
    |
    +--> LangGraph investigation graph
    |       +--> local Qwen3-VL through Ollama
    |       +--> Qdrant retrieval
    |       +--> asset-history and inventory tools
    |       +--> approval interrupt
    |
    +--> PostgreSQL: users, jobs, checkpoints, approvals, audit
    +--> Local storage: uploaded and synthetic documents

All services bind to localhost and operate without cloud APIs.
```

### Model selection for the RTX 4050 6 GB laptop

Use one primary model:

```text
qwen3-vl:4b-instruct-q4_K_M
```

Configuration:

- Context: 4096 tokens initially; increase to 8192 only after measuring VRAM.
- Temperature: `0.0` for investigation and extraction.
- Maximum output: 700-1000 tokens.
- Concurrency: one generation request.
- Embeddings: `multilingual-e5-small` on CPU.
- Reranker: optional small cross-encoder on CPU.
- OCR and Docling: CPU, performed before the live presentation.

Do not keep separate text and vision LLMs resident during the demo. Do not depend on
`gpt-oss-20b` or a cloud GPU for the golden workflow.

---

## 6. Implementation Plan

## Phase 0: Repository And Startup Repair

**Timebox:** 2-3 hours

### Work

1. Restore a root `.gitignore` covering `.env`, databases, journals, caches, model files,
   uploads, coverage output, `.next`, and `node_modules`.
2. Stop tracking generated databases and Python bytecode.
3. Add a root `README.md` with architecture, requirements, setup, demo users, and commands.
4. Add `apps/api/pyproject.toml` with pinned runtime and test dependencies.
5. Add `apps/api/Dockerfile` and `apps/web/Dockerfile`.
6. Make API startup reject an unchanged JWT secret outside explicit demo mode.
7. Add a root verification command or Makefile target.

### Exit gate

```bash
docker compose -f infra/compose/docker-compose.yml config --quiet
python -m pytest apps/api/tests packages/agent/tests packages/retrieval/tests packages/tools/tests
cd apps/web && npm run lint && npm run typecheck && npm test && npm run build
```

All commands must run from a fresh clone after following the README.

## Phase 1: Connect The Real Agent

**Timebox:** 4-6 hours

### Files

- `apps/api/app/graph_client.py`
- `apps/api/app/runner.py`
- `packages/agent/src/nirva_agent/graph.py`
- `packages/agent/src/nirva_agent/checkpointer.py`

### Work

1. Replace `MockIntakeAnswerFinalizeGraph` with an adapter around
   `build_investigation_graph()`.
2. Instantiate the gateway from `MODEL_BASE_URL`.
3. Pass the authenticated user's actual role into graph state instead of hardcoding
   `engineer`.
4. Persist final reports and node events.
5. Use the job ID as the LangGraph `thread_id`.
6. Add explicit timeouts and a useful model-unavailable error event.
7. Stream node transitions without exposing hidden chain-of-thought.

### Exit gate

- A job produces non-mock local-model output.
- Turning off Ollama produces a controlled failure visible in the UI.
- Restarting the API does not corrupt the job or audit records.

## Phase 2: Complete A Minimal RAG Pipeline

**Timebox:** 8-10 hours

### New modules

```text
packages/retrieval/src/nirva_retrieval/ingest.py
packages/retrieval/src/nirva_retrieval/embed.py
packages/retrieval/src/nirva_retrieval/store.py
packages/retrieval/src/nirva_retrieval/search.py
apps/api/app/routers/documents.py
```

### Ingestion flow

1. Hash the uploaded file and reject duplicates.
2. Store the original file in local storage.
3. Parse PDF content with Docling; use OCR only when necessary.
4. Convert parsed content to the existing `ParsedDocument` structure.
5. Chunk by document hierarchy.
6. Attach all required metadata, including `allowed_roles`.
7. Generate CPU embeddings.
8. Upsert chunks into Qdrant.
9. Store document status and content hash in Postgres.

### Retrieval flow

1. Validate the authenticated role before searching.
2. Apply the Qdrant `allowed_roles` filter during search, not after retrieval.
3. Retrieve approximately 12 candidates.
4. Optionally rerank and retain the top 5.
5. Return exact chunk IDs and source metadata.
6. Inject evidence into a separate, clearly marked evidence message.
7. Reject any citation that does not refer to a retrieved chunk.

### Exit gate

- The Pump P-204 query returns at least three relevant chunks.
- Every visible factual claim has a valid citation or an `Assumption` label.
- An engineer cannot retrieve supervisor-only chunks.
- No-evidence questions produce an abstention rather than a fabricated answer.

## Phase 3: Read-Only Tools And Approval

**Timebox:** 6-8 hours

### Work

1. Implement `search_documents` through the retrieval package.
2. Seed asset-history and inventory tables from the synthetic CSV files.
3. Implement `get_asset_history` and `check_inventory` as read-only tools.
4. Add tool-call records containing sanitized inputs, outputs, actor, job ID, and timing.
5. Implement `propose_work_order` as an approval proposal only.
6. Pause the graph on `awaiting_approval`.
7. Allow only a supervisor to approve or reject.
8. Resume the same graph thread after a decision.
9. Create a work-order record idempotently only after approval.

### Exit gate

- An engineer can read asset history and inventory.
- A safety officer cannot propose a work order.
- An engineer cannot approve a proposal.
- Repeating an approval request cannot create two work orders.
- Rejection leaves no work order and is recorded in the audit trail.

## Phase 4: Investigation Workspace UI

**Timebox:** 8-10 hours

### Required routes

```text
/login
/investigations
/investigations/new
/investigations/[jobId]
/approvals
/audit
/admin/system
```

### shadcn/ui AI Elements component set

Use [AI Elements](https://elements.ai-sdk.dev/) because it follows shadcn/ui conventions,
adds components as source code inside the application, and supports the exact interaction
states needed in the NIRVA demo. Install only the primitives used by the investigation
workspace:

```bash
cd apps/web
npx ai-elements@latest add conversation message sources tool chain-of-thought reasoning confirmation task
```

The UI must use the existing FastAPI REST and SSE contracts. Do not introduce a second chat
backend or make the frontend depend on Vercel AI Gateway. AI Elements is the presentation
layer; Ollama, LangGraph, Qdrant, and FastAPI remain the execution layer.

| AI Element | NIRVA use |
|---|---|
| `Conversation` | Scrollable investigation activity and report stream |
| `Message` | Engineer objective and final agent response |
| `MessageResponse` | Safe streamed Markdown rendering for findings |
| `Sources` / `Source` | Collapsible citation list linked to local evidence |
| `ChainOfThought` | LangGraph workflow stages derived from SSE events |
| `Reasoning` | Optional concise investigation summary, never private chain-of-thought |
| `Tool` | Search, asset-history, inventory, and work-order invocation states |
| `Confirmation` | Supervisor approval or rejection of a consequential action |
| `Task` | Bounded investigation plan and completed-step progress |

Do not install canvas, generative UI, model selector, web search, attachments, or voice
components for the internal round unless the golden workflow is already stable.

### Investigation workspace composition

Build the detail route as an operational workspace rather than a general chat screen:

```text
+------------------------------------------------------------------+
| Header: P-204 / Running / Local model / Offline                   |
+---------------------------+--------------------------------------+
| Main investigation        | Evidence and control                 |
|                           |                                      |
| Objective message         | Sources                              |
| Workflow progress         | Selected passage                     |
| Tool calls                | Document metadata                    |
| Approval interrupt        | Contradiction comparison             |
| Markdown findings         | Audit summary                        |
+---------------------------+--------------------------------------+
```

Desktop layout:

- Main investigation column: approximately 65% width.
- Evidence/control column: approximately 35% width.
- Both columns scroll independently below a stable header.
- The selected citation stays visible while the judge reads the associated claim.

Mobile layout:

- Render the evidence panel as a full-height sheet.
- Keep status and approval actions visible without horizontal scrolling.
- Do not attempt to preserve the two-column desktop layout at narrow widths.

### SSE event to component mapping

The frontend should maintain one normalized activity array ordered by `seq`. Replayed events
with an existing sequence number must be ignored.

| SSE event | Component | Visible behavior |
|---|---|---|
| `node_started` | `ChainOfThoughtStep` | Stage becomes active and shows its start time |
| `node_finished` | `ChainOfThoughtStep` | Stage becomes complete and shows duration |
| `evidence_added` | `Sources` | Citation count updates; new source becomes inspectable |
| `tool_called` | `Tool` | Tool name, safe inputs, running/completed state, and result |
| `contradiction_found` | Custom evidence comparison | Conflicting passages appear side by side |
| `awaiting_approval` | `Confirmation` | Workflow pauses and supervisor actions become available |
| `blocked_injection` | Alert inside workflow | Suspicious document instruction is identified and isolated |
| `completed` | `MessageResponse` | Final Markdown report is rendered and workflow closes |
| `failed` | Error state | Failed stage, recovery guidance, and retry control are shown |

`payload_ref` is the opaque key for heavier content. Add an authenticated artifact endpoint
such as:

```text
GET /api/jobs/{job_id}/artifacts/{payload_ref}
```

The artifact response should be a discriminated union so the UI never guesses payload shape:

```ts
type JobArtifact =
  | { kind: "evidence"; evidence: EvidenceReference[] }
  | { kind: "tool"; tool: ToolActivity }
  | { kind: "contradiction"; contradiction: Contradiction }
  | { kind: "approval"; approval: ApprovalRequest }
  | { kind: "report"; report: FinalReport }
  | { kind: "security"; event: SecurityEvent };
```

Fetch each unique `payload_ref` once and cache it by reference. The SSE handler should update
lightweight activity state immediately and load artifact details asynchronously so a large
tool result cannot block later events.

### Workflow and reasoning display

The workflow view should make the agent's bounded process understandable without presenting
raw chain-of-thought. Use the `ChainOfThought` component as a progress visualization with
deterministic labels:

1. Validate request and permissions.
2. Plan bounded investigation.
3. Retrieve authorized evidence.
4. Inspect maintenance and inventory data.
5. Compare conflicting records.
6. Review safety constraints.
7. Compose cited findings.
8. Await or apply human decision.

Allowed details:

- Node name and status.
- Start time and duration.
- Number of authorized chunks retrieved.
- Tools called and their sanitized arguments.
- Sources accepted or rejected.
- Assumptions, gaps, risk flags, and contradiction summaries.
- Approval state and responsible human role.

Never display:

- Hidden model tokens or private chain-of-thought.
- System prompts.
- Secrets, tokens, connection strings, or filesystem paths.
- Full restricted documents in a tool result.
- Evidence excluded by the current user's ACL.

If the `Reasoning` primitive is used, label it `Investigation summary`, not `Internal
reasoning`, and populate it from structured graph state. It should contain short statements
such as `Retrieved five authorized maintenance records` or `Two records disagree on coupling
alignment`.

### Tool-call presentation

Render every tool call with the AI Elements `Tool` compound component:

```text
Tool
  ToolHeader: name + status
  ToolContent
    ToolInput: sanitized structured arguments
    ToolOutput: concise result, error, or denial
```

Map NIRVA states to the component states:

| NIRVA state | AI Elements tool state |
|---|---|
| Arguments being prepared | `input-streaming` |
| Tool authorized and running | `input-available` |
| Human decision required | `approval-requested` |
| Supervisor decision received | `approval-responded` |
| Successful result | `output-available` |
| Execution failure | `output-error` |
| RBAC or policy rejection | `output-denied` |

For the internal demo, show these calls:

1. `search_documents` with equipment ID and document-type filters.
2. `get_asset_history` with `P-204`.
3. `check_inventory` with the required seal-kit part number.
4. `propose_work_order` with risk and evidence references.

Tool output must be a compact operational summary. Large JSON or complete document text
should remain behind a details control.

### Citation and evidence experience

Use `Sources`, `SourcesTrigger`, `SourcesContent`, and `Source` directly below the Markdown
report. Each citation must use the frozen citation contract:

```text
[Document title, revision, page/section, chunk_id]
```

Clicking a source must:

1. Select the source in the evidence panel.
2. Open the correct locally stored document.
3. Jump to the recorded page or section.
4. Highlight the retrieved passage.
5. Display revision, effective date, confidentiality, and content hash.

Use local authenticated links such as:

```text
/api/documents/{document_id}/content?page=7&chunk_id=chk-P204-0004
```

Do not use fake external URLs for industrial sources. If a source artifact is unavailable,
render it as unavailable and treat citation validation as failed.

### Markdown response rendering

Render `final_report.findings` through `MessageResponse`. Support:

- Headings.
- Paragraphs.
- Ordered and unordered lists.
- Tables for evidence comparison.
- Bold and inline code.
- Fenced code only when displaying a query or structured diagnostic.
- Inline citation markers that select the corresponding local source.

Sanitize Markdown and disable raw HTML. External links, if any exist in synthetic manuals,
must open safely with `rel="noreferrer"`. Do not allow images, iframes, scripts, arbitrary HTML,
or remote content to load from retrieved Markdown.

Use a predictable report structure:

```markdown
## Finding

## Supporting Evidence

## Contradiction Requiring Verification

## Assumptions And Gaps

## Recommended Action
```

The report renderer should handle partial streamed Markdown without causing large layout
shifts. Keep the content width readable and do not place the report inside another decorative
card.

### Approval experience

Use the `Confirmation` component only for an actual pending approval artifact. It must show:

- Proposed action.
- Equipment ID.
- Risk level.
- Sanitized parameters.
- Supporting citation links.
- Requesting user.
- Approving role requirement.
- Approve and reject commands.

The engineer sees a read-only waiting state. Only the authenticated supervisor sees enabled
decision controls. After a decision, the same component shows the decision, actor, comment,
timestamp, and work-order ID when applicable.

### Component files and ownership

Keep downloaded AI Elements source under:

```text
apps/web/src/components/ai-elements/
```

Add NIRVA-specific composition under:

```text
apps/web/src/components/investigation/investigation-workspace.tsx
apps/web/src/components/investigation/workflow-activity.tsx
apps/web/src/components/investigation/report-view.tsx
apps/web/src/components/investigation/evidence-panel.tsx
apps/web/src/components/investigation/tool-activity.tsx
apps/web/src/components/investigation/approval-request.tsx
apps/web/src/components/investigation/contradiction-view.tsx
```

Do not edit the generic AI Elements primitives to contain NIRVA business logic. Compose them
inside the investigation components so they remain replaceable and independently testable.

### Investigation detail layout

- Compact header with status, equipment ID, creator, and timestamp.
- Main findings with confidence, assumptions, and evidence gaps.
- Live timeline of node, retrieval, tool, approval, and completion events.
- Evidence panel showing title, revision, page/section, and highlighted passage.
- Contradiction panel showing conflicting sources side by side.
- Proposed-action panel with risk level and approval status.

### UI rules

- Remove the mock router from the production path.
- Do not display hidden chain-of-thought.
- Display meaningful loading, empty, failure, reconnecting, and offline states.
- Use restrained operational styling and compact typography.
- Keep the judge's golden path reachable in two clicks after login.
- Include a visible `Local / Offline` system-status indicator backed by real health data.

### Exit gate

- The frontend uses the real API by default.
- Refreshing a running/completed investigation restores its state.
- Clicking a citation opens the exact stored source passage.
- Markdown findings render safely during and after streaming.
- Tool calls show running, completed, denied, and failed states.
- Workflow progress is reconstructed correctly from SSE replay.
- No private chain-of-thought, system prompt, or restricted evidence is rendered.
- Only a supervisor can interact with the approval confirmation.
- SSE reconnect resumes from the last event without duplicating events.
- The interface works at 1366x768 and a mobile-width fallback.

## Phase 5: Differentiators And Evaluation

**Timebox:** 5-7 hours

### Contradiction detection

Add a graph node that compares high-relevance chunks referring to the same equipment and
maintenance action. It should produce a structured contradiction with both source references
and a required verification step.

### Prompt-injection handling

1. Treat retrieved text as data, never instructions.
2. Detect instruction-like content in documents using deterministic rules first.
3. Exclude or label suspicious chunks.
4. Emit `blocked_injection` and add an audit event.
5. Continue the investigation using unaffected evidence.

### Minimum evaluation set

Create at least 20 questions:

- 10 answerable evidence questions.
- 3 unanswerable questions requiring abstention.
- 3 role-restricted retrieval tests.
- 2 contradiction tests.
- 2 prompt-injection tests.

Track:

| Metric | Internal target |
|---|---:|
| Recall@5 | >= 0.80 |
| Citation validity | 100% |
| Grounded-answer rate | >= 0.85 |
| Correct abstention | 100% on three test cases |
| Unauthorized retrieval | 0 chunks |
| Duplicate work orders under retry | 0 |
| Golden-flow completion | < 90 seconds after model warm-up |

---

## 7. Suggested 72-Hour Schedule

| Window | API/Agent | Retrieval/Data | Web | Integration/QA |
|---|---|---|---|---|
| Hours 0-4 | Dependencies and Dockerfile | Create corpus | Real API toggle | Clean Git and verify setup |
| Hours 4-12 | Wire real LangGraph/Ollama | Docling and Qdrant ingestion | Investigation shell | First end-to-end query |
| Hours 12-24 | Events and report persistence | Search, ACL, citations | Timeline and report | Citation tests |
| Hours 24-36 | Asset/inventory tools | Seed operational data | Evidence viewer | Golden flow v1 |
| Hours 36-48 | Approval interrupt/resume | Contradiction fixtures | Approval and audit UI | Security tests |
| Hours 48-60 | Error handling | Injection and eval cases | System status and polish | Offline rehearsal |
| Hours 60-72 | Bug fixes only | Freeze corpus | Layout fixes only | Record backup demo and rehearse |

For a 24-hour event, complete Phases 0-4 only. Treat contradiction detection as optional and
use a precomputed structured contradiction if necessary. Do not sacrifice real RAG, citations,
or approval to add extra features.

---

## 8. Team Ownership

For a four-person team:

| Role | Primary responsibility |
|---|---|
| Agent/API engineer | LangGraph integration, tools, checkpoints, SSE |
| Retrieval engineer | Corpus, Docling, embeddings, Qdrant, evaluation |
| Frontend engineer | Investigation, evidence, approval, audit interfaces |
| Integration lead | Docker, offline mode, security checks, testing, pitch |

For a smaller team, combine API with integration and combine retrieval with frontend. Every
member must be able to run the golden workflow from a fresh checkout.

### Integration discipline

- Keep `main` runnable.
- Use small branches and merge by vertical capability.
- Do not merge UI that has only mocked data after Phase 1.
- Update `coordination/status-*.md` after each meaningful integration.
- Run contract tests before changing API or SSE payload shapes.
- Freeze feature work at least six hours before judging.

---

## 9. Six-Minute Judge Demo

### 0:00-0:35: Problem

Explain that refinery investigations involve confidential manuals, fragmented maintenance
records, strict permissions, and consequential decisions. Public cloud chatbots cannot be the
default answer.

### 0:35-1:00: Sovereignty proof

- Show Wi-Fi disconnected.
- Show the local health panel.
- State the local model, vector database, and document count.

### 1:00-2:45: Investigation

- Login as engineer.
- Submit the Pump P-204 objective.
- Show live node and retrieval events.
- Open the final report.
- Click two citations and show their source passages.

### 2:45-3:30: Reliability

- Show the contradiction between the inspection report and work-order closure.
- Show an uncertainty/gap statement.
- Briefly demonstrate that an unrelated question causes abstention.

### 3:30-4:30: Agentic tools with control

- Show asset history and inventory tool results.
- Show the proposed work order.
- Demonstrate that the engineer cannot self-approve it.

### 4:30-5:15: Human approval and audit

- Login as supervisor.
- Review evidence and approve or reject.
- Open the audit trail and show the recorded decision.

### 5:15-6:00: Differentiator and close

- Show the prompt-injection record being blocked, if implemented.
- State measured retrieval/citation results.
- Close with the core claim: local intelligence, grounded evidence, bounded actions, and human
  accountability.

Do not spend demo time explaining framework names unless a judge asks. Show the workflow and
the proof first.

---

## 10. Failure And Backup Plan

### Before judging

- Pull all models and Docker images at least one day earlier.
- Run the golden workflow three times from a clean database.
- Warm the model 10-15 minutes before presentation.
- Export a known-good Qdrant snapshot and Postgres backup.
- Keep the synthetic corpus and reset script locally.
- Record a complete two-minute backup video.
- Keep screenshots of evaluation results and architecture.

### During judging

| Failure | Recovery |
|---|---|
| Model cold start | Explain local loading and use the already-completed investigation |
| Ollama unavailable | Restart only Ollama; retain job and retrieved evidence |
| SSE disconnect | Refresh; reconnect from the last event ID |
| OCR too slow | Use the pre-indexed corpus; ingestion is not part of the golden flow |
| Docker service failure | Run Ollama natively and restart the affected container only |
| GPU memory pressure | Reduce context to 4096 and ensure only one LLM is loaded |
| Complete live failure | Play the short backup video, then inspect stored evidence/audit live |

Never replace a failed local model with an undisclosed cloud API during the demo.

---

## 11. Final Readiness Checklist

### Product

- [ ] Engineer login works.
- [ ] Supervisor login works.
- [ ] Golden investigation completes with the real local model.
- [ ] At least three citations resolve to stored evidence.
- [ ] No-evidence query abstains.
- [ ] Asset-history tool returns real seeded data.
- [ ] Inventory tool returns real seeded data.
- [ ] Work-order proposal pauses for approval.
- [ ] Engineer cannot approve.
- [ ] Supervisor decision resumes/completes the flow.
- [ ] Audit trail includes job, retrieval, tool, proposal, and decision events.
- [ ] Workflow stages are visible through AI Elements and reflect real SSE events.
- [ ] Tool calls expose safe inputs, outputs, denials, and errors.
- [ ] Final findings render as sanitized Markdown.
- [ ] Sources open the exact local evidence passage.
- [ ] Approval confirmation is interactive only for a supervisor.

### Engineering

- [ ] Fresh-clone installation works from the README.
- [ ] API Python dependencies are pinned.
- [ ] Web and API Dockerfiles build.
- [ ] Python, frontend, and contract tests pass.
- [ ] No generated databases, caches, bytecode, or secrets are tracked.
- [ ] API health reports degraded when Qdrant or Ollama is unavailable.
- [ ] Qdrant applies role filters before returning chunks.
- [ ] SSE `payload_ref` artifacts use typed, authenticated responses.
- [ ] Replayed SSE events do not duplicate workflow or tool activity.
- [ ] Markdown rendering blocks raw HTML and remote embedded content.
- [ ] UI never renders private chain-of-thought, system prompts, or restricted chunks.
- [ ] Job execution survives or cleanly recovers from API restart.
- [ ] Duplicate approval requests cannot create duplicate work orders.

### Demo

- [ ] Entire workflow works with internet disconnected.
- [ ] Model is pre-pulled and warmed.
- [ ] Corpus is pre-indexed.
- [ ] Laptop is plugged in and in performance/dGPU mode.
- [ ] Golden workflow finishes in less than 90 seconds after warm-up.
- [ ] 1366x768 layout has no overflow or overlapping text.
- [ ] Reset and backup scripts have been tested.
- [ ] Two-minute backup video is available locally.
- [ ] Every team member knows the opening, handoff, and closing lines.

---

## 12. Internal-Round Success Criteria

The build is ready to submit when the team can truthfully make and demonstrate these claims:

1. **Sovereign:** all inference and data remain on the local machine.
2. **Grounded:** important findings link to exact evidence chunks.
3. **Agentic:** the system retrieves evidence and invokes typed tools as part of a controlled
   workflow.
4. **Bounded:** consequential actions require role-checked human approval.
5. **Auditable:** investigation and approval events are traceable and tamper-evident.
6. **Useful:** the demo resolves a realistic maintenance investigation rather than presenting
   a general-purpose chatbot.

Anything that does not strengthen one of these six claims is lower priority for the internal
hackathon.
