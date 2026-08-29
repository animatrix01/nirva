import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DetailPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ jobId: "job-seed-0001" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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

  it("renders the job header and streams the timeline to completion", async () => {
    render(<DetailPage />);

    await waitFor(
      () =>
        expect(screen.getByText(/Pump P-204 has failed repeatedly/i)).toBeInTheDocument(),
      { timeout: 5000 }
    );

    // Streaming timeline: intake node appears with events
    await waitFor(
      () => expect(screen.getByText(/final state: completed/i)).toBeInTheDocument(),
      { timeout: 10000 }
    );

    // Final report section from frozen JobDetail contract
    expect(screen.getByText(/final report/i)).toBeInTheDocument();
    expect(screen.getByText(/confidence/i)).toBeInTheDocument();
  }, 20000);
});
