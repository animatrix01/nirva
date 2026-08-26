import type { SseEvent } from "@/lib/types";
import { buildScript, findMockJob, scenarioKindForObjective } from "@/mocks/db";

// ---------------------------------------------------------------------------
// MOCK SSE STREAM — replays the §c.2 envelope over time, honoring Last-Event-ID
// replay semantics exactly like GET /api/jobs/{id}/events will.
// DELETE THIS ENTIRE /mocks FOLDER once status-api.md reports the real API live.
// ---------------------------------------------------------------------------

export interface MockStreamHandle {
  abort: () => void;
}

export function openMockJobStream(
  jobId: string,
  lastEventId: number,
  onEvent: (event: SseEvent) => void,
  onError?: (error: Error) => void
): MockStreamHandle {
  let aborted = false;
  const controller = { abort: () => (aborted = true) };

  const job = findMockJob(jobId);
  if (!job) {
    onError?.(new Error("404 unknown job"));
    return controller;
  }

  const kind = scenarioKindForObjective(job.objective);
  // If the job already reached a terminal/parked state, the script has fully
  // "played" — replay from the requested seq and stop, mirroring server replay.
  const fullScript = buildScript(jobId, kind);
  const pending = fullScript.filter((e) => e.seq >= lastEventId);

  void (async () => {
    for (const step of pending) {
      if (aborted) return;
      await new Promise((r) => setTimeout(r, step.delayMs));
      if (aborted) return;
      onEvent({
        job_id: step.job_id,
        seq: step.seq,
        type: step.type,
        node: step.node,
        payload_ref: step.payload_ref,
        ts: new Date().toISOString(),
      });
      job.status = terminalStatusFor(step.type);
      job.current_node = step.node;
      job.updated_at = new Date().toISOString();
    }
  })().catch((err: unknown) => {
    onError?.(err instanceof Error ? err : new Error(String(err)));
  });

  return controller;
}

function terminalStatusFor(type: SseEvent["type"]) {
  switch (type) {
    case "completed":
      return "completed" as const;
    case "failed":
      return "failed" as const;
    case "blocked_injection":
      return "blocked_injection" as const;
    case "awaiting_approval":
      return "awaiting_approval" as const;
    default:
      return "running" as const;
  }
}
