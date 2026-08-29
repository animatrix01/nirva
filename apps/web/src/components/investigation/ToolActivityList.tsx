"use client";

import { Badge } from "@/components/ui/badge";
import type { ToolActivity } from "@/lib/artifacts";
import { cn } from "@/lib/utils";

const TOOL_STATUS_STYLE: Record<ToolActivity["status"], string> = {
  running: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  completed:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  denied: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
};

export function ToolActivityList({ tools }: { tools: ToolActivity[] }) {
  if (tools.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No tool calls yet. Approved read-only tool activity appears here.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {tools.map((t, i) => (
        <li key={`${t.tool_name}-${i}`} className="rounded-lg border p-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">{t.tool_name}</span>
            <Badge variant="secondary" className={cn(TOOL_STATUS_STYLE[t.status])}>
              {t.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-xs break-all">
            {t.arguments_summary}
          </p>
          {t.output_summary && <p className="mt-1 text-xs">{t.output_summary}</p>}
          {t.error && (
            <p role="alert" className="text-destructive mt-1 text-xs">
              {t.error}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
