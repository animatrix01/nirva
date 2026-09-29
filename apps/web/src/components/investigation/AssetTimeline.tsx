"use client";

/**
 * AssetTimeline — visual "medical history" of one asset (P-204 / HX355).
 *
 * Desktop: vibration trend line with OEM threshold guides over a
 * date-proportional event axis. Work orders / inspections / incidents are
 * markers on the axis; the known contradiction pair is linked with an
 * amber bracket. Selecting a marker shows its detail strip.
 * Mobile (<md): same data as a vertical list.
 *
 * Data comes from `getAssetHistory` (local fixture today, read-only API
 * later). No backend, no model — renders fully offline.
 */

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { AssetEvent, AssetHistory } from "@/lib/asset-history";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

function toTime(iso: string): number {
  return new Date(`${iso}T00:00:00`).getTime();
}

// ─── Geometry (viewBox 720 × 224) ─────────────────────────────────────────────

const W = 720;
const H = 208;
const X0 = 16;
const X1 = 612;
const CHART_TOP = 8;
const CHART_BOTTOM = 118;
const AXIS_Y = 172;
const LABEL_ROW_A = 138;
const LABEL_ROW_B = 154;

type Pt = { x: number; y: number };

// ─── Desktop chart ────────────────────────────────────────────────────────────

function DesktopChart({
  history,
  selectedId,
  onSelect,
}: {
  history: AssetHistory;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { events, thresholds, contradiction } = history;
  const times = events.map((e) => toTime(e.date));
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const span = Math.max(tMax - tMin, 1);
  const yMax = thresholds.shutdown * 1.15;

  const x = (iso: string) => X0 + ((toTime(iso) - tMin) / span) * (X1 - X0);
  const y = (v: number) =>
    CHART_BOTTOM - (Math.min(v, yMax) / yMax) * (CHART_BOTTOM - CHART_TOP);

  const readings = events.filter((e) => e.vibration !== null);
  const trend: Pt[] = readings.map((e) => ({ x: x(e.date), y: y(e.vibration!) }));

  const inContradiction = (id: string) =>
    contradiction !== null && (contradiction.a === id || contradiction.b === id);

  const zoneFill = (v: number | null) => {
    if (v === null) return "#64748b"; // slate-500
    if (v >= thresholds.shutdown) return "#ef4444"; // red-500
    if (v >= thresholds.alarm) return "#f59e0b"; // amber-500
    return "#475569"; // slate-600
  };

  const contraA = contradiction ? events.find((e) => e.id === contradiction.a) : undefined;
  const contraB = contradiction ? events.find((e) => e.id === contradiction.b) : undefined;

  // Label layout: markers stay date-true; labels are clamped inside the
  // viewBox and spread with a minimum gap so close events (WO-0892 /
  // INC-07-14 / INSP-07) don't stack. A thin leader line connects any
  // label displaced from its marker.
  const LABEL_MIN_GAP = 58;
  const LABEL_HALF = 30;
  const rawCx = events.map((e) => x(e.date));
  const labelCx = rawCx.map((cx) => Math.min(Math.max(cx, LABEL_HALF), W - LABEL_HALF));
  for (let i = 1; i < labelCx.length; i++) {
    if (labelCx[i] - labelCx[i - 1] < LABEL_MIN_GAP) {
      labelCx[i] = labelCx[i - 1] + LABEL_MIN_GAP;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`Asset history timeline for ${history.equipmentId}`}
    >
      {/* Threshold guides */}
      {(
        [
          { v: thresholds.alarm, label: `alarm ${thresholds.alarm}`, stroke: "#d97706" },
          { v: thresholds.shutdown, label: `shutdown ${thresholds.shutdown}`, stroke: "#dc2626" },
        ] as const
      ).map((t) => (
        <g key={t.label}>
          <line
            x1={X0}
            x2={X1}
            y1={y(t.v)}
            y2={y(t.v)}
            stroke={t.stroke}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.9}
          />
          <text x={X1 + 8} y={y(t.v) + 3.5} fontSize={11} fontWeight={600} fill="#374151">
            {t.label}
          </text>
        </g>
      ))}

      {/* Vibration trend */}
      {trend.length > 1 && (
        <polyline
          points={trend.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#0f172a"
          strokeWidth={2.5}
        />
      )}
      {trend.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={5} fill={zoneFill(readings[i].vibration)} stroke="white" strokeWidth={1.5} />
          <title>
            {readings[i].label} — {readings[i].vibration} mm/s RMS
          </title>
        </g>
      ))}

      {/* Axis */}
      <line x1={X0} x2={X1} y1={AXIS_Y} y2={AXIS_Y} stroke="#0f172a" strokeWidth={2} />

      {/* Event markers + labels */}
      {events.map((e, i) => {
        const cx = x(e.date);
        const lx = labelCx[i];
        const displaced = Math.abs(lx - cx) > 6;
        const labelY = i % 2 === 0 ? LABEL_ROW_A : LABEL_ROW_B;
        const selected = selectedId === e.id;
        const contra = inContradiction(e.id);
        return (
          <g
            key={e.id}
            role="button"
            tabIndex={0}
            aria-label={`${e.label}: ${e.title}`}
            onClick={() => onSelect(e.id)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                onSelect(e.id);
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <title>{`${e.label} — ${formatDate(e.date)}: ${e.title}`}</title>
            {e.kind === "incident" ? (
              <rect
                x={cx - 5}
                y={AXIS_Y - 5}
                width={10}
                height={10}
                transform={`rotate(45 ${cx} ${AXIS_Y})`}
                fill={selected ? "#0f172a" : "#334155"}
                stroke={contra ? "#f59e0b" : "white"}
                strokeWidth={contra ? 2 : 1.5}
              />
            ) : (
              <circle
                cx={cx}
                cy={AXIS_Y}
                r={selected ? 6.5 : 5}
                fill={e.kind === "work_order" ? (selected ? "#0f172a" : "#334155") : "white"}
                stroke={contra ? "#f59e0b" : "#0f172a"}
                strokeWidth={2}
              />
            )}
            <text
              data-event-label={e.id}
              x={lx}
              y={labelY}
              textAnchor="middle"
              fontSize={10}
              fontWeight={700}
              fill={contra ? "#d97706" : "#0f172a"}
            >
              {e.label}
            </text>
            <text x={lx} y={labelY + 12} textAnchor="middle" fontSize={9} fontWeight={600} fill="#334155">
              {formatDate(e.date).slice(0, 6)}
            </text>
            {displaced && (
              <line
                x1={lx}
                x2={cx}
                y1={labelY + 15}
                y2={AXIS_Y - 8}
                stroke="#64748b"
                strokeWidth={1}
              />
            )}
          </g>
        );
      })}

      {/* Contradiction bracket — the header chip already carries the
          "conflicting records" caption, so no in-chart text here. */}
      {contraA && contraB && (
        <g>
          <line
            x1={x(contraA.date)}
            x2={x(contraB.date)}
            y1={192}
            y2={192}
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
          <line x1={x(contraA.date)} x2={x(contraA.date)} y1={188} y2={196} stroke="#f59e0b" strokeWidth={1.5} />
          <line x1={x(contraB.date)} x2={x(contraB.date)} y1={188} y2={196} stroke="#f59e0b" strokeWidth={1.5} />
        </g>
      )}
    </svg>
  );
}

