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

  it("renders stats plus the recently-completed and all-investigations sections", async () => {
    render(<InvestigationsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /investigations/i })
    ).toBeInTheDocument();
    await screen.findByText(/Recently completed/i);
    expect(screen.getByText(/All investigations/i)).toBeInTheDocument();
  });

  it("omits the approval queue when nothing is awaiting a decision", async () => {
    render(<InvestigationsPage />);
    await screen.findByText(/Recently completed/i);
    // Conditional section — must not leave an empty box on the page.
    expect(screen.queryByText(/Needs attention/i)).toBeNull();
    expect(screen.queryByText(/Nothing awaiting approval right now/i)).toBeNull();
  });

  it("gives the completed cards sources and confidence", async () => {
    render(<InvestigationsPage />);
    await screen.findAllByText(
      /Investigate why Pump P-204 has failed repeatedly/i
    );
    expect(screen.getAllByText(/sources/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/% confidence/i).length).toBeGreaterThanOrEqual(1);
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

  it("hides the filter selects until Filters is pressed, then reveals them", async () => {
    render(<InvestigationsPage />);
    await screen.findAllByText(/Investigate why Pump P-204 has failed repeatedly/i);

    const toggle = screen.getByRole("button", { name: /Filters/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText(/filter by status/i)).toBeNull();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filter by asset/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/filter by time/i)).toBeInTheDocument();
  });

  it("status filter narrows the All investigations table", async () => {
    render(<InvestigationsPage />);
    await screen.findAllByText(/Investigate why Pump P-204 has failed repeatedly/i);
    await userEvent.click(screen.getByRole("button", { name: /Filters/i }));
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
