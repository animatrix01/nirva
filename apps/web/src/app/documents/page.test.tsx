import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DocumentsPage, { ChunkViewer } from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
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

describe("DocumentsPage role gating", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("engineer sees the upload form and the library", async () => {
    setAuth("engineer");
    render(<DocumentsPage />);
    await waitFor(() =>
      expect(screen.getByText(/P-204 OEM Maintenance Manual/)).toBeInTheDocument()
    );
    expect(screen.getByLabelText(/file/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
  });

  it("supervisor sees the library but no upload form", async () => {
    setAuth("supervisor");
    render(<DocumentsPage />);
    await waitFor(() =>
      expect(screen.getByText(/P-204 OEM Maintenance Manual/)).toBeInTheDocument()
    );
    expect(
      screen.getByText(/Document upload is restricted to engineers and admins/i)
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/file/i)).toBeNull();
    // ACL note: only internal docs are visible to supervisor in the double
    expect(screen.queryByText(/Confidential Vendor Bulletin/)).toBeNull();
  });

  it("admin sees the upload form", async () => {
    setAuth("admin");
    render(<DocumentsPage />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument()
    );
  });

  it("engineer uploads a file and sees the indexed chunk count", async () => {
    setAuth("engineer");
    render(<DocumentsPage />);
    await waitFor(() => expect(screen.getByLabelText(/file/i)).toBeInTheDocument());
    const user = userEvent.setup();
    await user.upload(
      screen.getByLabelText(/file/i) as HTMLInputElement,
      new File(["%PDF-1.4 fake"], "p204-bulletin.pdf", { type: "application/pdf" })
    );
    await user.type(screen.getByLabelText(/^title$/i), "P204 Vendor Bulletin");
    await user.type(screen.getByLabelText(/revision/i), "1");
    await user.type(screen.getByLabelText(/department/i), "Reliability");
    await user.click(screen.getByRole("button", { name: /upload/i }));
    await waitFor(() =>
      expect(screen.getByText(/Upload indexed — 3 chunk\(s\) indexed\./i)).toBeInTheDocument()
    );
  });

  it("chunk viewer lists document chunks with page and section", async () => {
    render(
      <ChunkViewer open onOpenChange={vi.fn()} documentId="doc-oem-pumps" />
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Never restart the pump without verified positive suction pressure/i)
      ).toBeInTheDocument()
    );
    expect(screen.getByText(/chunk_oem_p41/)).toBeInTheDocument();
  });
});
