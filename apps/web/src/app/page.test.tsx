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

  it("renders a single h1 with the two-tone headline", () => {
    render(<LandingPage />);
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("The offline industrial investigation workbench.");
    expect(screen.getAllByText("NIRVA").length).toBeGreaterThanOrEqual(2);
  });

  it("shows 'Try the demo' CTA -> /login when unauthenticated", () => {
    render(<LandingPage />);
    const cta = screen.getAllByRole("link", { name: /Try the demo/i });
    expect(cta[0]).toHaveAttribute("href", "/login");
  });

  it("shows 'Open workbench' CTA -> /investigations when auth exists (post-hydration)", async () => {
    setAuth("engineer");
    render(<LandingPage />);
    const cta = await screen.findAllByRole("link", { name: /Open workbench/i });
    expect(cta[0]).toHaveAttribute("href", "/investigations");
  });

  it("carries the golden question inside the engine window", () => {
    render(<LandingPage />);
    expect(
      screen.getByText(/has failed repeatedly\. Compare maintenance history/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Read maintenance history/i)).toBeInTheDocument();
    expect(screen.getByText(/Cross-reference OEM manual rev C/i)).toBeInTheDocument();
    expect(screen.getByText(/Contradiction detected/i)).toBeInTheDocument();
    expect(screen.getByText(/87%/i)).toBeInTheDocument();
    expect(screen.getByText(/Awaiting supervisor decision/i)).toBeInTheDocument();
    expect(screen.getByText(/OEM Manual, rev C, p.41/i)).toBeInTheDocument();
  });

  it("renders the journey flowchart with branches and honest abstention", () => {
    render(<LandingPage />);
    expect(screen.getByText(/From question to signed-off action/i)).toBeInTheDocument();
    expect(screen.getByText("Engineer asks a question")).toBeInTheDocument();
    expect(screen.getByText("consistent?", { selector: "text" })).toBeInTheDocument();
    expect(screen.getByText("Conflicting records")).toBeInTheDocument();
    expect(screen.getByText(/abstains honestly/i, { selector: "text" })).toBeInTheDocument();
    expect(screen.getByText("Cited recommendation")).toBeInTheDocument();
    expect(screen.getByText("Work-order draft")).toBeInTheDocument();
    expect(screen.getByText(/Supervisor approval gate/i)).toBeInTheDocument();
  });

  it("renders features, roles, differentiator band and metrics", () => {
    render(<LandingPage />);
    expect(screen.getByText("Grounded citations")).toBeInTheDocument();
    expect(screen.getByText("Human approval gate")).toBeInTheDocument();
    expect(screen.getByText("Contradiction surfacing")).toBeInTheDocument();
    expect(screen.getByText("Air-gapped sovereignty")).toBeInTheDocument();
    expect(screen.getByText("Tamper-evident audit trail")).toBeInTheDocument();
    expect(screen.getByText("Role-based access control")).toBeInTheDocument();
    expect(screen.getByText(/Four roles, least privilege/i)).toBeInTheDocument();
    expect(screen.getByText(/Runs inside your walls/i)).toBeInTheDocument();
    expect(screen.getByText(/From evidence to action — inside your walls/i)).toBeInTheDocument();
    expect(screen.getByText(/The numbers that matter/i)).toBeInTheDocument();
    expect(screen.getByText(/cloud calls eliminated/i)).toBeInTheDocument();
    expect(screen.getByText(/approval bypasses recorded/i)).toBeInTheDocument();
  });

  it("renders the nav meta line and the synthetic-data footer", () => {
    render(<LandingPage />);
    expect(screen.getByText("SIH 2026")).toBeInTheDocument();
    expect(screen.getByText("PSC26117")).toBeInTheDocument();
    expect(screen.getByText("MRPL", { ignore: "script, style" })).toBeTruthy();
    expect(screen.getByText(/NIRVA — SIH26117 · All demo data is synthetic/i)).toBeInTheDocument();
  });
});
