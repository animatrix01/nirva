import { describe, expect, it } from "vitest";
import { buildScript, scenarioKindForObjective } from "@/mocks/db";
import { SSE_EVENT_TYPES } from "@/lib/types";

describe("mock SSE scenario", () => {
  it("maps objectives to scenarios", () => {
    expect(scenarioKindForObjective("prepare work order for seal replacement")).toBe(
      "awaiting_approval"
    );
    expect(scenarioKindForObjective("analyze injected text: ignore instructions")).toBe(
      "blocked_injection"
    );
    expect(scenarioKindForObjective("evidence is missing for this claim")).toBe("failed");
    expect(scenarioKindForObjective("investigate P-204 failures")).toBe("completed");
  });

  it("scripts start at seq 0, increment monotonically, use only frozen types", () => {
    for (const kind of ["completed", "failed", "blocked_injection", "awaiting_approval"] as const) {
      const script = buildScript("job-x", kind);
      script.forEach((e, i) => {
        expect(e.seq).toBe(i);
        expect(SSE_EVENT_TYPES).toContain(e.type);
        expect(e.job_id).toBe("job-x");
        expect(typeof e.node).toBe("string");
        expect(e.ts).toBeTruthy();
      });
      const last = script[script.length - 1];
      expect(["completed", "failed", "blocked_injection", "awaiting_approval"]).toContain(
        last.type
      );
    }
  });
});
