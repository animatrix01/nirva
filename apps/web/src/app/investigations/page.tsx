"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  Filter,
  MoreVertical,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { JobStatusBadge } from "@/components/job-status-badge";

import { ApiError, listJobs } from "@/lib/api";
import type { JobStatus, JobSummary } from "@/lib/types";

// ─── Next-step copy ──────────────────────────────────────────────────────────
// Status pills and labels come from <JobStatusBadge>, which the investigation
// detail page and InvestigationsList already share, so all three agree. Only
// the "what happens next" wording still needs a per-status table, and the
// only consumer is the needs-attention block.

const NEXT_STEP: Record<JobStatus, string> = {
  queued: "Queued for execution",
  running: "Gathering evidence",
  awaiting_approval: "Supervisor approval required",
  completed: "Review results",
  failed: "Retry investigation",
  blocked_injection: "Review security event",
};

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return `${Math.round(hr / 24)} d ago`;
}

// ─── Small building blocks ───────────────────────────────────────────────────

function SectionTitle({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400">
        {label}
      </h2>
      <span className="rounded-full bg-neutral-700 px-2.5 py-0.5 text-xs font-bold text-neutral-300">
        {count}
      </span>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-600 px-2.5 py-0.5 text-xs text-neutral-200">
      {children}
    </span>
  );
}

function Kebab({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="More actions"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="rounded-md p-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-400"
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-30 w-44 rounded-md border border-neutral-700 bg-neutral-900 py-1 shadow-xl">
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-xs text-neutral-200 hover:bg-neutral-800"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/investigations/${jobId}`); setOpen(false); }}
          >
            Open investigation
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); void navigator.clipboard.writeText(jobId); setOpen(false); }}
          >
            Copy job ID
          </button>
        </div>
      )}
    </div>
  );
}

function OutlineLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#c8f135] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#b4e125]"
    >
      {children}
      <ArrowRight className="size-4" />
    </Link>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type TimeFilter = "all" | "24h" | "7d" | "30d";

