import { beforeEach, describe, expect, it } from "vitest";
import { buildScript, createMockJob, scenarioKindForObjective } from "@/test-mocks/db";
import { ApiError, handleMockRequest } from "@/test-mocks/router";
import { isJobArtifact } from "@/lib/artifacts";

const engToken = "mock-token-engineer";

let approvalJobId = "";
let completedJobId = "";

describe("contract doubles: artifacts + evidence (ratified 2026-08-29)", () => {
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

  it("attaches ratified payload_refs to stream events", () => {
    const approvalScript = buildScript(approvalJobId, "awaiting_approval");
    const approval = approvalScript.find((s) => s.type === "awaiting_approval");
    expect(approval?.payload_ref).toBe("approval_request");

    const completedScript = buildScript(completedJobId, "completed");
    const tool = completedScript.find((s) => s.type === "tool_called");
    expect(tool?.payload_ref).toBe("search_documents");
  });

  it("serves the search_documents tool artifact", () => {
    const artifact = handleMockRequest(
      "GET",
      `/api/jobs/${completedJobId}/artifacts/search_documents`,
      { token: engToken }
    ) as { kind: string; tool: Record<string, unknown> };
    expect(artifact.kind).toBe("tool");
    expect(artifact.tool.tool_name).toBe("search_documents");
    expect(isJobArtifact(artifact)).toBe(true);
  });

  it("serves the approval_request artifact with ratified fields", () => {
    const artifact = handleMockRequest(
      "GET",
      `/api/jobs/${approvalJobId}/artifacts/approval_request`,
      { token: engToken }
    ) as { kind: string; approval: Record<string, unknown> };
    expect(artifact.kind).toBe("approval");
    expect(artifact.approval.risk_level).toBe("medium");
    expect(artifact.approval.status).toBe("pending");
    expect(artifact.approval.requested_at).toBeTruthy();
  });

  it("404s unknown artifact refs", () => {
    expect(() =>
      handleMockRequest("GET", `/api/jobs/${approvalJobId}/artifacts/bogus`, {
        token: engToken,
      })
    ).toThrowError(ApiError);
  });

  it("serves evidence chunks via the ratified evidence endpoint", () => {
    const chunk = handleMockRequest(
      "GET",
      `/api/jobs/${completedJobId}/evidence/${encodeURIComponent("chunk_oem_p41")}`,
      { token: engToken }
    ) as Record<string, unknown>;
    expect(chunk.chunk_id).toBe("chunk_oem_p41");
    expect(chunk.document_id).toBe("doc-oem-pumps");
    expect(chunk.confidentiality_level).toBe("internal");
    expect(chunk.content_hash).toBeTruthy();
    expect(chunk.why_retrieved).toBeTruthy();
  });

  it("serves document content with chunks for the deep link", () => {
    const doc = handleMockRequest(
      "GET",
      `/api/documents/${encodeURIComponent("doc-oem-pumps")}/content`,
      { token: engToken }
    ) as { document: Record<string, unknown>; chunks: unknown[] };
    expect(doc.document.document_id).toBe("doc-oem-pumps");
    expect(doc.chunks.length).toBeGreaterThan(0);
  });

  it("getArtifact client returns the typed tool artifact", async () => {
    window.localStorage.setItem(
      "nirva.auth",
      JSON.stringify({
        token: engToken,
        user: { user_id: "u-eng-0001", username: "engineer", role: "engineer" },
      })
    );
    const { getArtifact } = await import("@/lib/api");
    const artifact = await getArtifact(completedJobId, "search_documents");
    expect(artifact.kind).toBe("tool");
  });

  it("scenario mapping unchanged", () => {
    expect(scenarioKindForObjective("create a work order")).toBe(
      "awaiting_approval"
    );
  });
});
