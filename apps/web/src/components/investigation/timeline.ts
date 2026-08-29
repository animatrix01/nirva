import type { JobStatus, SseEvent } from "@/lib/types";

// Phase 1 deterministic graph (COMMON.md §c.3): intake -> answer -> finalize.
// awaiting_approval may add an approval node. Unknown nodes appear on demand.
export const KNOWN_PLAN_NODES = [
  "intake",
  "answer",
  "finalize",
  "approval_executor",
] as const;

export const TERMINAL_EVENT_TYPES = [
  "completed",
  "failed",
  "blocked_injection",
  "awaiting_approval",
] as const;

export type TerminalEventType = (typeof TERMINAL_EVENT_TYPES)[number];

export function isTerminalEvent(type: SseEvent["type"]): boolean {
  return (TERMINAL_EVENT_TYPES as readonly string[]).includes(type);
}

export function dedupeBySeq(events: SseEvent[]): SseEvent[] {
  const bySeq = new Map<number, SseEvent>();
  for (const e of events) {
    const existing = bySeq.get(e.seq);
    if (!existing) {
      bySeq.set(e.seq, e);
      continue;
    }
    // Duplicate seq: keep the terminal one if either is terminal (replay edge).
    if (isTerminalEvent(e.type) && !isTerminalEvent(existing.type)) {
      bySeq.set(e.seq, e);
    }
  }
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

export interface NodeTimelineRow {
  node: string;
  status: "pending" | "running" | "done";
  events: SseEvent[];
}

export function buildNodeTimeline(events: SseEvent[]): NodeTimelineRow[] {
  const rows = new Map<string, NodeTimelineRow>();
  const ensure = (node: string): NodeTimelineRow => {
    let row = rows.get(node);
    if (!row) {
      row = { node, status: "pending", events: [] };
      rows.set(node, row);
    }
    return row;
  };

  for (const node of KNOWN_PLAN_NODES) ensure(node);

  for (const e of dedupeBySeq(events)) {
    const row = ensure(e.node);
    if (row.events.length === 0 && row.status === "pending") {
      row.status = "running";
    }
    row.events.push(e);
    if (e.type === "node_finished" || isTerminalEvent(e.type)) {
      row.status = "done";
    }
  }
  return [...rows.values()];
}

export function latestTerminalEvent(
  events: SseEvent[]
): SseEvent | null {
  const terminal = dedupeBySeq(events).filter((e) => isTerminalEvent(e.type));
  return terminal.length > 0 ? terminal[terminal.length - 1] : null;
}

export function bannerForStatus(status: JobStatus): {
  tone: "info" | "success" | "error" | "warning" | "danger";
  text: string;
} | null {
  switch (status) {
    case "awaiting_approval":
      return {
        tone: "warning",
        text: "Waiting for supervisor approval before any consequential action.",
      };
    case "failed":
      return {
        tone: "error",
        text: "Investigation failed — evidence was insufficient to proceed safely.",
      };
    case "blocked_injection":
      return {
        tone: "danger",
        text: "Blocked: retrieved content attempted to inject instructions. Evidence was zoned as data, not commands.",
      };
    case "completed":
      return { tone: "success", text: "Investigation completed." };
    default:
      return null;
  }
}
