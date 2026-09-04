import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InvestigationsPage from "./page";
import { createMockJob, mockJobs } from "@/test-mocks/db";

vi.mock("next/navigation", () => ({
  usePathname: () => "/investigations",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function setAuth(role: string) {
  window.localStorage.setItem(
    "nirva.auth",
    JSON.stringify({
      token: `mock-token-${role}`,
      user: { user_id: `u-${role}`, username: role, role },
    })
  );
}

describe("InvestigationsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setAuth("engineer");
  });

  it("renders stats and all four sections", async () => {
    render(<InvestigationsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /investigations/i })
    ).toBeInTheDocument();
    await screen.findByText(/Needs attention/i);
    expect(screen.getByText(/Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Recently completed/i)).toBeInTheDocument();
    expect(screen.getByText(/All investigations/i)).toBeInTheDocument();
  });

  it("shows the seeded completed job under Recently completed", async () => {
    render(<InvestigationsPage />);
    const hits = await screen.findAllByText(
      /Investigate why Pump P-204 has failed repeatedly/i
    );
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it("awaiting_approval jobs surface under Needs attention with their next step", async () => {
    const job = createMockJob(
      "Check spare-part inventory for the failing seal kit.",
      "P-204",
      "u-eng-0001"
    );
    // mutate the STORED record — createMockJob returns a copy
    const record = mockJobs.find((m) => m.job_id === job.job_id)!;
    record.status = "awaiting_approval";
    render(<InvestigationsPage />);
    const hits = await screen.findAllByText(
      /Check spare-part inventory for the failing seal kit/i
    );
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Supervisor approval required/i).length).toBeGreaterThanOrEqual(1);
  });

  it("status filter narrows the All investigations table", async () => {
    render(<InvestigationsPage />);
    await screen.findAllByText(/Investigate why Pump P-204 has failed repeatedly/i);
    const statusSelect = screen.getByLabelText(/filter by status/i);
    await userEvent.selectOptions(statusSelect, "failed");
    expect(
      screen.getByText(/No investigations match the current filters/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Investigate why Pump P-204 has failed repeatedly/i)
    ).toBeNull();
  });

  it("search filters by objective text", async () => {
    createMockJob(
      "Check whether heat exchanger E-110 fouling correlates with work orders.",
      "E-110",
      "u-eng-0001"
    );
    render(<InvestigationsPage />);
    const search = screen.getByPlaceholderText(/search investigations/i);
    await userEvent.type(search, "E-110 fouling");
    expect(screen.getByText(/heat exchanger E-110 fouling/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Investigate why Pump P-204 has failed repeatedly/i)
    ).toBeNull();
  });

  it("keeps the New investigation CTA pointing at the form", () => {
    render(<InvestigationsPage />);
    const cta = screen.getByRole("link", { name: /New investigation/i });
    expect(cta).toHaveAttribute("href", "/investigations/new");
  });
});