// ─── Mobile list ──────────────────────────────────────────────────────────────

function kindDot(kind: AssetEvent["kind"]): string {
  switch (kind) {
    case "work_order":
      return "bg-slate-600";
    case "inspection":
      return "bg-transparent border border-stone-400";
    case "incident":
      return "bg-slate-600 rotate-45";
  }
}

function MobileList({ history }: { history: AssetHistory }) {
  return (
    <ol className="relative ml-1.5 border-l border-slate-200 pl-5">
      {history.events.map((e) => (
        <li key={e.id} className="relative pb-5 last:pb-0">
          <span
            className={cn("absolute -left-[25px] top-1 size-2.5", kindDot(e.kind))}
            aria-hidden
          />
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
            {e.label} · {formatDate(e.date)}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-800">{e.title}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-800">{e.detail}</p>
          {e.vibration !== null && (
            <p className="mt-1 text-xs tabular-nums text-slate-600">
              Vibration {e.vibration} mm/s RMS
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function AssetTimeline({ history }: { history: AssetHistory }) {
  // Nothing preselected — the strip below invites exploration instead of
  // permanently occupying vertical space.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = history.events.find((e) => e.id === selectedId) ?? null;

  return (
    <section id="asset-history" aria-label={`Asset history for ${history.equipmentId}`} className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800 select-none">
          Asset history — {history.equipmentId}
        </h2>
        {history.contradiction && (
          <span className="inline-flex items-center gap-1 rounded border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
            <AlertTriangle className="size-3" aria-hidden />
            {history.events.filter(
              (e) => e.id === history.contradiction!.a || e.id === history.contradiction!.b
            ).length}{" "}
            conflicting records
          </span>
        )}
      </div>

      {/* Legend — one quiet row */}
      <div className="mb-2 hidden flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-900 md:flex" aria-hidden>
        <span><span className="mr-1 inline-block size-2 rounded-full bg-slate-900 align-middle" />work order</span>
        <span><span className="mr-1 inline-block size-2 rounded-full border-2 border-slate-900 align-middle" />inspection</span>
        <span><span className="mr-1 inline-block size-2 rotate-45 bg-slate-900 align-middle" />incident</span>
        <span className="text-slate-600">- - alarm {history.thresholds.alarm} · shutdown {history.thresholds.shutdown} mm/s</span>
      </div>

      <div className="hidden md:block">
        <DesktopChart history={history} selectedId={selectedId} onSelect={setSelectedId} />
        {selected ? (
          <div className="mt-2 border-l-2 border-slate-400 pl-3" aria-live="polite" data-testid="timeline-detail">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-900">
              {selected.label} · {formatDate(selected.date)}
            </p>
            <p className="mt-0.5 text-sm font-medium leading-relaxed text-slate-800">{selected.detail}</p>
          </div>
        ) : (
          <p className="mt-1 text-xs font-medium text-slate-500" aria-live="polite" data-testid="timeline-hint">
            Select an event on the timeline for details.
          </p>
        )}
      </div>

      <div className="md:hidden">
        <MobileList history={history} />
      </div>
    </section>
  );
}
