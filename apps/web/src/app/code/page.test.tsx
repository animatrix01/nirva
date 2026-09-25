import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CodePage from "./page";
import { installFetchStub } from "@/test-mocks/fetch-stub";

vi.mock("next/navigation", () => ({
  usePathname: () => "/code",
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

describe("CodePage", () => {
  let uninstall: () => void;

  beforeEach(() => {
    uninstall?.();
    uninstall = installFetchStub();
    window.localStorage.clear();
    setAuth("engineer");
  });

  it("renders the working-code workspace with task prompt", async () => {
    render(<CodePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /working code/i })
    ).toBeInTheDocument();
    await screen.findByRole("combobox");
    expect(screen.getByPlaceholderText(/parse vibration log/i)).toBeInTheDocument();
  });

  it("runs analysis and shows a verified result", async () => {
    const user = userEvent.setup();
    render(<CodePage />);
    await screen.findByRole("combobox");
    await user.click(screen.getByRole("button", { name: /run analysis/i }));
    await screen.findByText(/verified/i);
    // tokenized syntax highlighting splits code across spans; the stdout
    // "4.1" appears in both the generated script and its output
    expect(screen.getAllByText(/4\.1/).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("button", { name: /download \.py/i })
    ).toBeInTheDocument();
  });

  it("tells safety_officer they are view-only", async () => {
    window.localStorage.clear();
    setAuth("safety_officer");
    render(<CodePage />);
    await screen.findByRole("combobox");
    expect(screen.queryByRole("button", { name: /run analysis/i })).not.toBeInTheDocument();
    expect(screen.getByText(/view-only/i)).toBeInTheDocument();
  });
});
