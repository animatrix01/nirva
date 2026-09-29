import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_META: Record<JobStatus, { label: string; className: string }> = {
  queued: {
    label: "Queued",
    className: "border-2 border-slate-400 bg-slate-100 text-slate-800",
  },
  running: {
    label: "Running",
    className: "border-2 border-sky-400 bg-sky-50 text-sky-800",
  },
  awaiting_approval: {
    label: "Awaiting approval",
    className: "border-2 border-amber-400 bg-amber-50 text-amber-800",
  },
  completed: {
    label: "Completed",
    className: "border-2 border-emerald-400 bg-emerald-50 text-emerald-800",
  },
  failed: {
    label: "Failed",
    className: "border-2 border-red-400 bg-red-50 text-red-700",
  },
  blocked_injection: {
    label: "Blocked injection",
    className: "border-2 border-fuchsia-400 bg-fuchsia-50 text-fuchsia-800",
  },
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const meta = STATUS_META[status] ?? { label: status, className: "" };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        meta.className
      )}
    >
      {status === "running" && (
        <span
          aria-hidden
          className="mr-0.5 inline-block size-1.5 animate-pulse rounded-full bg-current"
        />
      )}
      {meta.label}
    </span>
  );
}
