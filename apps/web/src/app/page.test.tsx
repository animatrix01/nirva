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

  it("renders the hero heading exactly once (single h1)", () => {
    render(<LandingPage />);
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("NIRVA");
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

  it("renders all 6 feature cards", () => {
    render(<LandingPage />);
    expect(screen.getByText("Grounded citations")).toBeInTheDocument();
    expect(screen.getByText("Read-only tools")).toBeInTheDocument();
    expect(screen.getByText("Contradiction surfacing")).toBeInTheDocument();
    expect(screen.getByText("Human approval gate")).toBeInTheDocument();
    expect(screen.getByText("Tamper-evident audit")).toBeInTheDocument();
    expect(screen.getByText("Role-based access")).toBeInTheDocument();
  });

  it("renders pipeline, analytics, terminal, roles, band, metrics and footer", () => {
    render(<LandingPage />);
    expect(screen.getByText(/How it works/i)).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("04")).toBeInTheDocument();
    expect(screen.getByText("100% LOCAL")).toBeInTheDocument();
    // Analytics (dark charts panel)
    expect(screen.getByText(/Measured, not claimed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Authorized chunks retrieved per step/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Illustrative demo data/i)).toBeInTheDocument();
    // Terminal
    expect(screen.getByText(/Every event, streamed and auditable/i)).toBeInTheDocument();
    expect(screen.getByText(/approval_request/)).toBeInTheDocument();
    expect(screen.getAllByText(/awaiting_approval/).length).toBeGreaterThanOrEqual(2);
    // Roles
    expect(screen.getByText(/Four roles, least privilege/i)).toBeInTheDocument();
    expect(screen.getByText(/The only role that can approve consequential actions/i)).toBeInTheDocument();
    // Differentiator + metrics + footer
    expect(screen.getByText(/Runs inside your walls/i)).toBeInTheDocument();
    expect(screen.getByText(/no data egress/i)).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(3); // 2 metric blocks + chart axis label
    expect(
      screen.getByText(/NIRVA — SIH26117 · All demo data is synthetic/i)
    ).toBeInTheDocument();
  });

  it("renders the hero workbench mock with timeline, citations and approval badge", () => {
    render(<LandingPage />);
    expect(screen.getByText(/NIRVA — Investigation P-204/i)).toBeInTheDocument();
    expect(screen.getByText(/composing cited findings/i)).toBeInTheDocument();
    expect(screen.getByText(/\[OEM Manual, rev C, p41\]/i)).toBeInTheDocument();
    expect(screen.getByText(/awaiting_approval — supervisor decision required/i)).toBeInTheDocument();
  });
});
