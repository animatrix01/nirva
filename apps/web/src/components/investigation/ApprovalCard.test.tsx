import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApprovalCard } from "@/components/investigation/ApprovalCard";
import { buildScript, createMockJob } from "@/mocks/db";
import { openMockJobStream } from "@/mocks/sse";
import { ApiError, handleMockRequest } from "@/mocks/router";
import type { ApprovalRequest } from "@/lib/artifacts";

const baseApproval: ApprovalRequest = {
  approval_id: "appr-x",
  job_id: "job-x",
  proposal_id: "prop-x",
  action: "approve_work_order",
  equipment_id: "P-204",
  arguments_summary: "Replace seal kit SK-204.",
  evidence_refs: ["chunk_a"],
  risk_level: "medium",
  requested_by: "agent:answer",
  required_role: "supervisor",
  status: "pending",
  decided_by: null,
  decided_at: null,
  comment: null,
  work_order_id: null,
};

describe("ApprovalCard states", () => {
  it("engineer sees read-only waiting state, no decision buttons", () => {
    render(<ApprovalCard approval={baseApproval} viewerRole="engineer" />);
    expect(screen.getByText(/cannot self-approve/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
  });

  it("supervisor sees enabled approve/reject for pending approval", () => {
    render(
      <ApprovalCard
        approval={baseApproval}
        viewerRole="supervisor"
        onDecide={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /approve/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /reject/i })).toBeEnabled();
  });

  it("decided approval shows decision, actor, comment, work-order id", () => {
    render(
      <ApprovalCard
        approval={{
          ...baseApproval,
          status: "approved",
          decided_by: "supervisor",
          decided_at: "2026-08-29T10:00:00Z",
          comment: "Verified flush line.",
          work_order_id: "wo-1001",
        }}
        viewerRole="engineer"
      />
    );
    expect(screen.getByText(/wo-1001/i)).toBeInTheDocument();
    expect(screen.getByText("supervisor", { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/Verified flush line\./i)).toBeInTheDocument();
  });
});

describe("mock approval endpoints (frozen §c.1)", () => {
  let jobId = "";
  let approvalId = "";

  beforeEach(() => {
    jobId = createMockJob("Prepare work order for P-204", "P-204", "u-eng-0001").job_id;
    buildScript(jobId, "awaiting_approval");
    approvalId = `appr-${jobId}`;
  });

  it("engineer is forbidden to list or decide approvals", () => {
    expect(() =>
      handleMockRequest("GET", "/api/approvals", { token: "mock-token-engineer" })
    ).toThrowError(ApiError);
    expect(() =>
      handleMockRequest("POST", `/api/approvals/${approvalId}/decision`, {
        token: "mock-token-engineer",
        body: { decision: "approved", comment: null },
      })
    ).toThrowError(ApiError);
  });

  it("supervisor lists and decides; second decision 409s; job completes", async () => {
    // Drive the job through the real mock stream until it parks at awaiting_approval
    await new Promise<void>((resolve) => {
      const handle = openMockJobStream(jobId, 0, (event) => {
        if (event.type === "awaiting_approval") {
          handle.abort();
          resolve();
        }
      });
    });

    const listed = handleMockRequest("GET", "/api/approvals", {
      token: "mock-token-supervisor",
    }) as Array<{ approval_id: string }>;
    expect(listed.map((a) => a.approval_id)).toContain(approvalId);

    const result = handleMockRequest("POST", `/api/approvals/${approvalId}/decision`, {
      token: "mock-token-supervisor",
      body: { decision: "approved", comment: "ok" },
    }) as { work_order_id: string | null };
    expect(result.work_order_id).toMatch(/^wo-/);

    expect(() =>
      handleMockRequest("POST", `/api/approvals/${approvalId}/decision`, {
        token: "mock-token-supervisor",
        body: { decision: "rejected", comment: null },
      })
    ).toThrowError(ApiError);
    try {
      handleMockRequest("POST", `/api/approvals/${approvalId}/decision`, {
        token: "mock-token-supervisor",
        body: { decision: "rejected", comment: null },
      });
    } catch (err) {
      expect((err as ApiError).status).toBe(409);
    }

    const job = handleMockRequest("GET", `/api/jobs/${jobId}`, {
      token: "mock-token-supervisor",
    }) as { status: string };
    expect(job.status).toBe("completed");
  }, 10000);

  it("rejects invalid decision payloads with typed 422", () => {
    expect(() =>
      handleMockRequest("POST", `/api/approvals/${approvalId}/decision`, {
        token: "mock-token-supervisor",
        body: { decision: "maybe" },
      })
    ).toThrowError(ApiError);
  });
});

describe("engineer approval flow end-to-end (component)", () => {
  it("supervisor decision updates the card state", async () => {
    const onDecide = vi.fn();
    const { rerender } = render(
      <ApprovalCard
        approval={baseApproval}
        viewerRole="supervisor"
        onDecide={onDecide}
      />
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /approve/i }));
    expect(onDecide).toHaveBeenCalledWith("approved", null);

    rerender(
      <ApprovalCard
        approval={{ ...baseApproval, status: "approved", decided_by: "supervisor", work_order_id: "wo-2" }}
        viewerRole="supervisor"
      />
    );
    await waitFor(() => expect(screen.getByText(/wo-2/i)).toBeInTheDocument());
  });
});
