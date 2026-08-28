import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_META: Record<JobStatus, { label: string; className: string }> = {
  queued: {
    label: "Queued",
    className: "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
  },
  running: {
    label: "Running",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  awaiting_approval: {
    label: "Awaiting approval",
    className:
      "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  },
  completed: {
    label: "Completed",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
  blocked_injection: {
    label: "Blocked injection",
    className:
      "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300",
  },
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const meta = STATUS_META[status] ?? { label: status, className: "" };
  return (
    <Badge variant="secondary" className={cn(meta.className)}>
      {status === "running" && (
        <span
          aria-hidden
          className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-current"
        />
      )}
      {meta.label}
    </Badge>
  );
}
