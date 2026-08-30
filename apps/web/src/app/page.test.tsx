import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LandingPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function setAuth(role: string | null) {
  if (role === null) {
    window.localStorage.removeItem("nirva.auth");
    return;
  }
  window.localStorage.setItem(
    "nirva.auth",
    JSON.stringify({
      token: `mock-token-${role}`,
      user: { user_id: `u-${role}`, username: role, role },
    })
  );
}

describe("LandingPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders brand-first hero with tagline and golden question (single h1)", () => {
    render(<LandingPage />);
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(
      "The offline industrial investigation workbench"
    );
    expect(screen.getAllByText("NIRVA").length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(/From evidence to action — inside your walls/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Investigate why Pump P-204 has failed repeatedly/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The offline industrial investigation workbench/i)
    ).toBeInTheDocument();
  });

  it("shows 'Try it now' CTA when unauthenticated", () => {
    render(<LandingPage />);
    const cta = screen.getByRole("link", { name: /Try it now/i });
    expect(cta).toHaveAttribute("href", "/login");
  });

  it("shows 'Open workbench' CTA when auth exists (post-hydration)", async () => {
    setAuth("engineer");
    render(<LandingPage />);
    const cta = await screen.findByRole("link", { name: /Open workbench/i });
    expect(cta).toHaveAttribute("href", "/investigations");
  });

  it("renders the five domain steps without backend jargon", () => {
    render(<LandingPage />);
    expect(
      screen.getByText(/From question to signed-off action/i)
    ).toBeInTheDocument();
    for (const step of ["Ask", "Read", "Verify", "Propose", "Approve"]) {
      expect(screen.getByText(step)).toBeInTheDocument();
    }
    // Story sections stay jargon-free; stack names live only under the hood.
    expect(screen.queryByText(/Agent graph/i)).toBeNull();
    expect(screen.queryByText(/LangGraph plans/i)).toBeNull();
  });

  it("renders the hero mock in human language (no internal node names)", () => {
    render(<LandingPage />);
    expect(screen.getByText(/NIRVA — Investigating Pump P-204/i)).toBeInTheDocument();
    expect(screen.getByText(/Reading maintenance history/i)).toBeInTheDocument();
    expect(screen.getByText(/Checking the OEM manual/i)).toBeInTheDocument();
    expect(screen.getByText(/Comparing work orders/i)).toBeInTheDocument();
    expect(
      screen.getByText(/waiting for a supervisor's decision/i)
    ).toBeInTheDocument();
  });

  it("renders analytics, features, roles, band, metrics and footer", () => {
    render(<LandingPage />);
    expect(screen.getByText(/Measured, not claimed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Authorized chunks retrieved per step/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Illustrative demo data/i)).toBeInTheDocument();
    expect(screen.getByText("Grounded citations")).toBeInTheDocument();
    expect(screen.getByText("Read-only tools")).toBeInTheDocument();
    expect(screen.getByText("Contradiction surfacing")).toBeInTheDocument();
    expect(screen.getByText("Human approval gate")).toBeInTheDocument();
    expect(screen.getByText("Tamper-evident audit")).toBeInTheDocument();
    expect(screen.getByText("Role-based access")).toBeInTheDocument();
    expect(screen.getByText(/Four roles, least privilege/i)).toBeInTheDocument();
    expect(screen.getByText(/Under the hood/i)).toBeInTheDocument();
    expect(screen.getByText(/100% LOCAL/)).toBeInTheDocument();
    expect(screen.getByText(/Runs inside your walls/i)).toBeInTheDocument();
    expect(screen.getByText(/no data egress/i)).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(3); // 2 metrics + chart axis label
    expect(
      screen.getByText(/NIRVA — SIH26117 · All demo data is synthetic/i)
    ).toBeInTheDocument();
  });
});
