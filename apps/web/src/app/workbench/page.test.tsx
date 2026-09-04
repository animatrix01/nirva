import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkbenchPage from "./page";
import { buildScript, createMockJob } from "@/test-mocks/db";

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
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

describe("WorkbenchPage role homes", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("engineer sees recent investigations, new-investigation CTA and documents shortcut", async () => {
    setAuth("engineer");
    createMockJob("Investigate P-204 seal failures", "P-204", "u-eng-0001");
    render(<WorkbenchPage />);
    expect(await screen.findByText(/Engineer workbench/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/Investigate P-204 seal failures/i)).toBeInTheDocument()
    );
    expect(screen.getByRole("link", { name: /New investigation/i })).toHaveAttribute(
      "href",
      "/investigations/new"
    );
    expect(screen.getByRole("link", { name: /Document library/i })).toHaveAttribute(
      "href",
      "/documents"
    );
  });

  it("supervisor sees the pending queue and can approve inline", async () => {
    setAuth("supervisor");
    const job = createMockJob("Prepare work order for P-204", "P-204", "u-eng-0001");
    buildScript(job.job_id, "awaiting_approval");
    render(<WorkbenchPage />);
    await waitFor(() =>
      expect(screen.getByText(/Pending approvals \(1\)/i)).toBeInTheDocument()
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /approve/i }));
    await waitFor(() =>
      expect(screen.getByText(/work order wo-/i)).toBeInTheDocument()
    );
    // Queue empties after decision
    await waitFor(() =>
      expect(screen.getByText(/Nothing awaiting your decision\./i)).toBeInTheDocument()
    );
  });

  it("safety officer sees the hash-chain badge and recent events", async () => {
    setAuth("safety_officer");
    render(<WorkbenchPage />);
    await waitFor(() =>
      expect(screen.getByText(/valid — tamper-evident/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/Recent audit events/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open full audit log/i })).toHaveAttribute(
      "href",
      "/audit"
    );
  });

  it("admin sees service health grid, model registry and library state", async () => {
    setAuth("admin");
    render(<WorkbenchPage />);
    await waitFor(() =>
      expect(screen.getByText("postgres")).toBeInTheDocument()
    );
    expect(
      screen.getByText((_, el) => el?.textContent === "Service health")
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/nirva-generator-8b/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/Document library state/i)).toBeInTheDocument();
  });
});
