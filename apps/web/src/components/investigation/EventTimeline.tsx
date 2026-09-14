"use client";

/**
 * EventTimeline — redesigned investigation stage tracker.
 *
 * Layout per node:
 *   ● (indicator) │ STAGE NAME    status pill
 *                 │ Description of what this stage does
 *                 │ ─ activity rows for notable events (evidence_added,
 *                 │   tool_called, contradiction_found, blocked_injection)
 *                 │
 *
 * Raw seq numbers and low-level "node_started / node_finished" events are
 * deliberately NOT shown to users — they are backend implementation details.
 * Only events that carry meaning to an engineer are surfaced:
 *   - evidence_added  → "Evidence recorded"
 *   - tool_called     → "Operational tool queried"
 *   - contradiction_found → "Cross-source conflict detected"
 *   - blocked_injection   → "Injection attempt blocked"
 *   - awaiting_approval   → "Paused — awaiting supervisor decision"
 *   - completed / failed  → handled as terminal state, not inline events
 */

import { cn } from "@/lib/utils";
import type { SseEvent, SseEventType } from "@/lib/types";
import {
  buildNodeTimeline,
  isTerminalEvent,
  latestTerminalEvent,
  type NodeTimelineRow,
  type TerminalEventType,
} from "./timeline";

// ─── Node metadata ────────────────────────────────────────────────────────────

interface NodeMeta {
  label: string;
  description: string;
  /** Extra activity lines shown while the node is running. */
  activity: string[];
}

const NODE_META: Record<string, NodeMeta> = {
  intake: {
    label: "Intake",
    description: "Understanding investigation objective · identifying relevant equipment and knowledge sources",
    activity: [
      "Parsing investigation objective",
      "Identifying relevant equipment context",
    ],
  },
  answer: {
    label: "Retrieve & correlate",
    description: "Hybrid retrieval over indexed documents · cross-source evidence correlation",
    activity: [
      "Searching authorized plant knowledge",
      "Evaluating relevant evidence",
      "Comparing information across sources",
      "Checking maintenance history and inspection records",
    ],
  },
  finalize: {
    label: "Verify & finalize",
    description: "Validating source provenance · building evidence-grounded findings",
    activity: [
      "Validating source provenance and citations",
      "Checking conflicting evidence",
      "Building evidence-grounded findings",
      "Recording traceability and audit trail",
    ],
  },
  approval_executor: {
    label: "Approval gate",
    description: "Awaiting supervisor decision before any consequential action",
    activity: [
      "Work-order draft prepared",
      "No action executes without sign-off",
    ],
  },
};

function getNodeMeta(node: string): NodeMeta {
  return (
    NODE_META[node] ?? {
      label: node,
      description: "Processing stage",
      activity: [],
    }
  );
}

// ─── Activity events (meaningful to engineers) ────────────────────────────────

/** Events worth showing to the user as activity items. */
const ACTIVITY_TYPES: SseEventType[] = [
  "evidence_added",
  "tool_called",
  "contradiction_found",
  "blocked_injection",
  "awaiting_approval",
];

interface ActivityLine {
  type: SseEventType;
  label: string;
  tone: "neutral" | "amber" | "red" | "lime";
}

function activityLine(e: SseEvent): ActivityLine | null {
  switch (e.type) {
    case "evidence_added":
      return { type: e.type, label: "Evidence recorded from authorized source", tone: "lime" };
    case "tool_called":
      return { type: e.type, label: "Read-only operational tool queried", tone: "neutral" };
    case "contradiction_found":
      return { type: e.type, label: "Cross-source conflict detected — requires human review", tone: "amber" };
    case "blocked_injection":
      return { type: e.type, label: "Injection attempt blocked — chunk excluded from evidence", tone: "red" };
    case "awaiting_approval":
      return { type: e.type, label: "Paused — awaiting supervisor decision", tone: "amber" };
    default:
      return null;
  }
}

// ─── Terminal display ────────────────────────────────────────────────────────

const TERMINAL_STYLE: Record<TerminalEventType, string> = {
  completed:         "border-emerald-700/60 bg-emerald-950/40 text-emerald-300",
  failed:            "border-red-700/60     bg-red-950/40     text-red-300",
  blocked_injection: "border-fuchsia-700/60 bg-fuchsia-950/40 text-fuchsia-300",
  awaiting_approval: "border-amber-700/60   bg-amber-950/40   text-amber-300",
};

const TERMINAL_LABEL: Record<TerminalEventType, string> = {
  completed:         "Investigation complete",
  failed:            "Investigation failed — insufficient evidence to proceed",
  blocked_injection: "Blocked — injection attempt detected and contained",
  awaiting_approval: "Paused — awaiting supervisor approval",
};

// ─── StageRow ─────────────────────────────────────────────────────────────────

