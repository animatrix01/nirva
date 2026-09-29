import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import EvaluationsPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => "/evaluations",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

function setAuth(role: string) {
  // Mock usernames: safety_officer signs in as "safety".
  const username = role === "safety_officer" ? "safety" : role;
  window.localStorage.setItem(
    "nirva.auth",
    JSON.stringify({
      token: `mock-token-${username}`,
      user: { user_id: `u-${username}`, username, role },
    })
  );
}

describe("EvaluationsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders grouped metrics, gates status strip and the per-case table", async () => {
    setAuth("admin");
    render(<EvaluationsPage />);
    await waitFor(() =>
      expect(screen.getByText(/Offline Evaluation Results/i)).toBeInTheDocument()
    );

    // Run metadata now lives in the status strip, not the subtitle.
    expect(screen.getByText("6ba15d6892c5")).toBeInTheDocument();
    expect(screen.getByText("105")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();

    // The six standalone KPI cards are replaced by three grouped sections.
    expect(screen.getByText("Retrieval Quality")).toBeInTheDocument();
    expect(screen.getByText("Answer Reliability")).toBeInTheDocument();
    expect(screen.getByText("Safety & Access")).toBeInTheDocument();

    // Every metric label survives the regrouping.
    expect(screen.getAllByText("Recall@5").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Citation validity")).toBeInTheDocument();
    expect(screen.getByText("Grounded answer rate")).toBeInTheDocument();
    expect(screen.getByText("Correct abstention rate")).toBeInTheDocument();
    expect(screen.getByText("Unauthorized retrievals")).toBeInTheDocument();
    expect(screen.getByText("Injection block rate")).toBeInTheDocument();

    // Gates status
    expect(screen.getByText(/All gates passed/i)).toBeInTheDocument();

    // Pagination replaces the old scroll box. The stubbed /api/evals fixture
    // carries 2 cases (summary.cases_executed is 105, cases[] is not padded to
    // match) — pagination is asserted on the real rendered count, not 105.
    expect(screen.getByText(/Showing 1–2 of 2 cases/i)).toBeInTheDocument();
    // One page of results → no pager controls.
    expect(screen.queryByLabelText("Next")).toBeNull();

    // Per-case table: real values, "—" for nulls (non-retrieval case)
    expect(screen.getByText("factual-000")).toBeInTheDocument();
    const table = screen.getByText("factual-000").closest("tr");
    expect(table).toHaveTextContent("—");
  });

  it("engineer sees the restriction note", () => {
    setAuth("engineer");
    render(<EvaluationsPage />);
    expect(
      screen.getByText(/Evaluations are restricted to admins and safety officers/i)
    ).toBeInTheDocument();
  });

  it("shows the honest empty state when the endpoint 404s", async () => {
    setAuth("safety_officer");
    const original = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({ detail: "No evaluation run yet", field: null }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      })
    );
    render(<EvaluationsPage />);
    await waitFor(() =>
      expect(screen.getByText(/No evaluation run yet/i)).toBeInTheDocument()
    );
    globalThis.fetch = original;
  });
});
