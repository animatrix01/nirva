import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LandingPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

// Mirrors HC_PRINCIPLES in ./page — the Human Control principles strip.
const HC_PRINCIPLE_COPY = [
  "One investigation, four controlled views",
  "Least privilege by default",
  "One approval authority",
  "Every consequential action is auditable",
];

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
    expect(screen.getAllByText(/NIRVA caught a conflict/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("87%")).toBeInTheDocument();
    expect(screen.getByText(/Paused for sign-off/i)).toBeInTheDocument();
    expect(screen.getByText(/OEM Manual, rev C, p\.41/i)).toBeInTheDocument();
  });

  it("renders the hero proof row and the plant source list", () => {
    render(<LandingPage />);

    // Proof row — three product principles, not feature cards.
    const principles = [
      ["On-premise", "Your data stays inside"],
      ["Source-traceable", "Every claim linked"],
      ["Human-approved", "Actions under control"],
    ] as const;
    for (const [k, v] of principles) {
      expect(screen.getByText(k, { selector: "dt" })).toBeInTheDocument();
      expect(screen.getByText(v, { selector: "dd" })).toBeInTheDocument();
    }

    // Source list — an editorial row, not a diagram.
    expect(
      screen.getByText(/One question\. Multiple plant sources\./i, { selector: "p" })
    ).toBeInTheDocument();
    for (const label of ["Manuals", "Logs", "Drawings", "Images", "Work orders"]) {
      expect(screen.getByText(label, { selector: "div" })).toBeInTheDocument();
    }
  });

  it("renders the role section, sovereignty principles and runtime panel", () => {
    render(<LandingPage />);
    const h2 = (re: RegExp) =>
      screen.getByText((_, el) => el?.tagName === "H2" && re.test(el.textContent ?? ""));

    // Human control
    expect(h2(/The right view for every role on the investigation\./)).toBeInTheDocument();
    expect(
      screen.getByText(/One investigation, four purpose-built responsibilities/i, {
        selector: "p",
      })
    ).toBeInTheDocument();
    for (const role of ["Engineer", "Supervisor", "Safety Officer", "Admin"]) {
      expect(screen.getByText(role, { selector: "h3" })).toBeInTheDocument();
    }
    for (const tag of ["Investigates", "Approves", "Audits", "Manages"]) {
      expect(screen.getByText(tag, { selector: "span" })).toBeInTheDocument();
    }
    for (const p of HC_PRINCIPLE_COPY) {
      expect(screen.getByText(p)).toBeInTheDocument();
    }

    // Sovereignty
    expect(screen.getByText(/Sovereign by Design/i, { selector: "p" })).toBeInTheDocument();
    expect(h2(/Plant data stays inside the facility/)).toBeInTheDocument();
    expect(screen.getByText("On-premise deployment", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Local AI models", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Air-gapped capable", { selector: "p" })).toBeInTheDocument();

    // Runtime panel
    expect(screen.getByText("Network Status", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/zero external calls/i, { selector: "p" })).toBeInTheDocument();
    for (const [label, value] of [
      ["External network", "Disconnected"],
      ["Local vector store", "Active"],
      ["On-device inference", "Running"],
      ["Investigation engine", "Operational"],
    ] as const) {
      expect(screen.getByText(label, { selector: "span" })).toBeInTheDocument();
      expect(screen.getAllByText(value, { selector: "span" }).length).toBeGreaterThanOrEqual(1);
    }
    expect(
      screen.getByText(/Verified operational with zero external dependencies/i, {
        selector: "p",
      })
    ).toBeInTheDocument();
  });

  it("renders the FAQ and the synthetic-data footer", () => {
    render(<LandingPage />);
    expect(screen.getByText(/Common questions/i, { selector: "h2" })).toBeInTheDocument();
    expect(screen.getByText(/What is NIRVA\?/i, { selector: "span" })).toBeInTheDocument();
    expect(
      screen.getByText(/SIH26117 · PSC26117 · MRPL/, { selector: "span" })
    ).toBeInTheDocument();
    expect(screen.getByText(/All demo data synthetic/, { selector: "span" })).toBeInTheDocument();
  });
});
