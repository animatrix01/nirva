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

  it("renders pipeline, differentiator band, metrics and footer", () => {
    render(<LandingPage />);
    expect(screen.getByText(/How it works/i)).toBeInTheDocument();
    expect(screen.getByText("100% LOCAL")).toBeInTheDocument();
    expect(screen.getByText(/Runs inside your walls/i)).toBeInTheDocument();
    expect(screen.getByText(/no data egress/i)).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(
      screen.getByText(/NIRVA — SIH26117 · All demo data is synthetic/i)
    ).toBeInTheDocument();
  });
});
