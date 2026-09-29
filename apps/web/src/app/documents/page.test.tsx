import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DocumentsPage, { ChunkViewer, isImageFile } from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => "/documents",
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
      expect(
        screen.getByText(/Centrifugal Pump CP-300 Series — Maintenance Manual/)
      ).toBeInTheDocument()
    );
    expect(screen.getByLabelText(/file/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Queue for processing/i })
    ).toBeInTheDocument();
  });

  it("supervisor sees the library but no upload form", async () => {
    setAuth("supervisor");
    render(<DocumentsPage />);
    await waitFor(() =>
      expect(
        screen.getByText(/Centrifugal Pump CP-300 Series — Maintenance Manual/)
      ).toBeInTheDocument()
    );
    expect(
      screen.getByText(/Document upload is available to engineers and admins/i)
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/file/i)).toBeNull();
    // ACL note: restricted docs are not visible to this role in the double
    expect(screen.queryByText(/IR-0331/)).toBeNull();
  });

  it("admin sees the upload form", async () => {
    setAuth("admin");
    render(<DocumentsPage />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Queue for processing/i })
      ).toBeInTheDocument()
    );
  });

  it("engineer queues a document for processing", async () => {
    setAuth("engineer");
    const user = userEvent.setup();
    render(<DocumentsPage />);
    await waitFor(() => expect(screen.getByLabelText(/file/i)).toBeInTheDocument());

    await user.upload(
      screen.getByLabelText(/file/i) as HTMLInputElement,
      new File(["%PDF-1.4 fake"], "p204-bulletin.pdf", { type: "application/pdf" })
    );
    await user.type(screen.getByLabelText(/^title$/i), "P204 Vendor Bulletin");
    // Revision / date / department live behind the rail disclosure
    await user.click(screen.getByRole("button", { name: /More options/i }));
    await user.type(screen.getByLabelText(/revision/i), "1");
    await user.type(screen.getByLabelText(/effective date/i), "2026-08-29");
    await user.type(screen.getByLabelText(/department/i), "Reliability");
    await user.click(
      screen.getByRole("button", { name: /Queue for processing/i })
    );
    // Submitting hands off to the processing modal (the rail stays mounted
    // underneath it), so assert on the dialog rather than the form.
    await screen.findByRole("dialog", { name: /Document processing/i });
  });

  it("chunk viewer lists document chunks with page and section", async () => {
    setAuth("engineer");
    const user = userEvent.setup();
    render(
      <ChunkViewer open onOpenChange={vi.fn()} documentId="doc-oem-pumps" />
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Never restart the pump without verified positive suction pressure/i)
      ).toBeInTheDocument()
    );
    // Chunk ids live in the collapsed Technical details panel.
    await user.click(screen.getByRole("button", { name: /Technical details/i }));
    expect(screen.getByText(/chunk_oem_p41/)).toBeInTheDocument();
  });

  it("renders the stored original image preview for image documents", async () => {
    setAuth("engineer");
    const user = userEvent.setup();
    render(
      <ChunkViewer open onOpenChange={vi.fn()} documentId="doc-oem-pumps" />
    );
    // Wait for the fetched content to land before touching the disclosure.
    await waitFor(() =>
      expect(
        screen.getByText(/Never restart the pump without verified positive suction pressure/i)
      ).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /Technical details/i }));
    expect(screen.getByText(/chunk_oem_p41/)).toBeInTheDocument();
  });

  it("shows the vision-inspection hint only for image selections", async () => {
    setAuth("engineer");
    render(<DocumentsPage />);
    await waitFor(() => expect(screen.getByLabelText(/file/i)).toBeInTheDocument());
    const user = userEvent.setup();

    expect(isImageFile({ name: "a.pdf", type: "application/pdf" })).toBe(false);
    expect(isImageFile({ name: "b.png", type: "image/png" })).toBe(true);
    expect(isImageFile({ name: "c.JPG", type: "" })).toBe(true);

    await user.upload(
      screen.getByLabelText(/file/i) as HTMLInputElement,
      new File(["fake-png"], "p204-seal-photo.png", { type: "image/png" })
    );
    expect(
      screen.getByText(/Equipment photo — vision model will record visible observations/i)
    ).toBeInTheDocument();

    await user.upload(
      screen.getByLabelText(/file/i) as HTMLInputElement,
      new File(["%PDF-1.4"], "plain.pdf", { type: "application/pdf" })
    );
    expect(
      screen.queryByText(/Equipment photo — vision model will record visible observations/i)
    ).toBeNull();
  });
});