export default function InvestigationsPage() {
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [assetFilter, setAssetFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const data = await listJobs();
      if (!signal?.cancelled) {
        setJobs(data);
        setError(null);
      }
    } catch (e: unknown) {
      if (signal?.cancelled) return;
      setError(
        e instanceof ApiError
          ? e.body.detail
          : "Failed to load investigations"
      );
      if (!signal?.cancelled) setJobs([]);
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    queueMicrotask(() => void load(signal));
    return () => {
      signal.cancelled = true;
    };
  }, [load]);

  const all = useMemo(() => jobs ?? [], [jobs]);

  // Time-window cutoff is derived from wall clock — kept out of render via
  // state so the purity rule is satisfied; updated asynchronously per filter.
  const [cutoff, setCutoff] = useState(0);
  useEffect(() => {
    if (timeFilter === "all") {
      queueMicrotask(() => setCutoff(0));
      return;
    }
    const span = timeFilter === "24h" ? 1 : timeFilter === "7d" ? 7 : 30;
    queueMicrotask(() => setCutoff(Date.now() - span * 86400000));
  }, [timeFilter]);

  // Workspace-level stats (unfiltered)
  const countBy = (s: JobStatus) => all.filter((j) => j.status === s).length;
  const stats = [
    { dot: "bg-amber-400", label: "Awaiting approval", count: countBy("awaiting_approval") },
    { dot: "bg-sky-400", label: "Running", count: countBy("running") },
    { dot: "bg-emerald-400", label: "Completed", count: countBy("completed") },
  ];

  // Filters (applied to everything below)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (assetFilter !== "all" && (j.equipment_id ?? "") !== assetFilter)
        return false;
      if (cutoff && new Date(j.created_at).getTime() < cutoff) return false;
      if (q && !j.objective_summary.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, statusFilter, assetFilter, cutoff, search]);

  // The approval queue is the app's core promise — no consequential action
  // without supervisor sign-off — so it stays on the page, but only while
  // something is actually waiting. An always-visible empty box is noise; a
  // silently missing queue is worse.
  const needs = filtered.filter((j) => j.status === "awaiting_approval");
  const recent = filtered.filter((j) => j.status === "completed").slice(0, 4);
  const completedCount = filtered.filter((j) => j.status === "completed").length;

  const assets = useMemo(() => {
    const set = new Set<string>();
    for (const j of all) if (j.equipment_id) set.add(j.equipment_id);
    return ["all", ...Array.from(set).sort()];
  }, [all]);

  return (
    <AppShell title="">
      <div className="mx-auto w-full max-w-[1400px] py-8">
        {/* 1. Page header & stats */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-100">Investigations</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Equipment problems and operational investigations
            </p>
          </div>
          <Link
            href="/investigations/new"
            className="flex items-center gap-1.5 rounded-md bg-[#c8f135] px-4 py-2 text-sm font-medium text-black transition hover:bg-[#b4e125]"
          >
            <Plus className="size-4" />
            New investigation
          </Link>
        </div>

        <div className="mt-5 flex items-center gap-5">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${s.dot}`} />
              <span className="text-sm font-bold text-neutral-100">
                {s.count}
              </span>
              <span className="text-sm font-medium text-neutral-500">
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* 2. Filter bar — selects left, search + Filters right.
            Filters collapses the selects to give the search more room; they
            start visible so the default view matches the reference. */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <div
            id="investigation-filters"
            className={`flex flex-wrap items-center gap-2 ${showFilters ? "" : "hidden"}`}
          >
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as JobStatus | "all")}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-400 outline-none transition focus:border-[#c8f135]"
            >
              <option value="all">All statuses</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="awaiting_approval">Awaiting approval</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="blocked_injection">Blocked injection</option>
            </select>
            <select
              aria-label="Filter by asset"
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value)}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-400 outline-none transition focus:border-[#c8f135]"
            >
              <option value="all">All assets</option>
              {assets
                .filter((a) => a !== "all")
                .map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
            </select>
            <select
              aria-label="Filter by time"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-400 outline-none transition focus:border-[#c8f135]"
            >
              <option value="all">All time</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search investigations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[240px] rounded-md border border-neutral-700 bg-neutral-900 py-2 pl-9 pr-3 text-sm text-neutral-200 outline-none transition placeholder:text-neutral-600 focus:border-[#c8f135] sm:w-[300px] lg:w-[340px]"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              aria-controls="investigation-filters"
              className="flex items-center gap-2 rounded-md bg-[#c8f135] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#b4e125]"
            >
              <Filter className="size-4" />
              Filters
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-2 rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
            >
              Retry
            </button>
          </div>
        )}

        {jobs === null && !error && (
          <div className="mt-8 space-y-3" aria-busy="true">
            <div className="h-24 animate-pulse rounded-xl bg-[#F8FAFC]" />
            <div className="h-16 animate-pulse rounded-xl bg-[#F8FAFC]" />
            <div className="h-40 animate-pulse rounded-xl bg-[#F8FAFC]" />
          </div>
        )}

        {jobs !== null && (
          <div className="mt-8 space-y-12">
            {/* NEEDS ATTENTION — rendered only while something is waiting.
                An always-present empty box was noise; a silently missing
                approval queue would be worse, so this stays on the page. */}
            {needs.length > 0 && (
              <section>
                <SectionTitle label="Needs attention" count={needs.length} />
                {needs.map((j) => (
                  <div
                    key={j.job_id}
                    className="rounded-xl border border-amber-300 bg-amber-50/40 p-6"
                  >
                    <div className="flex gap-4">
                      <TriangleAlert className="mt-1 size-5 shrink-0 text-amber-600" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold tracking-wide text-amber-600">
                          AWAITING APPROVAL
                        </p>
                        <h3 className="mt-1 text-base font-semibold text-neutral-100">
                          {j.objective_summary}
                        </h3>
                        <p className="mt-1 text-sm text-neutral-400">
                          Work-order draft ready — the investigation surfaced findings
                          that require a supervisor decision.
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {j.equipment_id ? <Tag>{j.equipment_id}</Tag> : null}
                          <Tag>awaiting supervisor</Tag>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-3">
                        <Kebab jobId={j.job_id} />
                        <OutlineLink href={`/investigations/${j.job_id}`}>
                          Review decision
                        </OutlineLink>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-6 border-t border-amber-500/15 pt-4">
                      <div>
                        <p className="text-xs text-neutral-400">Last updated</p>
                        <p className="mt-1 font-mono text-sm text-neutral-200">
                          {relativeTime(j.created_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-400">Confidence</p>
                        {j.confidence === null ? (
                          <p className="mt-1 font-mono text-xs text-neutral-500">—</p>
                        ) : (
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="font-mono text-base font-bold text-neutral-100">
                              {Math.round(j.confidence * 100)}%
                            </span>
                            <div className="h-1.5 flex-1 rounded-full bg-neutral-800">
                              <div
                                className="h-1.5 rounded-full bg-amber-500"
                                style={{ width: `${Math.round(j.confidence * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-neutral-400">Next step</p>
                        <p className="mt-1 text-sm font-medium text-amber-600">
                          {NEXT_STEP.awaiting_approval}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* RECENTLY COMPLETED */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400">
                    Recently completed
                  </h2>
                  <span className="rounded-full bg-neutral-700 px-2.5 py-0.5 text-xs font-bold text-neutral-300">
                    {completedCount}
                  </span>
                </div>
                <a
                  href="#all-investigations"
                  className="flex items-center gap-1 text-xs font-semibold text-neutral-400 transition hover:text-neutral-100"
                >
                  View all
                  <ArrowRight className="size-3.5" />
                </a>
              </div>

              {recent.length === 0 ? (
                <p className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-6 text-sm text-neutral-500">
                  No completed investigations yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {recent.map((j) => (
                    <Link
                      key={j.job_id}
                      href={`/investigations/${j.job_id}`}
                      className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-900 p-4 shadow-sm transition hover:border-neutral-600 hover:shadow-md"
                    >
                      {/* status + relative time */}
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="size-4 text-neutral-500" />
                          <span className="text-xs font-semibold text-neutral-500">
                            Completed
                          </span>
                        </span>
                        <span className="text-xs text-neutral-500">
                          {relativeTime(j.created_at)}
                        </span>
                      </div>

                      <h3 className="mt-2.5 line-clamp-2 text-sm font-semibold leading-snug text-neutral-100">
                        {j.objective_summary}
                      </h3>
                      <p className="mt-1 truncate text-xs text-neutral-500">
                        {j.equipment_id ?? "General investigation"}
                      </p>

                      <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
                        <FileText className="size-3.5 shrink-0" />
                        {j.sources} sources
                        {j.confidence === null ? null : (
                          <>
                            <span aria-hidden>·</span>
                            <span className="font-semibold text-neutral-300">
                              {Math.round(j.confidence * 100)}% confidence
                            </span>
                          </>
                        )}
                      </p>

                      <span className="mt-4 flex items-center justify-end gap-1 border-t border-neutral-800 pt-3 text-xs font-semibold text-neutral-300">
                        Open
                        <ArrowUpRight className="size-3.5" />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* ALL INVESTIGATIONS */}
            <section id="all-investigations">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400">
                    All investigations
                  </h2>
                  <span className="rounded-full bg-neutral-700 px-2.5 py-0.5 text-xs font-bold text-neutral-300">
                    {filtered.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setAssetFilter("all");
                    setTimeFilter("all");
                    setSearch("");
                  }}
                  className="flex items-center gap-1 text-xs text-neutral-400 underline-offset-2 transition hover:text-neutral-200 hover:underline"
                >
                  Reset filters
                  <ExternalLink className="size-3.5" />
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-sm">
                <div className="grid grid-cols-12 gap-3 border-b border-neutral-800 bg-neutral-800 px-4 pb-3 pt-3 text-xs font-bold uppercase tracking-wider text-neutral-500">
                  <div className="col-span-1">Status</div>
                  <div className="col-span-4">Investigation</div>
                  <div className="col-span-1">Asset</div>
                  <div className="col-span-1">Sources</div>
                  <div className="col-span-2">Confidence</div>
                  <div className="col-span-1">Updated</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {filtered.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-neutral-500">
                    No investigations match the current filters.
                  </p>
                ) : (
                  filtered.map((j) => {
                    return (
                      <Link
                        key={j.job_id}
                        href={`/investigations/${j.job_id}`}
                        className="grid grid-cols-12 items-center gap-3 border-b border-neutral-800 px-4 py-3.5 transition-colors hover:bg-neutral-800 last:border-0"
                      >
                        <div className="col-span-1">
                          <JobStatusBadge status={j.status} />
                        </div>
                        <div className="col-span-4 min-w-0">
                          <p className="truncate text-sm font-medium text-neutral-200">
                            {j.objective_summary}
                          </p>
                        </div>
                        <div className="col-span-1 text-sm font-medium text-neutral-400">
                          {j.equipment_id || <span className="text-neutral-400">—</span>}
                        </div>
                        <div className="col-span-1 text-sm font-medium text-neutral-400">
                          {j.sources}
                        </div>
                        <div className="col-span-2">
                          {j.confidence === null ? (
                            <span className="font-mono text-xs text-neutral-400">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-semibold text-neutral-200">
                                {Math.round(j.confidence * 100)}%
                              </span>
                              <div className="h-2 w-16 rounded-full bg-neutral-800">
                                <div
                                  className={`h-2 rounded-full ${
                                    j.status === "awaiting_approval"
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${Math.round(j.confidence * 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="col-span-1 font-mono text-xs font-medium text-neutral-500">
                          {relativeTime(j.created_at)}
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-1">
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-neutral-300 transition hover:border-neutral-600">
                            Open
                            <ArrowRight className="size-3" />
                          </span>
                          <Kebab jobId={j.job_id} />
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
