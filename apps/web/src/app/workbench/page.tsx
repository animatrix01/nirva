"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  FileText,
  Loader2,
  Plus,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useStoredAuth } from "@/lib/auth-client";
import {
  ApiError,
  decideApproval,
  getAdminModels,
  getAudit,
  getHealth,
  listApprovals,
  listDocuments,
  listJobs,
} from "@/lib/api";
import type { JobSummary } from "@/lib/types";
import type { ApprovalRequest } from "@/lib/artifacts";
import type { AuditResponse, DocumentOut, HealthResponse } from "@/lib/types";

// ─── Shared blocks ────────────────────────────────────────────────────────────

function Panel({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-neutral-800 bg-neutral-900/60 ${className}`}>
      <p className="border-b border-neutral-800 px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      <div className="p-5">{children}</div>
    </section>
  );
}

function LoadingBlock() {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-neutral-500">
      <Loader2 className="size-4 animate-spin" />
      Loading…
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
      <p className="text-sm text-red-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
      >
        Retry
      </button>
    </div>
  );
}

function JobRow({ job }: { job: JobSummary }) {
  return (
    <Link
      href={`/investigations/${job.job_id}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 px-4 py-3 transition hover:border-neutral-600 hover:bg-neutral-800/40"
    >
      <div className="min-w-0">
        <p className="truncate text-sm text-neutral-100">{job.objective_summary}</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {job.status.replace("_", " ")}
          {job.equipment_id ? ` · ${job.equipment_id}` : ""}
        </p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-neutral-600" />
    </Link>
  );
}

// ─── Engineer ─────────────────────────────────────────────────────────────────

