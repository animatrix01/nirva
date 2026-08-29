import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    push.mockClear();
  });

  it("shows an error on invalid credentials", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText(/username/i), "engineer");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/invalid credentials/i)
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("logs in a demo engineer and routes to investigations", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText(/username/i), "engineer");
    await user.type(screen.getByLabelText(/password/i), "nirva-demo-pass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/investigations"));
    const stored = JSON.parse(
      window.localStorage.getItem("nirva.auth") ?? "null"
    ) as { token: string; user: { role: string } } | null;
    expect(stored?.user.role).toBe("engineer");
    expect(stored?.token).toBeTruthy();
  });
});
