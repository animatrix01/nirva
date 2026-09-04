import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LandingPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
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
    push.mockClear();
  });

  it("renders a single h1 with the two-tone headline", () => {
    render(<LandingPage />);
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("The offline industrial");
    expect(
      screen.getByText((_, el) => el?.tagName === "H1" && el.textContent === "The offline industrial investigation workbench.")
    ).toBeInTheDocument();
    expect(screen.getAllByText("NIRVA").length).toBeGreaterThanOrEqual(2);
  });

  it("opens the login modal from 'Try the demo' when unauthenticated", async () => {
    const user = userEvent.setup();
    render(<LandingPage />);
    const cta = screen.getAllByRole("link", { name: /Try the demo/i })[0];
    await user.click(cta);
    const dialog = await screen.findByRole("dialog", { name: /sign in/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getAllByLabelText(/username/i).length).toBeGreaterThan(0);
    expect(push).not.toHaveBeenCalled();
  });

  it("signs in through the modal and routes to workbench", async () => {
    const user = userEvent.setup();
    render(<LandingPage />);
    await user.click(screen.getAllByRole("link", { name: /Try the demo/i })[0]);
    await screen.findByRole("dialog");
    await user.type(screen.getByLabelText(/username/i), "engineer");
    await user.type(screen.getByLabelText(/password/i), "nirva-demo-pass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/workbench"));
    const stored = JSON.parse(
      window.localStorage.getItem("nirva.auth") ?? "null"
    ) as { user: { role: string } } | null;
    expect(stored?.user.role).toBe("engineer");
  });

  it("shows 'Open workbench' links when auth exists (post-hydration)", async () => {
    setAuth("engineer");
    render(<LandingPage />);
    const links = await screen.findAllByRole("link", {
      name: /Open workbench/i,
    });
    expect(links.length).toBeGreaterThan(0);
  });

  it("carries the golden question inside the engine window", () => {
    render(<LandingPage />);
    expect(screen.getByText(/has failed repeatedly/i)).toBeInTheDocument();
    expect(screen.getByText(/Read maintenance history/i)).toBeInTheDocument();
    expect(screen.getByText(/Cross-reference OEM manual rev C/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Contradiction detected/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("87%")).toBeInTheDocument();
    expect(screen.getByText(/Awaiting supervisor decision/i)).toBeInTheDocument();
    expect(screen.getByText(/OEM Manual, rev C, p\.41/i)).toBeInTheDocument();
  });

  it("renders the journey workflow with branches and honest abstention", () => {
    render(<LandingPage />);
    expect(screen.getByText(/signed-off action/i)).toBeInTheDocument();
    expect(screen.getByText("Engineer asks")).toBeInTheDocument();
    expect(screen.getByText("Records")).toBeInTheDocument();
    expect(screen.getByText("Conflicting records")).toBeInTheDocument();
    expect(screen.getAllByText(/abstains honestly/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Cited recommendation")).toBeInTheDocument();
    expect(screen.getByText("Work-order draft")).toBeInTheDocument();
    expect(screen.getByText(/Supervisor approval gate/i)).toBeInTheDocument();
  });

  it("renders role cards, principles and metrics", () => {
    render(<LandingPage />);
    expect(
      screen.getByText((_, el) => el?.tagName === "H2" && /Four roles, least privilege/.test(el.textContent ?? ""))
    ).toBeInTheDocument();
    expect(screen.getByText(/Runs inside your walls/i)).toBeInTheDocument();
    expect(screen.getByText(/From evidence to action — inside your walls/i)).toBeInTheDocument();
    expect(screen.getByText(/cloud calls eliminated/i)).toBeInTheDocument();
    expect(screen.getByText(/approval bypasses recorded/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Zero cloud calls — verified with network disconnected/i)
    ).toBeInTheDocument();
  });

  it("renders the FAQ and the synthetic-data footer", () => {
    render(<LandingPage />);
    expect(screen.getByText(/Frequently Asked Questions/i)).toBeInTheDocument();
    expect(screen.getByText(/What is NIRVA\?/i)).toBeInTheDocument();
    expect(
      screen.getByText(/NIRVA — SIH26117 · All demo data is synthetic/i)
    ).toBeInTheDocument();
    expect(screen.getByText("PSC26117 · MRPL")).toBeInTheDocument();
  });
});
