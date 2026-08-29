"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Investigations</CardTitle>
        <CardDescription>
          Filter by status, asset, or date. Date filtering is applied locally.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as JobStatus | "all")}
            >
              <SelectTrigger id="status" aria-label="Filter by status">
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="equipment">Asset</Label>
            <Input
              id="equipment"
              placeholder="e.g., P-204"
              value={equipmentFilter}
              onChange={(e) => setEquipmentFilter(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="date">From date</Label>
            <Input
              id="date"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded border bg-muted/50"
              />
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>          </div>
        ) : jobs.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            No investigations found. Try adjusting filters or create a new
            investigation.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {jobs.map((j) => (
              <li key={j.job_id}>
                <Link
                  href={`/investigations/${j.job_id}`}
                  className="bg-card hover:bg-muted/50 flex items-center justify-between gap-3 rounded border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <JobStatusBadge status={j.status} />
                    <span className="truncate text-sm font-medium">
                      {j.objective_summary || "(no objective)"}
                    </span>
                  </div>
                  <time className="text-muted-foreground shrink-0 text-xs">
                    {formatJobDate(j.created_at)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
          <Button asChild size="sm">
            <Link href="/investigations/new">New investigation</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
