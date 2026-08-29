"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SseEvent } from "@/lib/types";
import {
  buildNodeTimeline,
  isTerminalEvent,
  latestTerminalEvent,
  type TerminalEventType,
} from "./timeline";

const TERMINAL_LABEL: Record<TerminalEventType, string> = {
  completed: "Completed",
  failed: "Failed",
  blocked_injection: "Blocked (injection attempt)",
  awaiting_approval: "Awaiting approval",
};

const TERMINAL_STYLE: Record<TerminalEventType, string> = {
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  blocked_injection: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300",
  awaiting_approval: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
};

export function eventLabel(e: SseEvent): string {
  switch (e.type) {
    case "node_started":
      return "started";
    case "node_finished":
      return "finished";
    case "tool_called":
      return "tool called";
    case "evidence_added":
      return "evidence added";
    case "contradiction_found":
      return "contradiction found";
    case "awaiting_approval":
      return "paused for approval";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "blocked_injection":
      return "injection blocked";
    default:
      return e.type;
  }
}

export function EventTimeline({ events }: { events: SseEvent[] }) {
  const rows = buildNodeTimeline(events);
  const terminal = latestTerminalEvent(events);

  return (
    <ol className="flex flex-col gap-3" aria-label="Investigation timeline">
      {rows.map((row) => (
        <li key={row.node} className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <span
              aria-hidden
              className={cn(
                "size-2.5 rounded-full border",
                row.status === "done" &&
                  "border-emerald-600 bg-emerald-600 dark:border-emerald-400 dark:bg-emerald-400",
                row.status === "running" &&
                  "animate-pulse border-blue-600 bg-blue-600 dark:border-blue-400 dark:bg-blue-400",
                row.status === "pending" && "border-muted-foreground/40 bg-transparent"
              )}
            />
            <span aria-hidden className="bg-border w-px flex-1" />
          </div>
          <div className="flex-1 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">{row.node}</span>
              {row.status === "running" && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  running
                </Badge>
              )}
              {row.status === "done" && !isTerminalEvent(row.events[row.events.length - 1]?.type ?? "node_started") && (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  done
                </Badge>
              )}
              {row.status === "pending" && (
                <Badge variant="secondary">pending</Badge>
              )}
            </div>
            {row.events.length > 0 && (
              <ul className="text-muted-foreground mt-1 flex flex-col gap-0.5">
                {row.events.map((e) => (
                  <li key={e.seq} className="text-xs">
                    <span className="font-mono">#{e.seq}</span>{" "}
                    {isTerminalEvent(e.type) ? (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "ml-1",
                          TERMINAL_STYLE[e.type as TerminalEventType]
                        )}
                      >
                        {TERMINAL_LABEL[e.type as TerminalEventType]}
                      </Badge>
                    ) : (
                      eventLabel(e)
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
      {terminal && (
        <li>
          <Badge
            variant="secondary"
            className={cn(
              "px-3 py-1 text-sm",
              TERMINAL_STYLE[terminal.type as TerminalEventType]
            )}
          >
            Final state: {TERMINAL_LABEL[terminal.type as TerminalEventType]}
          </Badge>
        </li>
      )}
    </ol>
  );
}
