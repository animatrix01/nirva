"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  MoreVertical,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";

import { ApiError, getJob, listJobs } from "@/lib/api";
import type { JobStatus, JobSummary } from "@/lib/types";

// ─── Status presentation ─────────────────────────────────────────────────────

const STATUS_META: Record<
  JobStatus,
  { label: string; tagClass: string; next: string }
> = {
  queued: {
    label: "Queued",
    tagClass: "border-neutral-500/40 text-neutral-400",
    next: "Queued for execution",
  },
  running: {
    label: "Running",
    tagClass: "border-sky-500/40 text-sky-400",
    next: "Gathering evidence",
  },
  awaiting_approval: {
    label: "Awaiting approval",
    tagClass: "border-amber-500/40 text-amber-400",
    next: "Supervisor approval required",
  },
  completed: {
    label: "Completed",
    tagClass: "border-emerald-500/40 text-emerald-400",
    next: "Review results",
  },
  failed: {
    label: "Failed",
    tagClass: "border-red-500/40 text-red-400",
    next: "Retry investigation",
  },
  blocked_injection: {
    label: "Blocked injection",
    tagClass: "border-fuchsia-500/40 text-fuchsia-400",
    next: "Review security event",
  },
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
      <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
        {label}
      </h2>
      <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-neutral-300">
        {count}
      </span>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-700/80 px-2.5 py-0.5 text-[11px] text-neutral-300">
      {children}
    </span>
  );
}

