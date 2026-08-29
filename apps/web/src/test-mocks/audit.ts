import type { AuditResponse } from "@/lib/types";

// ---------------------------------------------------------------------------
// MOCK AUDIT — hash-chained event list (hash = H(payload || prev_hash)),
// verified on read like the frozen GET /api/audit contract.
// DELETE THIS ENTIRE /mocks FOLDER once the real API is live.
// ---------------------------------------------------------------------------

function mockHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return `${hex(h1)}${hex(h2)}${hex(h1 ^ h2)}${hex(h2 ^ h1)}`.repeat(2);
}

interface SeedEvent {
  event_id: string;
  job_id: string;
  actor: string;
  actor_role: string;
  action: string;
  argument_summary: string;
  outcome: "ok" | "error" | "blocked";
  ts: string;
}

const SEED_EVENTS: SeedEvent[] = [
  { event_id: "ev-0001", job_id: "job-seed-0001", actor: "u-eng-0001", actor_role: "engineer", action: "job_created", argument_summary: "objective='Investigate why Pump P-204…' equipment=P-204", outcome: "ok", ts: "2026-08-26T08:00:00Z" },
  { event_id: "ev-0002", job_id: "job-seed-0001", actor: "agent:intake", actor_role: "agent", action: "node_started", argument_summary: "node=intake", outcome: "ok", ts: "2026-08-26T08:00:01Z" },
  { event_id: "ev-0003", job_id: "job-seed-0001", actor: "agent:answer", actor_role: "agent", action: "search_documents", argument_summary: "query='P-204 seal failure', filters={equipment_id:P-204, allowed_roles:[engineer]}", outcome: "ok", ts: "2026-08-26T08:00:05Z" },
  { event_id: "ev-0004", job_id: "job-seed-0001", actor: "agent:answer", actor_role: "agent", action: "get_asset_history", argument_summary: "equipment_id=P-204, window=180d", outcome: "ok", ts: "2026-08-26T08:00:08Z" },
  { event_id: "ev-0005", job_id: "job-seed-0001", actor: "agent:finalize", actor_role: "agent", action: "node_finished", argument_summary: "node=finalize", outcome: "ok", ts: "2026-08-26T08:00:12Z" },
  { event_id: "ev-0006", job_id: "job-seed-0002", actor: "u-sup-0003", actor_role: "supervisor", action: "job_created", argument_summary: "objective='Check E-110 fouling…' equipment=E-110", outcome: "ok", ts: "2026-08-26T09:30:00Z" },
  { event_id: "ev-0007", job_id: "job-seed-0002", actor: "agent:answer", actor_role: "agent", action: "propose_work_order", argument_summary: "asset=P-204, parts=[SK-204]", outcome: "ok", ts: "2026-08-26T09:31:00Z" },
  { event_id: "ev-0008", job_id: "job-seed-0002", actor: "agent:approval_executor", actor_role: "agent", action: "approval_requested", argument_summary: "action=approve_work_order, risk=medium", outcome: "ok", ts: "2026-08-26T09:31:10Z" },
  { event_id: "ev-0009", job_id: "job-seed-0002", actor: "agent:intake", actor_role: "agent", action: "retrieval_injection_blocked", argument_summary: "source=incident_note.txt, pattern='ignore previous instructions'", outcome: "blocked", ts: "2026-08-26T09:31:20Z" },
];

const GENESIS = "0".repeat(64);

function buildChain(): AuditResponse["events"] {
  let prev = GENESIS;
  return SEED_EVENTS.map((e) => {
    const payload = JSON.stringify(e);
    const hash = mockHash(payload + prev);
    const event = { ...e, prev_hash: prev, hash };
    prev = hash;
    return event;
  });
}

export function getMockAudit(
  query: { job_id?: string | null; limit?: number } = {}
): AuditResponse {
  const chain = buildChain();
  const filtered = chain
    .filter((e) => (query.job_id ? e.job_id === query.job_id : true))
    .slice(0, query.limit ?? 50);
  // Verify chain integrity on read.
  let prev = GENESIS;
  let valid = true;
  for (const e of chain) {
    if (e.prev_hash !== prev) valid = false;
    prev = e.hash;
  }
  return { chain_valid: valid, events: filtered };
}

export function getMockHealth(): {
  status: "ok" | "degraded";
  services: {
    postgres: "up" | "down";
    qdrant: "up" | "down";
    model_gateway: "up" | "down";
    storage: "up" | "down";
  };
  version: string;
} {
  return {
    status: "ok",
    services: {
      postgres: "up",
      qdrant: "up",
      model_gateway: "up",
      storage: "up",
    },
    version: "0.1.0-mock",
  };
}
