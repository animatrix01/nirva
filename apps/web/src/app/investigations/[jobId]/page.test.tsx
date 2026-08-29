import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DetailPage from "./page";
import type { SseEvent } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useParams: () => ({ jobId: "job-seed-0001" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Mock the SSE transport module (fetch-streaming can't run in jsdom); the
// events below use the exact frozen §c.2 envelope shapes.
vi.mock("@/lib/sse", () => ({
  openJobStream: (
    _jobId: string,
    handlers: { onEvent: (e: SseEvent) => void }
  ) => {
    const events: Array<Omit<SseEvent, "job_id" | "ts" | "payload_ref">> = [
      { seq: 0, type: "node_started", node: "intake" },
      { seq: 1, type: "node_finished", node: "intake" },
      { seq: 2, type: "node_started", node: "answer" },
      { seq: 3, type: "tool_called", node: "answer" },
      { seq: 4, type: "node_finished", node: "answer" },
      { seq: 5, type: "node_started", node: "finalize" },
      { seq: 6, type: "node_finished", node: "finalize" },
      { seq: 7, type: "completed", node: "finalize" },
    ];
    for (const e of events) {
      handlers.onEvent({
        ...e,
        job_id: "job-seed-0001",
        payload_ref: e.type === "tool_called" ? "search_documents" : null,
        ts: new Date().toISOString(),
      });
    }
    return { close: () => undefined };
  },
}));

describe("InvestigationDetailPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "nirva.auth",
      JSON.stringify({
        token: "mock-token-engineer",
        user: { user_id: "u-eng-0001", username: "engineer", role: "engineer" },
      })
    );
  });

  it("renders the job header, streams the timeline, and shows the structured-citation report", async () => {
    render(<DetailPage />);

    await waitFor(() =>
      expect(screen.getByText(/Pump P-204 has failed repeatedly/i)).toBeInTheDocument()
    );

    await waitFor(() =>
      expect(screen.getByText(/final state: completed/i)).toBeInTheDocument()
    );

    // Final report section from the ratified JobDetail contract
    expect(screen.getByText(/final report/i)).toBeInTheDocument();
    expect(screen.getByText(/confidence/i)).toBeInTheDocument();

    // Structured citations render as clickable [title, revision, locator]
    await waitFor(() =>
      expect(
        screen.getAllByText(/\[OEM Manual Centrifugal Pumps, rev C, page 41\]/i).length
      ).toBeGreaterThan(0)
    );
  }, 20000);
});
