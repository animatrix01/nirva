/**
 * Asset history data for the investigation-workspace Asset Timeline.
 *
 * Frontend-local fixture mirroring the seeded P-204/HX355 demo corpus
 * (work orders + inspections + incident records + vibration readings).
 * Renders without any backend or model — the future read-only endpoint
 * `GET /api/jobs/{id}/asset-history` can replace `getAssetHistory`
 * one-for-one with the same `AssetHistory` shape.
 */

export type AssetEventKind = "work_order" | "inspection" | "incident";

export interface AssetEvent {
  /** Stable id, e.g. "wo-0892". */
  id: string;
  /** ISO date, e.g. "2026-07-02". */
  date: string;
  kind: AssetEventKind;
  /** Short label shown on the axis, e.g. "WO-0892". */
  label: string;
  /** One-line engineer-readable summary. */
  title: string;
  /** Closure-note style detail shown on selection. */
  detail: string;
  /** Vibration reading in mm/s RMS (drawn on the trend line). Null when the event has no reading. */
  vibration: number | null;
}

export interface AssetContradiction {
  /** Ids of the two conflicting events. */
  a: string;
  b: string;
  /** Short label for the connecting marker. */
  label: string;
}

export interface AssetHistory {
  equipmentId: string;
  /** OEM vibration thresholds in mm/s RMS. */
  thresholds: { ok: number; alarm: number; shutdown: number };
  events: AssetEvent[];
  contradiction: AssetContradiction | null;
}

const HX355_HISTORY: AssetHistory = {
  equipmentId: "HX355",
  thresholds: { ok: 2.8, alarm: 3.5, shutdown: 7.0 },
  events: [
    {
      id: "wo-0087",
      date: "2026-04-22",
      kind: "work_order",
      label: "WO-0087",
      title: "Seal kit replaced",
      detail: "Seal kit SEAL-P204-KIT replaced. Restart test vibration 3.1 mm/s RMS.",
      vibration: 3.1,
    },
    {
      id: "wo-0101",
      date: "2026-05-30",
      kind: "work_order",
      label: "WO-0101",
      title: "Gland adjustment",
      detail: "Gland torqued. Flush pressure still marginal at 1.2 bar above suction.",
      vibration: null,
    },
    {
      id: "insp-06",
      date: "2026-06-18",
      kind: "inspection",
      label: "INSP-06",
      title: "Vibration 5.2 mm/s — above alarm",
      detail: "Drive-end vibration 5.2 mm/s RMS, above the 3.5 alarm threshold. Seal weeping observed.",
      vibration: 5.2,
    },
    {
      id: "wo-0892",
      date: "2026-07-02",
      kind: "work_order",
      label: "WO-0892",
      title: "Coupling alignment — closed as completed",
      detail: "Closure note: coupling alignment completed successfully. Laser alignment report attached.",
      vibration: null,
    },
    {
      id: "inc-0714",
      date: "2026-07-14",
      kind: "incident",
      label: "INC-07-14",
      title: "Hydrocarbon leak from seal",
      detail: "Seal face wear 0.8 mm (OEM limit 0.3 mm). Root cause attributed to coupling misalignment.",
      vibration: null,
    },
    {
      id: "insp-07",
      date: "2026-07-16",
      kind: "inspection",
      label: "INSP-07",
      title: "Vibration 6.1 mm/s — alignment NOT done",
      detail: "Misalignment 0.21 mm (limit 0.05 mm). Alignment correction was NOT completed — intervention window closed.",
      vibration: 6.1,
    },
    {
      id: "insp-08",
      date: "2026-08-05",
      kind: "inspection",
      label: "INSP-08",
      title: "Vibration 4.2 mm/s — seal flush below spec",
      detail: "Vibration 4.2 mm/s RMS. Seal flush flow 1.8 L/min (spec 2.0 L/min — slightly below spec, monitor).",
      vibration: 4.2,
    },
  ],
  contradiction: {
    a: "wo-0892",
    b: "insp-07",
    label: "Alignment marked completed, then found not done",
  },
};

const FIXTURES: Record<string, AssetHistory> = {
  HX355: HX355_HISTORY,
  // The synthetic generator corpus uses P-204; the seeded demo job uses
  // HX355. Same story, both ids resolve.
  "P-204": { ...HX355_HISTORY, equipmentId: "P-204" },
};

/**
 * Returns the asset history for an equipment id. Known demo assets resolve
 * to their fixture; anything else falls back to the P-204/HX355 story
 * relabeled with the investigation's own equipment name, so the timeline
 * is visible on every investigation (demo requirement). Never null.
 */
export function getAssetHistory(equipmentId: string | null): AssetHistory {
  if (equipmentId && FIXTURES[equipmentId]) return FIXTURES[equipmentId];
  return { ...HX355_HISTORY, equipmentId: equipmentId ?? "HX355" };
}
