import { describe, expect, it } from "vitest";
import { clientFilterByDate, formatJobDate } from "@/components/InvestigationsList";
import type { JobSummary } from "@/lib/types";

function job(id: string, createdAt: string): JobSummary {
  return {
    job_id: id,
    objective_summary: `objective ${id}`,
    status: "completed",
    equipment_id: "P-204",
    created_by: "u1",
    created_at: createdAt,
  };
}

describe("clientFilterByDate", () => {
  it("keeps jobs created on/after the from date", () => {
    const jobs = [
      job("a", "2026-08-01T10:00:00Z"),
      job("b", "2026-08-20T10:00:00Z"),
    ];
    const out = clientFilterByDate(jobs, "2026-08-15");
    expect(out.map((j) => j.job_id)).toEqual(["b"]);
  });

  it("returns all jobs when no date given", () => {
    const jobs = [job("a", "2026-08-01T10:00:00Z")];
    expect(clientFilterByDate(jobs, "")).toHaveLength(1);
  });

  it("returns all jobs for an invalid date", () => {
    const jobs = [job("a", "2026-08-01T10:00:00Z")];
    expect(clientFilterByDate(jobs, "not-a-date")).toHaveLength(1);
  });
});

describe("formatJobDate", () => {
  it("formats a valid ISO date", () => {
    expect(formatJobDate("2026-08-01T10:00:00Z")).not.toBe("");
  });

  it("returns the raw string for invalid dates", () => {
    expect(formatJobDate("garbage")).toBe("garbage");
  });
});
