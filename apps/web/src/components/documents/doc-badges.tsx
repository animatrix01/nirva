"use client";

/**
 * Document badge primitives.
 *
 * Two deliberately separate semantic axes:
 *   DocTypePill    — WHAT it is (classification). Monochrome, uppercase.
 *   DocStatusBadge — WHERE it is (state). Tinted, since colour carries meaning.
 *
 * `DOC_TYPE_ACCENT` is the single source of truth for a type's colour so the
 * type facets in the toolbar and the pills in the list stay in one language.
 */

import { cn } from "@/lib/utils";
import type { DocumentOut, DocumentType } from "@/lib/types";

export const DOC_TYPES: DocumentType[] = [
  "manual",
  "sop",
  "work_order",
  "incident",
  "data",
];

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  manual:     "Manual",
  sop:        "SOP",
  work_order: "Work Order",
  incident:   "Incident Report",
  data:       "Data / Log",
};

/** Tailwind class sets per document type — shared by pills and facets. */
const DOC_TYPE_ACCENT: Record<DocumentType, { pill: string; dot: string }> = {
  manual:     { pill: "border-slate-300 bg-slate-100 text-slate-700",            dot: "bg-slate-500"     },
  sop:        { pill: "border-indigo-200 bg-indigo-50 text-indigo-700",          dot: "bg-indigo-500"   },
  work_order: { pill: "border-amber-200 bg-amber-50 text-amber-700",             dot: "bg-amber-500"    },
  incident:   { pill: "border-red-200 bg-red-50 text-red-700",                   dot: "bg-red-500"      },
  data:       { pill: "border-sky-200 bg-sky-50 text-sky-700",                   dot: "bg-sky-500"      },
};

export function docTypeAccent(type: string) {
  return DOC_TYPE_ACCENT[type as DocumentType] ?? DOC_TYPE_ACCENT.manual;
}

export function docTypeLabel(type: string): string {
  return DOC_TYPE_LABELS[type as DocumentType] ?? type.replace(/_/g, " ");
}

/** Classification tag — monochrome uppercase, reads like a document class. */
export function DocTypePill({ type, className }: { type: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        docTypeAccent(type).pill,
        className,
      )}
    >
      {docTypeLabel(type)}
    </span>
  );
}

/** State badge — colour carries the meaning, so it is tinted rather than grey. */
export function DocStatusBadge({
  status,
  className,
}: {
  status: DocumentOut["status"] | "processing";
  className?: string;
}) {
  const map = {
    indexed:     { label: "Indexed",     cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    processing:  { label: "Processing",  cls: "border-sky-200 bg-sky-50 text-sky-700" },
    quarantined: { label: "Failed",      cls: "border-amber-200 bg-amber-50 text-amber-700" },
  } as const;
  const { label, cls } = map[status] ?? map.quarantined;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        cls,
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Small solid dot — used where a full badge would be too heavy. */
export function StatusDot({ status }: { status: DocumentOut["status"] }) {
  if (status === "indexed") {
    return (
      <span
        className="inline-flex size-2 rounded-full bg-emerald-500"
        title="Indexed — ready for investigations"
        aria-hidden
      />
    );
  }
  if (status === "quarantined") {
    return (
      <span
        className="inline-flex size-2 rounded-full bg-amber-500"
        title="Processing failed"
        aria-hidden
      />
    );
  }
  return (
    <span
      className="inline-flex size-2 animate-pulse rounded-full bg-sky-500"
      title="Processing"
      aria-hidden
    />
  );
}
