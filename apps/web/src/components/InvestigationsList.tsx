"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JobStatusBadge } from "@/components/job-status-badge";
import { ApiError, listJobs } from "@/lib/api";
import type { JobStatus, JobSummary } from "@/lib/types";

const STATUS_OPTIONS: Array<{ value: JobStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "awaiting_approval", label: "Awaiting approval" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "blocked_injection", label: "Blocked injection" },
];

export function formatJobDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function clientFilterByDate(
  jobs: JobSummary[],
  fromDate: string
): JobSummary[] {
  if (!fromDate) return jobs;
  const from = new Date(fromDate);
  from.setHours(0, 0, 0, 0);
  if (isNaN(from.getTime())) return jobs;
  return jobs.filter((j) => {
    const created = new Date(j.created_at);
    return !isNaN(created.getTime()) && created >= from;
  });
}

export function InvestigationsList() {
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");

  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
      try {
        const data = await listJobs({
          status: statusFilter === "all" ? undefined : statusFilter,
          equipment_id: equipmentFilter.trim() ? equipmentFilter.trim() : undefined,
        });
        if (signal?.cancelled) return;
        setJobs(clientFilterByDate(data, dateFilter));
        setError(null);
      } catch (e: unknown) {
        if (signal?.cancelled) return;
        if (e instanceof ApiError) {
          setError(e.body.detail);
        } else if (e instanceof Error) {
          setError(e.message);
        } else {
          setError("Failed to load investigations");
        }
        setJobs([]);
      } finally {
        if (!signal?.cancelled) setLoading(false);
      }
    },
    [statusFilter, equipmentFilter, dateFilter]
  );

  useEffect(() => {
    const signal = { cancelled: false };
    queueMicrotask(() => void load(signal));
    return () => {
      signal.cancelled = true;
    };
  }, [load]);

  const clearFilters = () => {
    setStatusFilter("all");
    setEquipmentFilter("");
    setDateFilter("");
  };

  return (
    <div className="flex flex-col">
      {/* Sticky filter bar */}
      <div className="sticky top-0 z-20 -mx-6 border-b border-neutral-800 bg-[#1a1917]/95 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status" className="text-xs text-neutral-400">
              Status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as JobStatus | "all")}
            >
              <SelectTrigger id="status" aria-label="Filter by status" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="equipment" className="text-xs text-neutral-400">
              Asset
            </Label>
            <Input
              id="equipment"
              placeholder="e.g., P-204"
              className="w-36"
              value={equipmentFilter}
              onChange={(e) => setEquipmentFilter(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date" className="text-xs text-neutral-400">
              From date
            </Label>
            <Input
              id="date"
              type="date"
              className="w-40"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-neutral-400 hover:text-neutral-200"
          >
            Clear
          </Button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <ul aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="border-b border-neutral-800 px-2 py-4">
              <div className="h-5 w-2/3 animate-pulse rounded bg-neutral-800/60" />
            </li>
          ))}
        </ul>
      ) : error ? (
        <div role="alert" className="flex flex-col gap-2 px-2 py-6">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : jobs.length === 0 ? (
        <p className="px-2 py-8 text-sm text-neutral-400">
          No investigations found. Try adjusting filters or create a new
          investigation.
        </p>
      ) : (
        <ul>
          {jobs.map((j) => (
            <li key={j.job_id}>
              <Link
                href={`/investigations/${j.job_id}`}
                className="flex items-center gap-4 border-b border-neutral-800 px-2 py-4 transition-colors hover:bg-neutral-800/50"
              >
                <JobStatusBadge status={j.status} />
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">
                  {j.objective_summary || "(no objective)"}
                </span>
                <span className="hidden shrink-0 font-mono text-sm text-neutral-400 sm:inline">
                  {j.equipment_id || "—"}
                </span>
                <time className="shrink-0 text-xs text-neutral-500">
                  {formatJobDate(j.created_at)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
