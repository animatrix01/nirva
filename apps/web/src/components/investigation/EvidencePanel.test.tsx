import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { EvidencePanel } from "./EvidencePanel";
import type { CitationRef } from "@/lib/types";

const citations: CitationRef[] = [
  {
    title: "OEM Manual Centrifugal Pumps",
    revision: "rev C",
    locator: "page 41",
    chunk_id: "chunk_oem_p41",
  },
  {
    title: "Work Order WO-88712",
    revision: "rev 2",
    locator: "page 2",
    chunk_id: "chunk_wo88712_s32",
  },
];

describe("EvidencePanel expanders", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "nirva.auth",
      JSON.stringify({
        token: "mock-token-engineer",
        user: { user_id: "u-eng-0001", username: "engineer", role: "engineer" },
      })
    );
  });

  it("renders a slim header with the method folded in and no source trace", () => {
    render(<EvidencePanel jobId="job-seed-0001" citations={citations} />);
    expect(screen.getByText(/Evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/hybrid retrieval/i)).toBeInTheDocument();
    expect(screen.queryByText(/Source trace/i)).toBeNull();
  });

  it("renders all cards expanded with no toggle controls", async () => {
    render(<EvidencePanel jobId="job-seed-0001" citations={citations} />);

    // Both passages visible on load — no clicking required.
    await waitFor(() =>
      expect(screen.getByText(/Dry running damages/i)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByText(/flush line reconnected/i)).toBeInTheDocument()
    );
    // No expander toggles rendered.
    expect(
      screen.queryAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"))
    ).toHaveLength(0);
  }, 20000);
});