function EngineerHome() {
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const data = await listJobs();
      if (!signal?.cancelled) {
        setJobs(data);
        setError(null);
      }
    } catch (e: unknown) {
      if (signal?.cancelled) return;
      setError(e instanceof ApiError ? e.body.detail : "Failed to load jobs");
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

  const latestJob = jobs && jobs.length > 0 ? jobs[0] : null;
  const recentJobs = (jobs ?? []).slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Engineer Workbench</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Submit equipment-failure questions and review findings.
          </p>
        </div>
        <Link
          href="/investigations/new"
          className="flex items-center gap-1.5 rounded-md bg-[#C4F135] px-4 py-2 text-sm font-medium text-black transition hover:brightness-110"
        >
          <Plus className="size-4" />
          New investigation
        </Link>
      </div>

      {/* Last Investigation */}
      {latestJob && (
        <div className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-5">
          <p className="text-[10px] uppercase tracking-widest text-neutral-600 mb-3">
            Last Investigation
          </p>
          
          <div className="flex items-start gap-4">
            {/* Image preview if available - only show if equipment_id exists */}
            {latestJob.equipment_id && (
              <div className="size-20 shrink-0 rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden flex items-center justify-center">
                <img
                  src={`/api/jobs/${latestJob.job_id}/image`}
                  className="size-full object-cover"
                  alt={latestJob.equipment_id}
                  loading="lazy"
                  onError={(e) => {
                    // Replace with placeholder or hide
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.innerHTML = `<div class="text-neutral-700 text-xs">${latestJob.equipment_id}</div>`;
                    }
                  }}
                />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              {/* Equipment ID */}
              {latestJob.equipment_id && (
                <p className="text-xs font-mono text-neutral-500">
                  {latestJob.equipment_id}
                </p>
              )}
              
              {/* Objective */}
              <p className="text-base font-semibold text-white mt-1">
                {latestJob.objective_summary}
              </p>
              
              {/* Status row */}
              <div className="flex items-center gap-3 mt-2 text-sm">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                  latestJob.status === "completed"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : latestJob.status === "failed"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-blue-500/10 text-blue-400"
                }`}>
                  {latestJob.status}
                </span>
                <span className="text-neutral-400 text-xs">
                  {latestJob.sources} source{latestJob.sources !== 1 ? 's' : ''}
                </span>
                {latestJob.confidence !== null && (
                  <span className="text-neutral-400 text-xs">
                    {latestJob.confidence}% confidence
                  </span>
                )}
              </div>
              
              {/* Action */}
              <Link
                href={`/investigations/${latestJob.job_id}`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#c8f135] hover:text-[#c8f135]/80 transition"
              >
                {latestJob.status === "completed" ? "Review" : "Continue"} investigation
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center gap-3 text-sm">
        <Link
          href="/investigations/new"
          className="flex items-center gap-2 text-neutral-300 hover:text-white transition"
        >
          <Plus className="size-4" />
          Start investigation
        </Link>
        <span className="text-neutral-800">·</span>
        <Link
          href="/documents"
          className="flex items-center gap-2 text-neutral-300 hover:text-white transition"
        >
          <FileSearch className="size-4" />
          Open document library
        </Link>
      </div>

      {/* Recent Investigations - Table */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
        <p className="border-b border-neutral-800 px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
          Recent Investigations
        </p>
        
        {error ? (
          <div className="p-5">
            <ErrorBlock message={error} onRetry={() => void load()} />
          </div>
        ) : jobs === null ? (
          <div className="p-5">
            <LoadingBlock />
          </div>
        ) : recentJobs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">
            No investigations yet — start one above.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800">
                    <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500">
                      Equipment
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500">
                      Investigation
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500">
                      Status
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-neutral-500">
                      Sources
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-neutral-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job) => (
                    <tr key={job.job_id} className="border-b border-neutral-800/50 hover:bg-neutral-800/40 transition">
                      <td className="px-5 py-3 font-mono text-xs text-neutral-400">
                        {job.equipment_id || "—"}
                      </td>
                      <td className="px-5 py-3 text-neutral-200">
                        <p className="truncate max-w-md">{job.objective_summary}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                          job.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : job.status === "failed"
                              ? "bg-red-500/10 text-red-400"
                              : "bg-blue-500/10 text-blue-400"
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-neutral-400">
                        {job.sources} {job.confidence !== null ? `· ${job.confidence}%` : ''}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/investigations/${job.job_id}`}
                          className="text-[#c8f135] hover:text-[#c8f135]/80 transition text-xs font-medium"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="border-t border-neutral-800 px-5 py-3">
              <Link
                href="/investigations"
                className="text-xs text-neutral-400 hover:text-neutral-200 transition inline-flex items-center gap-1"
              >
                View all investigations
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Supervisor ───────────────────────────────────────────────────────────────

function SupervisorHome() {
  const [approvals, setApprovals] = useState<ApprovalRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const data = await listApprovals();
      if (!signal?.cancelled) {
        setApprovals(data);
        setError(null);
      }
    } catch (e: unknown) {
      if (signal?.cancelled) return;
      setError(e instanceof ApiError ? e.body.detail : "Failed to load approvals");
      if (!signal?.cancelled) setApprovals([]);
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    queueMicrotask(() => void load(signal));
    return () => {
      signal.cancelled = true;
    };
  }, [load]);

  const decide = (approvalId: string, decision: "approved" | "rejected") => {
    setDecidingId(approvalId);
    void decideApproval(approvalId, decision, null)
      .then((result) => {
        setApprovals((prev) =>
          (prev ?? []).map((a) =>
            a.approval_id === approvalId
              ? {
                  ...a,
                  status: result.status,
                  decided_by: result.decided_by,
                  decided_at: result.decided_at,
                  work_order_id: result.work_order_id,
                }
              : a
          )
        );
      })
      .catch((e: unknown) =>
        setActionError(
          e instanceof ApiError ? e.body.detail : "Failed to record decision"
        )
      )
      .finally(() => setDecidingId(null));
  };

  const pending = (approvals ?? []).filter((a) => a.status === "pending");
  const decided = (approvals ?? [])
    .filter((a) => a.status !== "pending")
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Supervisor Workbench</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Approve or reject consequential actions — nothing executes without you.
        </p>
      </div>

      {actionError && (
        <p role="alert" className="text-sm text-red-400">
          {actionError}
        </p>
      )}

      {/* Pending approvals - prominent */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] overflow-hidden">
        <div className="flex items-center gap-2 border-b border-amber-500/30 px-5 py-3">
          <TriangleAlert className="size-4 text-amber-400" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400">
            Pending Approval ({pending.length})
          </p>
        </div>
        
        <div className="p-5">
          {error ? (
            <ErrorBlock message={error} onRetry={() => void load()} />
          ) : approvals === null ? (
            <LoadingBlock />
          ) : pending.length === 0 ? (
            <p className="py-4 text-sm text-neutral-500">
              Nothing awaiting your decision.
            </p>
          ) : (
            <div className="space-y-3">
              {pending.map((a) => (
                <div
                  key={a.approval_id}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-4"
                >
                  <p className="text-[11px] font-semibold tracking-wide text-amber-400">
                    {a.action.toUpperCase()} · RISK {a.risk_level.toUpperCase()}
                  </p>
                  <p className="mt-1 text-sm text-neutral-100">
                    {a.arguments_summary}
                  </p>
                  <p className="mt-1 font-mono text-xs text-neutral-500">
                    evidence: {a.evidence_refs.join(", ") || "—"}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={decidingId === a.approval_id}
                      onClick={() => decide(a.approval_id, "approved")}
                      className="flex items-center gap-1.5 rounded-md bg-[#C4F135] px-3 py-1.5 text-xs font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={decidingId === a.approval_id}
                      onClick={() => decide(a.approval_id, "rejected")}
                      className="flex items-center gap-1.5 rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <XCircle className="size-3.5" />
                      Reject
                    </button>
                    {decidingId === a.approval_id && (
                      <Loader2 className="size-4 animate-spin text-neutral-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recently decided - compact */}
      <Panel label="Recently decided">
        {approvals === null ? (
          <LoadingBlock />
        ) : decided.length === 0 ? (
          <p className="py-4 text-sm text-neutral-500">No decisions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {decided.map((a) => (
              <div
                key={a.approval_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-neutral-200">
                    {a.arguments_summary}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-neutral-500">
                    {a.work_order_id ? `work order ${a.work_order_id}` : "rejected"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 text-[11px] ${
                    a.status === "approved"
                      ? "border-emerald-500/40 text-emerald-400"
                      : "border-red-500/40 text-red-400"
                  }`}
                >
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ─── Safety officer ───────────────────────────────────────────────────────────

function SafetyHome() {
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const [a, j] = await Promise.all([getAudit({ limit: 8 }), listJobs()]);
      if (!signal?.cancelled) {
        setAudit(a);
        setJobs(j);
        setError(null);
      }
    } catch (e: unknown) {
      if (signal?.cancelled) return;
      setError(e instanceof ApiError ? e.body.detail : "Failed to load audit data");
      if (!signal?.cancelled) {
        setAudit({ chain_valid: false, events: [] });
        setJobs([]);
      }
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    queueMicrotask(() => void load(signal));
    return () => {
      signal.cancelled = true;
    };
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Safety Workbench</h1>
        <p className="mt-1 text-neutral-500 text-sm">
          Review tamper-evident audit trail and investigation evidence.
        </p>
      </div>

      {error && <ErrorBlock message={error} onRetry={() => void load()} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel label="Hash chain" className="lg:col-span-1">
          {audit === null ? (
            <LoadingBlock />
          ) : (
            <div>
              <span
                className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium ${
                  audit.chain_valid
                    ? "border-emerald-500/40 text-emerald-400"
                    : "border-red-500/40 text-red-400"
                }`}
              >
                {audit.chain_valid ? "valid — tamper-evident" : "BROKEN — possible tampering"}
              </span>
              <p className="mt-3 text-xs text-neutral-500">
                Re-verified on every read.
              </p>
            </div>
          )}
        </Panel>

        <Panel label="Recent audit events" className="lg:col-span-2">
          {audit === null ? (
            <LoadingBlock />
          ) : audit.events.length === 0 ? (
            <p className="py-4 text-sm text-neutral-500">No audit events yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {audit.events.map((e) => (
                <li key={e.event_id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-mono text-neutral-400">{e.action}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      e.outcome === "ok"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : e.outcome === "blocked"
                          ? "bg-fuchsia-500/10 text-fuchsia-400"
                          : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {e.outcome}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/audit"
            className="mt-4 inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200"
          >
            Open full audit log
            <ArrowRight className="size-3" />
          </Link>
        </Panel>
      </div>

      <Panel label="Evidence review — recent investigations">
        {jobs === null ? (
          <LoadingBlock />
        ) : jobs.length === 0 ? (
          <p className="py-4 text-sm text-neutral-500">No investigations yet.</p>
        ) : (
          <div className="space-y-2">
            {jobs.slice(0, 6).map((j) => (
              <JobRow key={j.job_id} job={j} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ─── Admin ────────────────────────────────────────────────────────────────────

function AdminHome() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [models, setModels] = useState<
    Array<{ model_name: string; purpose: string; loaded: boolean }>
  >([]);
  const [docs, setDocs] = useState<DocumentOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const [h, m, d] = await Promise.all([
        getHealth(),
        getAdminModels(),
        listDocuments(),
      ]);
      if (!signal?.cancelled) {
        setHealth(h);
        setModels(m);
        setDocs(d);
        setError(null);
      }
    } catch (e: unknown) {
      if (signal?.cancelled) return;
      setError(e instanceof ApiError ? e.body.detail : "Failed to load system state");
      if (!signal?.cancelled) setDocs([]);
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    queueMicrotask(() => void load(signal));
    return () => {
      signal.cancelled = true;
    };
  }, [load]);

  const services = health
    ? (Object.entries(health.services) as Array<[string, string]>)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Workbench</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Service health, local models and document library.
        </p>
      </div>

      {error && <ErrorBlock message={error} onRetry={() => void load()} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel label="Service health">
          {health === null ? (
            <LoadingBlock />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {services.map(([name, status]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2.5"
                >
                  <span className="font-mono text-xs text-neutral-300">{name}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      status === "up"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {status}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link
            href="/admin/system"
            className="mt-4 inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200"
          >
            Open system admin
            <ArrowRight className="size-3" />
          </Link>
        </Panel>

        <Panel label="Local model registry">
          {models.length === 0 && !error ? (
            <LoadingBlock />
          ) : (
            <div className="space-y-1.5">
              {models.map((m) => (
                <div
                  key={m.model_name}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-neutral-200">
                      {m.model_name}
                    </p>
                    <p className="text-[10px] text-neutral-500">{m.purpose}</p>
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      m.loaded
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-neutral-800 text-neutral-500"
                    }`}
                  >
                    {m.loaded ? "loaded" : "not loaded"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel label="Document library state">
        {docs === null ? (
          <LoadingBlock />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-200">
              {docs.length} documents
            </span>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
              {docs.filter((d) => d.status === "indexed").length} indexed
            </span>
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
              {docs.filter((d) => d.status === "quarantined").length} quarantined
            </span>
            <Link
              href="/documents"
              className="ml-auto inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200"
            >
              Open library
              <ArrowRight className="size-3" />
            </Link>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkbenchPage() {
  const router = useRouter();
  const auth = useStoredAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (mounted && auth === null) router.replace("/login");
  }, [mounted, auth, router]);

  if (!auth) {
    return (
      <div className="min-h-screen bg-background" aria-busy="true">
        <div className="flex items-center gap-2 p-6 text-sm text-neutral-500">Loading…</div>
      </div>
    );
  }

  return (
    <AppShell title="Workbench">
      {auth.user.role === "engineer" && <EngineerHome />}
      {auth.user.role === "supervisor" && <SupervisorHome />}
      {auth.user.role === "safety_officer" && <SafetyHome />}
      {auth.user.role === "admin" && <AdminHome />}
    </AppShell>
  );
}
