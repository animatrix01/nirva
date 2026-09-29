"use client";

import type { ToolActivity } from "@/lib/artifacts";
import { cn } from "@/lib/utils";

// Human-readable labels for known tool names.
const TOOL_META: Record<string, { label: string; detail: string }> = {
  search_documents:  {
    label:  "Search documents",
    detail: "Hybrid retrieval over authorized plant knowledge · ACL-filtered",
  },
  get_asset_history: {
    label:  "Asset history",
    detail: "Equipment history lookup · read-only operational tool",
  },
  check_inventory:   {
    label:  "Inventory check",
    detail: "Spare parts availability · read-only operational tool",
  },
  recall_memories:   {
    label:  "Episodic memory recall",
    detail: "Prior approved findings for this equipment",
  },
};

function getMeta(tool: ToolActivity): { label: string; detail: string } {
  return TOOL_META[tool.tool_name] ?? {
    label:  tool.tool_name,
    detail: tool.summary ?? "",
  };
}

export function ToolActivityList({ tools }: { tools: ToolActivity[] }) {
  if (tools.length === 0) {
    return (
      <p className="text-[12px] text-stone-700">
        No tool calls recorded. Read-only operational activity appears here.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {tools.map((t, i) => {
        const meta = getMeta(t);
        return (
          <li key={`${t.tool_name}-${i}`} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  t.ok ? "bg-emerald-600" : "bg-red-500"
                )}
                aria-hidden
              />
              <span className="text-[12px] font-medium text-stone-300">{meta.label}</span>
            </div>
            {meta.detail && (
              <p className="pl-3.5 text-[11px] text-stone-600 leading-snug">{meta.detail}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
