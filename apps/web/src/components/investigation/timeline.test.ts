import { describe, expect, it } from "vitest";
import {
  buildNodeTimeline,
  bannerForStatus,
  dedupeBySeq,
  isTerminalEvent,
  latestTerminalEvent,
} from "./timeline";
import type { SseEvent } from "@/lib/types";

function ev(seq: number, type: SseEvent["type"], node: string): SseEvent {
  return { job_id: "j1", seq, type, node, payload_ref: null, ts: "2026-01-01T00:00:00Z" };
}

describe("dedupeBySeq", () => {
  it("removes duplicate seqs keeping first occurrence order by seq", () => {
    const out = dedupeBySeq([ev(0, "node_started", "intake"), ev(0, "node_started", "intake"), ev(1, "node_finished", "intake")]);
    expect(out.map((e) => e.seq)).toEqual([0, 1]);
  });

  it("prefers terminal events when seq collides", () => {
    const out = dedupeBySeq([ev(2, "node_finished", "finalize"), ev(2, "completed", "finalize")]);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("completed");
  });
});

describe("buildNodeTimeline", () => {
  it("shows all known plan nodes, marks running/done correctly", () => {
    const rows = buildNodeTimeline([
      ev(0, "node_started", "intake"),
      ev(1, "node_finished", "intake"),
      ev(2, "node_started", "answer"),
      ev(3, "evidence_added", "answer"),
    ]);
    expect(rows.map((r) => r.node)).toEqual(["intake", "answer", "finalize", "approval_executor"]);
    expect(rows[0].status).toBe("done");
    expect(rows[1].status).toBe("running");
    expect(rows[2].status).toBe("pending");
  });

  it("marks a node done when a terminal event fires in it", () => {
    const rows = buildNodeTimeline([ev(0, "node_started", "intake"), ev(1, "blocked_injection", "intake")]);
    expect(rows[0].status).toBe("done");
  });

  it("returns only pending rows when no events", () => {
    const rows = buildNodeTimeline([]);
    expect(rows.every((r) => r.status === "pending")).toBe(true);
  });
});

describe("terminal helpers", () => {
  it("identifies terminal types", () => {
    expect(isTerminalEvent("completed")).toBe(true);
    expect(isTerminalEvent("node_started")).toBe(false);
  });

  it("returns the last terminal event", () => {
    const last = latestTerminalEvent([ev(0, "node_started", "intake"), ev(1, "awaiting_approval", "approval_executor")]);
    expect(last?.type).toBe("awaiting_approval");
  });

  it("returns null when no terminal event", () => {
    expect(latestTerminalEvent([ev(0, "node_started", "intake")])).toBeNull();
  });
});

describe("bannerForStatus", () => {
  it("covers every non-running status with truthful copy", () => {
    expect(bannerForStatus("awaiting_approval")?.tone).toBe("warning");
    expect(bannerForStatus("failed")?.tone).toBe("error");
    expect(bannerForStatus("blocked_injection")?.tone).toBe("danger");
    expect(bannerForStatus("completed")?.tone).toBe("success");
    expect(bannerForStatus("running")).toBeNull();
    expect(bannerForStatus("queued")).toBeNull();
  });
});