function StageRow({ row, isLast }: { row: NodeTimelineRow; isLast: boolean }) {
  const meta       = getNodeMeta(row.node);
  const isDone     = row.status === "done";
  const isRunning  = row.status === "running";
  const isPending  = row.status === "pending";

  // Collect meaningful activity events for this node
  const activities = row.events
    .filter((e) => ACTIVITY_TYPES.includes(e.type))
    .map(activityLine)
    .filter((a): a is ActivityLine => a !== null);

  // Count evidence and tool events for the done-state summary
  const evidenceCount = row.events.filter((e) => e.type === "evidence_added").length;
  const toolCount     = row.events.filter((e) => e.type === "tool_called").length;
  const contraCount   = row.events.filter((e) => e.type === "contradiction_found").length;

  return (
    <li className="flex gap-4" aria-label={`${meta.label}: ${row.status}`}>
      {/* ── Left gutter: indicator + connector ── */}
      <div className="flex flex-col items-center" style={{ width: 20 }}>
        <div
          className={cn(
            "relative z-10 mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
            isDone    && "border-[#c8f135] bg-[#c8f135]/10",
            isRunning && "border-stone-400 bg-stone-800",
            isPending && "border-stone-700 bg-transparent",
          )}
          aria-hidden
        >
          {isDone && (
            <span className="text-[9px] font-bold text-[#c8f135]">✓</span>
          )}
          {isRunning && (
            <span
              className="size-1.5 rounded-full bg-stone-300"
              style={{ animation: "nirva-breathe 1.1s ease-in-out infinite" }}
            />
          )}
          {isPending && (
            <span className="size-1 rounded-full bg-stone-700" />
          )}
        </div>
        {/* Connector line to next node */}
        {!isLast && (
          <div
            className={cn(
              "mt-1 w-px flex-1",
              isDone   ? "bg-stone-700" : "bg-stone-800"
            )}
            aria-hidden
          />
        )}
      </div>

      {/* ── Right content ── */}
      <div className={cn("flex-1 pb-5", isLast && "pb-0")}>

        {/* Stage name + status pill */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span
            className={cn(
              "text-[13px] font-semibold leading-tight",
              isDone    && "text-stone-300",
              isRunning && "text-white",
              isPending && "text-stone-700",
            )}
          >
            {meta.label}
          </span>

          {isRunning && (
            <span className="inline-flex items-center gap-1.5 rounded bg-stone-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-stone-300">
              <span
                className="size-1.5 rounded-full bg-stone-300"
                style={{ animation: "nirva-breathe 1.4s ease-in-out infinite" }}
                aria-hidden
              />
              Active
            </span>
          )}

          {isDone && !isTerminalEvent(row.events[row.events.length - 1]?.type ?? "node_started") && (
            <span className="rounded bg-[#c8f135]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#c8f135]">
              Done
            </span>
          )}
        </div>

        {/* Description — shown for pending and running; replaced by summary for done */}
        {(isRunning || isPending) && (
          <p className={cn(
            "mt-1 text-[11px] leading-snug",
            isRunning ? "text-stone-500" : "text-stone-700"
          )}>
            {meta.description}
          </p>
        )}

        {/* Done-state compact summary */}
        {isDone && (evidenceCount > 0 || toolCount > 0 || contraCount > 0) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {evidenceCount > 0 && (
              <span className="text-[11px] text-stone-500">
                <span className="text-[#c8f135]">{evidenceCount}</span> evidence item{evidenceCount !== 1 ? "s" : ""}
              </span>
            )}
            {toolCount > 0 && (
              <span className="text-[11px] text-stone-500">
                <span className="text-stone-400">{toolCount}</span> tool result{toolCount !== 1 ? "s" : ""}
              </span>
            )}
            {contraCount > 0 && (
              <span className="text-[11px] text-amber-500">
                ⚠ {contraCount} conflict{contraCount !== 1 ? "s" : ""} detected
              </span>
            )}
          </div>
        )}

        {/* Live activity lines — only while running */}
        {isRunning && activities.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1" aria-label="Stage activity">
            {activities.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px]">
                <span
                  className={cn(
                    "mt-0.5 shrink-0",
                    a.tone === "lime"    && "text-[#c8f135]",
                    a.tone === "amber"   && "text-amber-400",
                    a.tone === "red"     && "text-red-400",
                    a.tone === "neutral" && "text-stone-500",
                  )}
                  aria-hidden
                >
                  {a.tone === "amber" ? "⚠" : a.tone === "red" ? "✗" : "·"}
                </span>
                <span
                  className={cn(
                    a.tone === "lime"    && "text-stone-300",
                    a.tone === "amber"   && "text-amber-300",
                    a.tone === "red"     && "text-red-300",
                    a.tone === "neutral" && "text-stone-400",
                  )}
                >
                  {a.label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function EventTimeline({ events }: { events: SseEvent[] }) {
  const rows     = buildNodeTimeline(events);
  const terminal = latestTerminalEvent(events);

  // Filter to only nodes that have started or are known plan nodes
  const visibleRows = rows.filter(
    (r) => r.status !== "pending" || ["intake", "answer", "finalize"].includes(r.node)
  );

  return (
    <div role="region" aria-label="Investigation stages">
      <ol className="flex flex-col" aria-label="Stage list">
        {visibleRows.map((row, i) => (
          <StageRow
            key={row.node}
            row={row}
            isLast={i === visibleRows.length - 1 && !terminal}
          />
        ))}
      </ol>

      {/* Terminal state banner */}
      {terminal && (
        <div
          role="status"
          className={cn(
            "mt-4 rounded-lg border px-4 py-3 text-[13px] font-medium",
            TERMINAL_STYLE[terminal.type as TerminalEventType]
          )}
        >
          {TERMINAL_LABEL[terminal.type as TerminalEventType]}
        </div>
      )}
    </div>
  );
}

// Re-export eventLabel for any consumer that still needs it
export { type NodeTimelineRow };
