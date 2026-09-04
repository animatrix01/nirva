# NIRVA — Pre-Judging Checklist (verified ritual)

Follow this exact sequence the day of the demo. Every step has been tested.

## T-24 hours (day before)

- [ ] Laptop plugged in, performance / dGPU mode enabled
- [ ] All Docker containers running: `docker compose -f infra/compose/docker-compose.yml up -d`
- [ ] Ollama running natively with models pulled: `ollama list` shows `qwen2.5:3b-instruct-q4_K_M`, `qwen2.5vl:3b`, `bge-m3`
- [ ] API healthy: `curl http://127.0.0.1:8000/api/health` → all services up
- [ ] Web up: `http://localhost:3000` loads
- [ ] Corpus indexed: 8+ documents in the library
- [ ] Qdrant responds: `curl http://127.0.0.1:6333/readyz`

## T-1 hour (demo prep)

- [ ] Run the reset ritual (below) to get a clean demo state
- [ ] Warm the model: submit one investigation, wait for completion, then approve it as supervisor
- [ ] Run ONE full golden investigation after warm-up → confirm < 90 seconds from submit to awaiting_approval
- [ ] Verify audit trail shows the full chain with injection_blocked if the poisoned doc was queried
- [ ] Disconnect internet
- [ ] Run one more investigation to prove offline operation
- [ ] Reconnect internet for the actual demo (or leave disconnected for the full demo)

## Reset ritual (clean demo state)

```bash
# 1. Purge test investigations, keep the golden awaiting_approval card
python scripts/purge-jobs.py

# 2. Re-run the golden investigation through the real API
python scripts/rerun-golden.py

# 3. Verify: 1 awaiting approval, 15+ completed, audit chain valid
curl http://127.0.0.1:8000/api/jobs -H "Authorization: Bearer <engineer_token>"
```

## Demo roles (all: nirva-demo-pass)

| Role | Username | Sees |
|---|---|---|
| Engineer | engineer | Investigations, Documents, upload, citations |
| Supervisor | supervisor | + Approvals (approve/reject), all investigations |
| Safety Officer | safety_officer | + Audit, all investigations (read-only) |
| Admin | admin | + System (model registry), all of the above |

## Failure recovery

| Failure | Action |
|---|---|
| Model cold start | Submit a test investigation to warm up, then present the already-completed one |
| Ollama unavailable | `ollama serve` or start the Ollama desktop app |
| SSE disconnect | Page refreshes; reconnects from last event ID |
| Docker down | Restart Docker Desktop; containers auto-restart (unless-stopped) |
| Qdrant down | `docker start nirva-qdrant`; data persists in the volume |

## The 6-minute flow (rehearsed ×3)

1. **0:00** — Landing page, disconnect internet, state the problem
2. **0:35** — Show health panel (all green), Local/Offline pill
3. **1:00** — Login as engineer, submit golden P-204 objective
4. **1:30** — Watch live timeline: injection blocked, evidence added, tools called
5. **2:30** — Report lands with citations — click TWO citations, show passages
6. **3:00** — Show contradiction (alignment completed vs NOT completed)
7. **3:30** — Show tool results (asset history, inventory SEAL-P204-KIT)
8. **4:00** — Show proposed work order — engineer CANNOT self-approve
9. **4:30** — Login as supervisor, approve → work order created
10. **5:00** — Show audit trail: full chain, injection_blocked, approval.approved
11. **5:30** — Show evaluation metrics (Recall@5, citation validity)
12. **6:00** — Close: "Local intelligence, grounded evidence, bounded actions, human accountability"