function Kebab({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="More actions"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="rounded-md p-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-30 w-44 rounded-md border border-neutral-700 bg-neutral-900 py-1 shadow-xl">
          <Link
            href={`/investigations/${jobId}`}
            className="block px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
          >
            Open investigation
          </Link>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            onClick={() => {
              void navigator.clipboard.writeText(jobId);
              setOpen(false);
            }}
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
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800"
    >
      {children}
      <ArrowRight className="size-3.5" />
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

  const needs = filtered.filter((j) => j.status === "awaiting_approval");
  const active = filtered.filter((j) => j.status === "running");
  const recent = filtered.filter((j) => j.status === "completed").slice(0, 4);

  const assets = useMemo(() => {
    const set = new Set<string>();
    for (const j of all) if (j.equipment_id) set.add(j.equipment_id);
    return ["all", ...Array.from(set).sort()];
  }, [all]);

  // Fetch confidence for the featured needs-attention card
  const featured = needs[0];
  const [featuredConfidence, setFeaturedConfidence] = useState<number | null>(
    null
  );
  useEffect(() => {
    if (!featured) return;
    const signal = { cancelled: false };
    void getJob(featured.job_id)
      .then((d) => {
        if (!signal.cancelled)
          setFeaturedConfidence(d.final_report?.confidence ?? null);
      })
      .catch(() => {
        if (!signal.cancelled) setFeaturedConfidence(null);
      });
    return () => {
      signal.cancelled = true;
    };
  }, [featured]);

  return (
    <AppShell title="Investigations">
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* 1. Page header & stats */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Investigations</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Equipment problems and operational investigations
            </p>
          </div>
          <Link
            href="/investigations/new"
            className="flex items-center gap-1.5 rounded-md bg-[#C4F135] px-4 py-2 text-sm font-medium text-black transition hover:bg-[#b3dc2f]"
          >
            <Plus className="size-4" />
            New investigation
          </Link>
        </div>

        <div className="mt-5 flex items-center gap-5">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${s.dot}`} />
              <span className="text-sm text-neutral-300">
                {s.count} {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* 2. Filter bar */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as JobStatus | "all")}
              className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 outline-none transition focus:border-neutral-600"
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
              className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 outline-none transition focus:border-neutral-600"
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
              className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 outline-none transition focus:border-neutral-600"
            >
              <option value="all">All time</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search investigations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 rounded-md border border-neutral-800 bg-neutral-900 py-2 pl-9 pr-3 text-sm text-neutral-200 outline-none transition placeholder:text-neutral-500 focus:border-neutral-600"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                showFilters
                  ? "border-neutral-600 bg-neutral-800 text-neutral-100"
                  : "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-600"
              }`}
            >
              <Filter className="size-4" />
              Filters
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-6 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-sm text-red-400">{error}</p>
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
            <div className="h-24 animate-pulse rounded-xl bg-neutral-800/50" />
            <div className="h-16 animate-pulse rounded-xl bg-neutral-800/50" />
            <div className="h-40 animate-pulse rounded-xl bg-neutral-800/50" />
          </div>
        )}

        {jobs !== null && (
          <div className="mt-8 space-y-10">
            {/* 3. NEEDS ATTENTION */}
            <section>
              <SectionTitle label="Needs attention" count={needs.length} />
              {needs.length === 0 ? (
                <p className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-5 py-6 text-sm text-neutral-500">
                  Nothing awaiting approval right now.
                </p>
              ) : (
                needs.map((j, idx) => (
                  <div
                    key={j.job_id}
                    className={`rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-5 ${
                      idx > 0 ? "mt-4" : ""
                    }`}
                  >
                    <div className="flex gap-4">
                      <TriangleAlert className="mt-1 size-5 shrink-0 text-amber-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold tracking-wide text-amber-400">
                          AWAITING APPROVAL
                        </p>
                        <h3 className="mt-1 font-medium text-white">
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

                    {idx === 0 && (
                      <div className="mt-5 grid grid-cols-3 gap-6 border-t border-amber-500/15 pt-4">
                        <div>
                          <p className="text-xs text-neutral-500">Last updated</p>
                          <p className="mt-1 font-mono text-xs text-neutral-200">
                            {relativeTime(j.created_at)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500">Confidence</p>
                          {featuredConfidence === null ? (
                            <p className="mt-1 font-mono text-xs text-neutral-500">—</p>
                          ) : (
                            <>
                              <p className="mt-1 font-mono text-sm text-neutral-200">
                                {Math.round(featuredConfidence * 100)}%
                              </p>
                              <div className="mt-1.5 h-1 w-3/4 rounded-full bg-neutral-800">
                                <div
                                  className="h-1 rounded-full bg-amber-500"
                                  style={{ width: `${featuredConfidence * 100}%` }}
                                />
                              </div>
                            </>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500">Next step</p>
                          <p className="mt-1 text-sm text-amber-400">
                            {STATUS_META.awaiting_approval.next}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>

            {/* 4. ACTIVE */}
            <section>
              <SectionTitle label="Active" count={active.length} />
              {active.length === 0 ? (
                <p className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-5 py-6 text-sm text-neutral-500">
                  No investigations currently running.
                </p>
              ) : (
                active.map((j) => (
                  <div
                    key={j.job_id}
                    className="rounded-xl border border-sky-500/30 bg-sky-500/[0.04] p-5"
                  >
                    <div className="flex gap-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-sky-500/30 bg-sky-500/10">
                        <Clock className="size-5 text-sky-400" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold tracking-wide text-sky-400">
                          {STATUS_META.running.label.toUpperCase()}
                        </p>
                        <h3 className="mt-1 font-medium text-white">
                          {j.objective_summary}
                        </h3>
                        <p className="mt-1 text-sm text-neutral-400">
                          Agent executing the investigation plan
                        </p>
                      </div>
                      <div className="flex shrink-0 items-start gap-2">
                        <OutlineLink href={`/investigations/${j.job_id}`}>
                          Open
                        </OutlineLink>
                        <Kebab jobId={j.job_id} />
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-6 border-t border-sky-500/15 pt-4">
                      <div>
                        <p className="text-xs text-neutral-500">Asset</p>
                        <p className="mt-1 font-mono text-sm text-neutral-200">
                          {j.equipment_id || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-500">Progress</p>
                        <p className="mt-1 text-sm text-neutral-200">
                          Gathering evidence
                        </p>
                        <div className="mt-1.5 h-1 w-3/4 rounded-full bg-neutral-800">
                          <div className="h-1 w-1/2 rounded-full bg-sky-500" />
                        </div>
                      </div>
                        <div>
                          <p className="text-xs text-neutral-500">Started</p>
                          <p className="mt-1 font-mono text-xs text-neutral-200">
                            {relativeTime(j.created_at)}
                          </p>
                        </div>
                    </div>
                  </div>
                ))
              )}
            </section>

            {/* 5. RECENT */}
            <section>
              <SectionTitle label="Recently completed" count={recent.length} />
              {recent.length === 0 ? (
                <p className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-5 py-6 text-sm text-neutral-500">
                  No completed investigations yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {recent.map((j) => (
                    <Link
                      key={j.job_id}
                      href={`/investigations/${j.job_id}`}
                      className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 transition hover:border-neutral-700"
                    >
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        <span className="text-[11px] font-semibold tracking-wide text-emerald-400">
                          COMPLETED
                        </span>
                      </div>
                      <h3 className="mt-2 line-clamp-2 text-sm font-medium leading-snug text-white">
                        {j.objective_summary}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-snug text-neutral-400">
                        {j.equipment_id
                          ? `Equipment ${j.equipment_id}`
                          : "General investigation"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {j.equipment_id ? <Tag>{j.equipment_id}</Tag> : null}
                        <Tag>
                          <span className="font-mono">{relativeTime(j.created_at)}</span>
                        </Tag>
                      </div>
                      <div className="mt-4 flex items-center justify-end gap-1 border-t border-neutral-800 pt-3 text-xs text-neutral-500">
                        Open
                        <ArrowUpRight className="size-3.5" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* 6. ALL INVESTIGATIONS */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                    All investigations
                  </h2>
                  <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-neutral-300">
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

              <div className="overflow-hidden">
                <div className="grid grid-cols-12 gap-3 px-2 pb-2 text-sm text-neutral-500">
                  <div className="col-span-2">Status</div>
                  <div className="col-span-3">Investigation</div>
                  <div className="col-span-1">Asset</div>
                  <div className="col-span-1">Sources</div>
                  <div className="col-span-2">Confidence</div>
                  <div className="col-span-1">Updated</div>
                  <div className="col-span-2">Next step</div>
                </div>

                {filtered.length === 0 ? (
                  <p className="px-2 py-6 text-sm text-neutral-500">
                    No investigations match the current filters.
                  </p>
                ) : (
                  filtered.map((j) => {
                    const meta = STATUS_META[j.status] ?? {
                      label: j.status,
                      tagClass: "border-neutral-500/40 text-neutral-400",
                      next: "—",
                    };
                    return (
                      <Link
                        key={j.job_id}
                        href={`/investigations/${j.job_id}`}
                        className="grid grid-cols-12 items-center gap-3 border-b border-neutral-800 px-2 py-3.5 transition-colors hover:bg-neutral-800/40"
                      >
                        <div className="col-span-2">
                          <span
                            className={`rounded border px-2 py-0.5 text-[11px] font-medium ${meta.tagClass}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <div className="col-span-3 min-w-0">
                          <p className="truncate text-sm text-neutral-100">
                            {j.objective_summary}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-neutral-500">
                            {meta.next}
                          </p>
                        </div>
                        <div className="col-span-1 font-mono text-sm text-neutral-300">
                          {j.equipment_id || "—"}
                        </div>
                        <div className="col-span-1 font-mono text-sm text-neutral-300">
                          {j.sources}
                        </div>
                        <div className="col-span-2">
                          {j.confidence === null ? (
                            <span className="font-mono text-xs text-neutral-600">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-neutral-200">
                                {Math.round(j.confidence * 100)}%
                              </span>
                              <div className="h-1 w-12 rounded-full bg-neutral-800">
                                <div
                                  className={`h-1 rounded-full ${
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
                        <div className="col-span-1 font-mono text-xs text-neutral-400">
                          {relativeTime(j.created_at)}
                        </div>
                        <div className="col-span-2 flex items-center gap-2 text-xs text-neutral-400">
                          {meta.next}
                          <ArrowRight className="size-3 text-neutral-600" />
                          <span className="flex-1" />
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
      </main>
    </AppShell>
  );
}
