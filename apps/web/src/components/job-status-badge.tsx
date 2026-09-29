import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_META: Record<JobStatus, { label: string; className: string }> = {
  queued: {
    label: "Queued",
    className: "border border-neutral-700 bg-neutral-500/10 text-neutral-400",
  },
  running: {
    label: "Running",
    className: "border border-sky-500/30 bg-sky-500/10 text-sky-400",
  },
  awaiting_approval: {
    label: "Awaiting approval",
    className: "border border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  completed: {
    label: "Completed",
    className: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  failed: {
    label: "Failed",
    className: "border border-red-500/30 bg-red-500/10 text-red-400",
  },
  blocked_injection: {
    label: "Blocked injection",
    className: "border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-400",
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
