import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_META: Record<JobStatus, { label: string; className: string }> = {
  queued: {
    label: "Queued",
    className: "bg-neutral-500/10 text-neutral-400",
  },
  running: {
    label: "Running",
    className: "bg-sky-500/10 text-sky-400",
  },
  awaiting_approval: {
    label: "Awaiting approval",
    className: "bg-amber-500/10 text-amber-400",
  },
  completed: {
    label: "Completed",
    className: "bg-emerald-500/10 text-emerald-400",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/10 text-red-400",
  },
  blocked_injection: {
    label: "Blocked injection",
    className: "bg-fuchsia-500/10 text-fuchsia-400",
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
