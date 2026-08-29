"use client";

import { Badge } from "@/components/ui/badge";
import type { ToolActivity } from "@/lib/artifacts";
import { cn } from "@/lib/utils";

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
            <Badge
              variant="secondary"
              className={cn(
                t.ok
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
              )}
            >
              {t.ok ? "completed" : "error"}
            </Badge>
          </div>
          {t.summary && <p className="mt-1 text-xs">{t.summary}</p>}
        </li>
      ))}
    </ul>
  );
}
