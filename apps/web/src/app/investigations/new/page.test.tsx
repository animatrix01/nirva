import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NewInvestigationPage, { validateObjective } from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

describe("validateObjective", () => {
  it("rejects objectives under 8 characters", () => {
    expect(validateObjective("short")).toMatch(/at least 8/i);
  });
  it("accepts a real objective", () => {
    expect(validateObjective("Investigate pump P-204 failures")).toBeNull();
  });
});

describe("NewInvestigationPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "nirva.auth",
      JSON.stringify({
        token: "mock-token-engineer",
        user: { user_id: "u-eng-0001", username: "engineer", role: "engineer" },
      })
    );
    push.mockClear();
  });

  it("shows client-side validation error without submitting", async () => {
    const user = userEvent.setup();
    render(<NewInvestigationPage />);
    await user.type(screen.getByLabelText(/objective/i), "short");
    await user.click(screen.getByRole("button", { name: /start investigation/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/at least 8/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("creates a job and routes to its detail page", async () => {
    const user = userEvent.setup();
    render(<NewInvestigationPage />);
    await user.type(
      screen.getByLabelText(/objective/i),
      "Investigate why Pump P-204 failed repeatedly"
    );
    await user.type(screen.getByLabelText(/asset/i), "P-204");
    await user.click(screen.getByRole("button", { name: /start investigation/i }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        expect.stringMatching(/^\/investigations\/job-\d{4}$/)
      )
    );
  });
});
