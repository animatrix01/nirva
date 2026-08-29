import { beforeEach, describe, expect, it } from "vitest";
import { buildScript, createMockJob, scenarioKindForObjective } from "@/mocks/db";
import { ApiError, handleMockRequest } from "@/mocks/router";
import { isJobArtifact } from "@/lib/artifacts";

const engToken = "mock-token-engineer";

let approvalJobId = "";
let completedJobId = "";

describe("mock artifacts", () => {
  beforeEach(() => {
    approvalJobId = createMockJob(
      "Prepare work order for P-204 seal replacement",
      "P-204",
      "u-eng-0001"
    ).job_id;
    buildScript(approvalJobId, "awaiting_approval");

    completedJobId = createMockJob(
      "Investigate why Pump P-204 has failed repeatedly",
      "P-204",
      "u-eng-0001"
    ).job_id;
    buildScript(completedJobId, "completed");
  });

  it("attaches payload_refs to evidence/approval events", () => {
    const script = buildScript(approvalJobId, "awaiting_approval");
    const evidence = script.find((s) => s.type === "evidence_added");
    const approval = script.find((s) => s.type === "awaiting_approval");
    expect(evidence?.payload_ref).toBe(`ev:${approvalJobId}:${evidence?.seq}`);
    expect(approval?.payload_ref).toBe(`appr:${approvalJobId}:0`);
  });

  it("serves an evidence artifact via the mock router", () => {
    const ref = `ev:${approvalJobId}:3`;
    const artifact = handleMockRequest(
      "GET",
      `/api/jobs/${approvalJobId}/artifacts/${encodeURIComponent(ref)}`,
      { token: engToken }
    ) as { kind: string };
    expect(artifact.kind).toBe("evidence");
    expect(isJobArtifact(artifact)).toBe(true);
  });

  it("serves an approval artifact with frozen approval fields", () => {
    const ref = `appr:${approvalJobId}:0`;
    const artifact = handleMockRequest(
      "GET",
      `/api/jobs/${approvalJobId}/artifacts/${encodeURIComponent(ref)}`,
      { token: engToken }
    ) as { kind: string; approval: Record<string, unknown> };
    expect(artifact.kind).toBe("approval");
    expect(artifact.approval.risk_level).toBe("medium");
    expect(artifact.approval.required_role).toBe("supervisor");
    expect(artifact.approval.status).toBe("pending");
  });

  it("404s for unknown refs and refs of another job", () => {
    const foreign = () =>
      handleMockRequest(
        "GET",
        `/api/jobs/${approvalJobId}/artifacts/${encodeURIComponent("ev:job-unknown:0")}`,
        { token: engToken }
      );
    expect(foreign).toThrowError(ApiError);

    const missing = () =>
      handleMockRequest(
        "GET",
        `/api/jobs/${approvalJobId}/artifacts/${encodeURIComponent(`ev:job-9999:0`)}`,
        { token: engToken }
      );
    expect(missing).toThrowError(ApiError);
  });

  it("getArtifact returns the typed tool artifact", async () => {
    window.localStorage.setItem(
      "nirva.auth",
      JSON.stringify({
        token: engToken,
        user: { user_id: "u-eng-0001", username: "engineer", role: "engineer" },
      })
    );
    const { getArtifact } = await import("@/lib/api");
    const artifact = await getArtifact(completedJobId, `tool:${completedJobId}:0`);
    expect(artifact.kind).toBe("tool");
  });

  it("scenario mapping unchanged", () => {
    expect(scenarioKindForObjective("create a work order")).toBe(
      "awaiting_approval"
    );
  });
});
