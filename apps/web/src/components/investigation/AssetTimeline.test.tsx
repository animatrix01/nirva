import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AssetTimeline } from "./AssetTimeline";
import { getAssetHistory } from "@/lib/asset-history";

const history = getAssetHistory("HX355")!;

describe("AssetTimeline", () => {
  it("renders the section heading with the equipment id", () => {
    render(<AssetTimeline history={history} />);
    expect(screen.getByText(/Asset history — HX355/i)).toBeInTheDocument();
  });

  it("renders every event label", () => {
    render(<AssetTimeline history={history} />);
    for (const e of history.events) {
      expect(screen.getAllByText(e.label).length).toBeGreaterThan(0);
    }
  });

  it("renders the threshold guides and the contradiction marker", () => {
    render(<AssetTimeline history={history} />);
    // Desktop chart + legend + mobile list all render in jsdom — assert presence, not singularity.
    expect(screen.getAllByText(/alarm 3\.5/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/shutdown 7/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/conflicting records/i).length).toBeGreaterThan(0);
  });

  it("shows a hint by default and details on marker click", () => {
    const { container } = render(<AssetTimeline history={history} />);
    expect(container.querySelector('[data-testid="timeline-hint"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="timeline-detail"]')).toBeNull();

    fireEvent.click(screen.getAllByLabelText(/INSP-07: /i)[0]);
    expect(container.querySelector('[data-testid="timeline-detail"]')).not.toBeNull();
    expect(
      screen.getAllByText(/alignment correction was NOT completed/i).length
    ).toBeGreaterThan(0);
  });

  it("renders the mobile list with details", () => {
    render(<AssetTimeline history={history} />);
    expect(
      screen.getByText(/seal face wear 0\.8 mm/i)
    ).toBeInTheDocument();
  });

  it("keeps event labels inside the chart and collision-free", () => {
    const { container } = render(<AssetTimeline history={history} />);
    const labels = Array.from(container.querySelectorAll("[data-event-label]"));
    expect(labels.length).toBe(history.events.length);
    const xs = labels.map((el) => Number(el.getAttribute("x")));
    for (const v of xs) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(720);
    }
    const sorted = [...xs].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(55);
    }
  });
});

describe("getAssetHistory", () => {
  it("resolves the demo equipment ids and falls back relabeled otherwise", () => {
    expect(getAssetHistory("HX355")?.equipmentId).toBe("HX355");
    expect(getAssetHistory("P-204")?.events.length).toBe(7);
    // Demo fallback: same story, relabeled with the investigation's asset
    expect(getAssetHistory("UNKNOWN")?.equipmentId).toBe("UNKNOWN");
    expect(getAssetHistory("UNKNOWN")?.events.length).toBe(7);
    expect(getAssetHistory(null)?.equipmentId).toBe("HX355");
  });
});
