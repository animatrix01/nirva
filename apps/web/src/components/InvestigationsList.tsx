"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { JobStatusBadge } from "@/components/job-status-badge";
import { listJobs } from "@/lib/api";
import type { JobSummary } from "@/lib/types";

export function InvestigationsList() {
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");

  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await listJobs({
          status:
            statusFilter === "All" ? undefined : (statusFilter as JobSummary["status"]),
        });
        // Client-side equipment and date filtering
        let filtered = data;
        if (equipmentFilter) {
          filtered = filtered.filter((j) =>
            j.objective_summary?.includes(equipmentFilter)
          );
        }
        if (dateFilter) {
          const from = new Date(dateFilter);
          filtered = filtered.filter((j) => {
            const created = new Date(j.created_at);
            return created >= from;
          });
        }
        setJobs(filtered);
        setError(null);
      } catch (e) {
        setError(e?.detail ?? "Failed to load investigations");
        setJobs([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [statusFilter, equipmentFilter, dateFilter]);

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle>Investigations</CardTitle>
        <CardDescription>
          Search and filter investigations. Date filtering is client-side.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <Label htmlFor="status">Status</Label>
            <Input
              id="status"
              placeholder="All"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="equipment">Equipment</Label>
            <Input
              id="equipment"
              placeholder="e.g., P-204"
              value={equipmentFilter}
              onChange={(e) => setEquipmentFilter(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="date">From date</Label>
            <Input
              id="date"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          <div />
        </form>
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive mt-2">
            {error}
          </p>
        )}
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-4">
            No investigations found. Try adjusting filters.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {jobs.map((j) => (
              <div
                key={j.job_id}
                className="flex items-center justify-between p-3 rounded border bg-card"
              >
                <div className="flex items-center gap-3">
                  <JobStatusBadge status={j.status} />
                  <span className="font-medium truncate w-64">
                    {j.objective_summary ?? "-"}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {j.created_at}
                </span>
              </div>
            ))}
          </div>
        )}
        <Button
          asChild
          className="mt-3 justify-end"
          onClick={() => setSearchParams("")}
        >
          Clear filters
        </Button>
      </CardContent>
    </Card>
  );
}