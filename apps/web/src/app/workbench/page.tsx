"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  FileSearch,
  FileText,
  HeartPulse,
  Library,
  Loader2,
  Plus,
  Search,
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
  getJobImageBlob,
  listApprovals,
  listDocuments,
  listJobs,
} from "@/lib/api";
import type { JobSummary } from "@/lib/types";
import type { ApprovalRequest } from "@/lib/artifacts";
import type { AuditResponse, DocumentOut, HealthResponse } from "@/lib/types";
// Read-only reuse of the audit ledger's action vocabulary so the safety view
// and the full audit log can never disagree about what an event means.
import { classifyAction } from "@/app/audit/page";

// ─── Shared blocks ────────────────────────────────────────────────────────────

/**
 * Panel — labelled card used by every role home.
 *
 * Default header is the original near-black bar. Passing `tone="ops"` opts into
 * the neutral steel header used by the admin workbench, and `icon` / `meta` /
 * `action` differentiate individual panels by shape and count rather than by
 * hue, so lime stays reserved for actions. The label element keeps its own text
 * only (icon renders as SVG, which contributes no textContent) so exact-text
 * queries still match.
 */
function Panel({
  label,
  icon: Icon,
  meta,
  action,
  tone = "default",
  children,
  className = "",
}: {
  label: string;
  icon?: typeof HeartPulse;
  meta?: string;
  action?: React.ReactNode;
  tone?: "default" | "ops";
  children: React.ReactNode;
  className?: string;
}) {
  const ops = tone === "ops";
  return (
    <section
      className={`overflow-hidden rounded-xl border bg-neutral-900 ${
        ops ? "border-neutral-700/80" : "border-neutral-800"
      } ${className}`}
    >
      <div
        className={
          ops
            ? "flex items-center gap-2.5 border-b px-5 py-3"
            : "border-b border-neutral-800 bg-neutral-900 px-5 py-3.5"
        }
        style={ops ? { backgroundColor: "#252420", borderColor: "#2E2D29" } : undefined}
      >
        {Icon && <Icon className={ops ? "size-4 shrink-0 text-neutral-500" : "hidden"} aria-hidden />}
        <p
          className={
            ops
              ? "text-[11px] font-bold uppercase tracking-[0.14em]"
              : "text-xs font-bold uppercase tracking-widest text-neutral-400"
          }
          style={ops ? { color: "#E8E5DD" } : undefined}
        >
          {label}
        </p>
        {ops && meta && (
          <span className="ml-auto text-[12px] font-semibold tabular-nums" style={{ color: "#7A7668" }}>
            {meta}
          </span>
        )}
        {ops && action && <span className="ml-auto shrink-0">{action}</span>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function LoadingBlock() {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-neutral-400">
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

// ─── Workbench design tokens (Claude-black) ───────────────────────────────────
// Kept local to this file so the Supervisor / Admin homes are untouched.
const WB = {
  page:   "#1C1B18",
  panel:  "#201F1C",
  raised: "#201F1C",
  border: "#2E2D29",
  ink:    "#E8E5DD",
  ink2:   "#A8A29E",
  muted:  "#7A7668",
  lime:   "#c8f135",
} as const;

type StatusMeta = {
  label: string;
  cls: string;
  bar: string;
};

/**
 * JobStatus is a frozen backend union (lib/types.ts). The label is the
 * engineer-facing wording; the colour carries the meaning. `queued` maps to
 * "Draft" because a queued job has not produced anything to review yet.
 */
const STATUS_META: Record<string, StatusMeta> = {
  completed:         { label: "Completed",          cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", bar: "bg-emerald-600" },
  awaiting_approval: { label: "Review required",    cls: "border-amber-500/30 bg-amber-500/10 text-amber-400",       bar: "bg-amber-500" },
  running:           { label: "In progress",        cls: "border-sky-500/30 bg-sky-500/10 text-sky-400",             bar: "bg-sky-600" },
  queued:            { label: "Draft",              cls: "border-neutral-700 bg-neutral-800 text-neutral-400",       bar: "bg-neutral-500" },
  failed:            { label: "Failed",             cls: "border-red-500/30 bg-red-500/10 text-red-400",             bar: "bg-red-500" },
  blocked_injection: { label: "Blocked — injection", cls: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-400", bar: "bg-fuchsia-500" },
};

const statusMeta = (status: string): StatusMeta =>
  STATUS_META[status] ?? STATUS_META.queued;

/** confidence is a 0–100 value in the JobSummary payload; clamp defensively. */
function confidencePct(value: number | null): number | null {
  if (value === null || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[12px] font-semibold ${meta.cls}`}
    >
      {meta.label}
    </span>
  );
}

/** Value + hairline bar. Colour follows status, not a decorative scheme. */
function ConfidenceMeter({ value, status }: { value: number | null; status: string }) {
  if (value === null) return <span className="text-[13px]" style={{ color: WB.muted }}>—</span>;
  const meta = statusMeta(status);
  return (
    <span className="flex flex-col gap-1">
      <span className="text-[13px] font-semibold tabular-nums" style={{ color: WB.ink }}>
        {value}%
      </span>
      <span className="block h-0.5 w-16 overflow-hidden rounded-full" style={{ background: "#E2E8F0" }}>
        <span className={`block h-full rounded-full ${meta.bar}`} style={{ width: `${value}%` }} />
      </span>
    </span>
  );
}

// ─── Engineer ─────────────────────────────────────────────────────────────────

function EngineerHome() {
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const data = await listJobs();
      if (!signal?.cancelled) {
        setJobs(data);
        setError(null);
        
        // Load image for latest job if it has equipment_id
        if (data.length > 0 && data[0].equipment_id) {
          const jobId = data[0].job_id;
          try {
            const blob = await getJobImageBlob(jobId);
            if (!signal?.cancelled) {
              const url = URL.createObjectURL(blob);
              setImageUrl(url);
            }
          } catch {
            // Image not available, ignore
          }
        }
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
      // Clean up object URL
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [load]);

  const latestJob = jobs && jobs.length > 0 ? jobs[0] : null;

  // Client-side filter over the rows the API already returned — no new fetch.
  const q = query.toLowerCase().trim();
  const visibleJobs = (jobs ?? []).filter(
    (j) =>
      !q ||
      j.objective_summary.toLowerCase().includes(q) ||
      (j.equipment_id ?? "").toLowerCase().includes(q) ||
      j.status.toLowerCase().includes(q),
  );

  // Asset context — only fields the payload actually carries.
  const assetId = latestJob?.equipment_id ?? null;
  const assetJobs = assetId ? (jobs ?? []).filter((j) => j.equipment_id === assetId) : [];
  const lastInvestigated = assetJobs.length
    ? assetJobs.reduce((acc, j) => (j.created_at > acc ? j.created_at : acc), assetJobs[0].created_at)
    : null;

  return (
    <div className="space-y-5" style={{ background: WB.page, margin: "-1rem -1.5rem", padding: "1.5rem" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1
            className="text-[33px] font-bold leading-[1.1] tracking-[-0.02em]"
            style={{ color: WB.ink }}
          >
            Engineer Workbench
          </h1>
          <p className="mt-2 text-[15px]" style={{ color: WB.ink2 }}>
            Submit equipment-failure questions and review evidence-backed findings.
          </p>
        </div>
        <Link
          href="/investigations/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-[14px] font-semibold text-black transition hover:brightness-105"
          style={{ background: WB.lime }}
        >
          <Plus className="size-4" />
          New investigation
        </Link>
      </div>

      {/* Last Investigation (focal) + Asset Context */}
      {latestJob && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
          <section
            className="rounded-xl border p-5"
            style={{ background: WB.raised, borderColor: WB.border }}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: WB.muted }}>
                Last investigation
              </p>
              <Link
                href="/investigations"
                className="inline-flex items-center gap-1 text-[12px] font-semibold transition hover:opacity-70"
                style={{ color: WB.ink2 }}
              >
                View all
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {imageUrl && (
                // Fixed 270x175 frame with object-cover — never stretches or
                // letterboxes a portrait/landscape source.
                <div
                  className="shrink-0 overflow-hidden rounded-lg border"
                  style={{ width: 270, height: 175, borderColor: WB.border, background: "#F1F5F9" }}
                >
                  <img
                    src={imageUrl}
                    alt={latestJob.equipment_id ?? "investigation"}
                    className="size-full object-cover object-center"
                  />
                </div>
              )}

              <div className="min-w-0 flex-1">
                {latestJob.equipment_id && (
                  <p className="font-mono text-[13px] font-semibold uppercase tracking-wide" style={{ color: WB.muted }}>
                    {latestJob.equipment_id}
                  </p>
                )}
                <h2 className="mt-1.5 text-[19px] font-semibold leading-snug" style={{ color: WB.ink }}>
                  {latestJob.objective_summary}
                </h2>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <StatusBadge status={latestJob.status} />
                  <span className="text-[13px]" style={{ color: WB.ink2 }}>
                    {latestJob.sources} source{latestJob.sources !== 1 ? "s" : ""}
                  </span>
                  {confidencePct(latestJob.confidence) !== null && (
                    <span className="text-[13px]" style={{ color: WB.ink2 }}>
                      {confidencePct(latestJob.confidence)}% confidence
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Link
                    href={`/investigations/${latestJob.job_id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[14px] font-semibold text-black transition hover:brightness-105"
                    style={{ background: WB.lime }}
                  >
                    {latestJob.status === "completed" ? "Review investigation" : "Continue investigation"}
                    <ArrowRight className="size-4" />
                  </Link>
                  <span
                    aria-hidden
                    className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg border text-[14px] font-semibold"
                    style={{ borderColor: WB.border, color: WB.ink2, background: WB.raised }}
                  >
                    …
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section
            className="rounded-xl border p-5"
            style={{ background: WB.panel, borderColor: WB.border }}
          >
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: WB.muted }}>
              Asset context
            </p>

            {assetId ? (
              <>
                <p className="font-mono text-[20px] font-semibold" style={{ color: WB.ink }}>
                  {assetId}
                </p>
                <dl className="mt-4 flex flex-col">
                  {[
                    { k: "Total investigations", v: String(assetJobs.length) },
                    { k: "Sources in last run",  v: String(latestJob.sources) },
                    { k: "Last investigated",    v: lastInvestigated ? formatDateTime(lastInvestigated) : "—" },
                  ].map((row, i) => (
                    <div
                      key={row.k}
                      className="flex items-center justify-between gap-3 py-2.5"
                      style={{ borderTop: i === 0 ? "none" : `1px solid ${WB.border}` }}
                    >
                      <dt className="text-[13px]" style={{ color: WB.muted }}>{row.k}</dt>
                      <dd className="text-[13px] font-semibold" style={{ color: WB.ink }}>{row.v}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="text-[13px]" style={{ color: WB.ink2 }}>
                No asset tag on the latest investigation.
              </p>
            )}
          </section>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          {
            href: "/investigations/new",
            icon: FileSearch,
            title: "Start new investigation",
            body: "Ask a question about equipment, incidents, procedures or anomalies.",
            tint: "#EFF6FF",
            iconColor: "#2563EB",
          },
          {
            href: "/documents",
            icon: FileText,
            title: "Open document library",
            body: "Browse manuals, SOPs, maintenance logs and more.",
            tint: "#F0FDF4",
            iconColor: "#15803D",
          },
          {
            // /approvals is supervisor+admin only (app-shell.tsx NAV_ITEMS), so
            // the third engineer-safe destination is the investigations index.
            href: "/investigations",
            icon: Loader2,
            title: "Review investigations",
            body: "Continue an open run or reopen a completed finding.",
            tint: "#FFFBEB",
            iconColor: "#B45309",
          },
        ].map((a) => (
          <Link
            key={a.href + a.title}
            href={a.href}
            className="group flex items-center gap-3.5 rounded-[10px] border p-4 transition"
            style={{ background: WB.raised, borderColor: WB.border }}
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: a.tint }}
            >
              <a.icon className="size-[18px]" style={{ color: a.iconColor }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold" style={{ color: WB.ink }}>{a.title}</span>
              <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: WB.ink2 }}>{a.body}</span>
            </span>
            <ArrowRight
              className="size-4 shrink-0 transition group-hover:translate-x-0.5"
              style={{ color: WB.muted }}
            />
          </Link>
        ))}
      </div>

      {/* Recent Investigations — investigation log */}
      <section
        className="overflow-hidden rounded-xl border"
        style={{ background: WB.raised, borderColor: WB.border }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
          style={{ borderBottom: `1px solid ${WB.border}` }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: WB.ink }}>
            Recent investigations
          </p>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2"
              style={{ color: WB.muted }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search investigations…"
              aria-label="Search investigations"
              className="w-60 rounded-lg border py-1.5 pl-8 pr-3 text-[13px] outline-none transition focus:border-[#c8f135]"
              style={{ background: WB.raised, borderColor: WB.border, color: WB.ink }}
            />
          </div>
        </div>

        {error ? (
          <div className="p-5">
            <ErrorBlock message={error} onRetry={() => void load()} />
          </div>
        ) : jobs === null ? (
          <div className="p-5">
            <LoadingBlock />
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[14px]" style={{ color: WB.ink2 }}>
              {q ? `No investigations match “${query}”` : "No investigations yet — start one above."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ background: WB.panel, borderBottom: `1px solid ${WB.border}` }}>
                    {[
                      { t: "Asset / equipment", align: "left" },
                      { t: "Investigation",       align: "left" },
                      { t: "Status",              align: "left" },
                      { t: "Sources",             align: "left" },
                      { t: "Confidence",          align: "left" },
                      { t: "Created",             align: "left" },
                      { t: "Action",              align: "right" },
                    ].map((h) => (
                      <th
                        key={h.t}
                        className={`px-5 py-2.5 text-${h.align} text-[11px] font-bold uppercase tracking-[0.1em]`}
                        style={{ color: WB.muted }}
                      >
                        {h.t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleJobs.map((job) => (
                    <tr
                      key={job.job_id}
                      className="transition"
                      style={{ borderBottom: `1px solid ${WB.border}` }}
                    >
                      <td className="px-5 py-3 font-mono text-[13px] font-semibold" style={{ color: WB.ink }}>
                        {job.equipment_id || "—"}
                      </td>
                      <td className="max-w-md px-5 py-3">
                        <p className="truncate font-medium" style={{ color: WB.ink }}>{job.objective_summary}</p>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-5 py-3 text-sm tabular-nums" style={{ color: WB.ink }}>{job.sources}</td>
                      <td className="px-5 py-3">
                        <ConfidenceMeter value={confidencePct(job.confidence)} status={job.status} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3" style={{ color: WB.muted }}>
                        {formatDateTime(job.created_at)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/investigations/${job.job_id}`}
                          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition"
                          style={{ borderColor: WB.border, color: WB.ink2, background: WB.raised }}
                        >
                          Open
                          <ArrowRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3" style={{ background: WB.panel }}>
              <Link
                href="/investigations"
                className="inline-flex items-center gap-1 text-[12px] font-semibold transition hover:opacity-70"
                style={{ color: WB.ink2 }}
              >
                View all investigations
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// ─── Supervisor ───────────────────────────────────────────────────────────────

// Module-scope "now" for mock timestamps and relative-time labels: evaluated
// once at import so render bodies stay pure (react-compiler rule).
const MOCK_NOW_MS = Date.now();

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

  // ── Mock data shown when real data is empty (demo mode) ──────────────────
  const MOCK_PENDING: ApprovalRequest[] = [
    {
      approval_id: "mock-apr-001",
      proposal_id: "mock-prop-001",
      job_id: "mock-job-001",
      action: "create_work_order",
      arguments_summary: "Replace bearing on Pump P-204 with OEM-spec 4.2 kN unit. Discard non-compliant 5.8 kN bearing installed per WO-88712.",
      evidence_refs: ["OEM Manual rev C, p.41", "WO-88712", "SOP-MRPL-004 §3.2"],
      risk_level: "high",
      status: "pending",
      requested_by: "engineer",
      requested_at: new Date(MOCK_NOW_MS - 1000 * 60 * 47).toISOString(),
      decided_by: null,
      decided_at: null,
      work_order_id: null,
    },
    {
      approval_id: "mock-apr-002",
      proposal_id: "mock-prop-002",
      job_id: "mock-job-002",
      action: "schedule_maintenance",
      arguments_summary: "Schedule shutdown of Compressor C-12 for impeller inspection. Vibration readings exceed SOP threshold by 18% over 3 days.",
      evidence_refs: ["Vibration Log VL-2026-089", "SOP-MRPL-007 §4.1", "IR-2024-031 p.3"],
      risk_level: "medium",
      status: "pending",
      requested_by: "engineer",
      requested_at: new Date(MOCK_NOW_MS - 1000 * 60 * 130).toISOString(),
      decided_by: null,
      decided_at: null,
      work_order_id: null,
    },
  ];

  const MOCK_DECIDED: ApprovalRequest[] = [
    {
      approval_id: "mock-apr-003",
      proposal_id: "mock-prop-003",
      job_id: "mock-job-003",
      action: "create_work_order",
      arguments_summary: "Replaced seal on Heat Exchanger HX-07. Leak confirmed per IR-2026-014.",
      evidence_refs: ["IR-2026-014", "OEM Manual HX §2.3"],
      risk_level: "high",
      status: "approved",
      requested_by: "engineer",
      requested_at: new Date(MOCK_NOW_MS - 1000 * 60 * 60 * 6).toISOString(),
      decided_by: "supervisor",
      decided_at: new Date(MOCK_NOW_MS - 1000 * 60 * 60 * 5).toISOString(),
      work_order_id: "WO-90021",
    },
    {
      approval_id: "mock-apr-004",
      proposal_id: "mock-prop-004",
      job_id: "mock-job-004",
      action: "create_work_order",
      arguments_summary: "Emergency shutdown of Pump P-108 — cavitation detected in 3 consecutive readings.",
      evidence_refs: ["Sensor Log SL-2026-041", "SOP-MRPL-002 §1.5"],
      risk_level: "high",
      status: "rejected",
      requested_by: "engineer",
      requested_at: new Date(MOCK_NOW_MS - 1000 * 60 * 60 * 26).toISOString(),
      decided_by: "supervisor",
      decided_at: new Date(MOCK_NOW_MS - 1000 * 60 * 60 * 25).toISOString(),
      work_order_id: null,
    },
    {
      approval_id: "mock-apr-005",
      proposal_id: "mock-prop-005",
      job_id: "mock-job-005",
      action: "schedule_maintenance",
      arguments_summary: "Lubrication service on Turbine T-03 per 500-hour schedule. Last service at 487 hours.",
      evidence_refs: ["OEM Manual T-03 §5.2", "Maintenance Log ML-2026-033"],
      risk_level: "medium",
      status: "approved",
      requested_by: "engineer",
      requested_at: new Date(MOCK_NOW_MS - 1000 * 60 * 60 * 50).toISOString(),
      decided_by: "supervisor",
      decided_at: new Date(MOCK_NOW_MS - 1000 * 60 * 60 * 49).toISOString(),
      work_order_id: "WO-90019",
    },
  ];

  const displayPending = pending.length > 0 ? pending : MOCK_PENDING;
  const displayDecided = decided.length > 0 ? decided : MOCK_DECIDED;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Supervisor Workbench</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Approve or reject consequential actions — nothing executes without you.
        </p>
      </div>

      {actionError && (
        <p role="alert" className="text-sm text-red-400">
          {actionError}
        </p>
      )}

      {/* Pending approvals - prominent */}
      <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/5 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-amber-500/20 px-5 py-3">
          <TriangleAlert className="size-4 text-amber-400" />
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
            Pending Approval ({displayPending.length})
          </p>
        </div>
        
        <div className="p-5">
          {error ? (
            <ErrorBlock message={error} onRetry={() => void load()} />
          ) : approvals === null ? (
            <LoadingBlock />
          ) : displayPending.length === 0 ? (
            <p className="py-4 text-sm text-neutral-400">
              Nothing awaiting your decision.
            </p>
          ) : (
            <div className="space-y-4">
              {displayPending.map((a) => {
                const waitMins = Math.floor((MOCK_NOW_MS - new Date(a.requested_at).getTime()) / 60000);
                const waitLabel = waitMins < 60
                  ? `${waitMins}m ago`
                  : `${Math.floor(waitMins / 60)}h ${waitMins % 60}m ago`;
                const riskCls = a.risk_level === "high"
                  ? "border-red-500/30 bg-red-500/10 text-red-400"
                  : a.risk_level === "medium"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
                return (
                  <div
                    key={a.approval_id}
                    className="rounded-lg border border-amber-500/20 bg-neutral-900 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${riskCls}`}>
                          {a.risk_level} risk
                        </span>
                        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                          {a.action.replace(/_/g, " ")}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-neutral-500 shrink-0">waiting {waitLabel}</span>
                    </div>
                    <p className="text-sm font-semibold text-neutral-100">
                      {a.arguments_summary}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {a.evidence_refs.map(ref => (
                        <span key={ref} className="rounded-full border border-neutral-700 bg-neutral-800 px-2.5 py-0.5 text-xs font-medium text-neutral-300">{ref}</span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={decidingId === a.approval_id}
                        onClick={() => decide(a.approval_id, "approved")}
                        className="flex items-center gap-1.5 rounded-md bg-[#c8f135] px-4 py-2 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
                      >
                        <CheckCircle2 className="size-4" />
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={decidingId === a.approval_id}
                        onClick={() => decide(a.approval_id, "rejected")}
                        className="flex items-center gap-1.5 rounded-md border-2 border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                      >
                        <XCircle className="size-4" />
                        Reject
                      </button>
                      {decidingId === a.approval_id && (
                        <Loader2 className="size-4 animate-spin text-neutral-400" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recently decided - compact */}
      <Panel label="Recently decided">
        {approvals === null ? (
          <LoadingBlock />
        ) : displayDecided.length === 0 ? (
          <p className="py-4 text-sm text-neutral-400">No decisions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {displayDecided.map((a) => (
              <div
                key={a.approval_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 hover:bg-neutral-800"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-100">
                    {a.arguments_summary}
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-medium text-neutral-500">
                    {a.work_order_id ? `work order ${a.work_order_id}` : "rejected"}{a.decided_at ? ` · ${new Date(a.decided_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded border px-2.5 py-0.5 text-xs font-bold ${
                  a.status === "approved"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-red-500/30 bg-red-500/10 text-red-400"
                }`}>
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

/**
 * SafetySection — white card with a clean, border-only header.
 *
 * Deliberately not the shared `Panel`: that component's default tone is the
 * near-black bar the supervisor home still uses, and `cream` belongs to the
 * admin home. Adding a third tone there would couple this layout to a component
 * every role shares. File-local, so no other home can be affected.
 */
function SafetySection({
  label,
  hint,
  action,
  children,
}: {
  label: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-xl border"
      style={{ background: WB.raised, borderColor: WB.border }}
    >
      <div
        className="flex items-start justify-between gap-4 px-5 py-4"
        style={{ borderBottom: `1px solid ${WB.border}` }}
      >
        <div className="min-w-0">
          <p
            className="text-base font-bold tracking-tight"
            style={{ color: WB.ink }}
          >
            {label}
          </p>
          {hint && (
            <p className="mt-1 text-sm" style={{ color: WB.ink2 }}>
              {hint}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/**
 * Action label + marker colour for the activity list.
 *
 * The mapping is reused verbatim from the audit ledger (`classifyAction`, which
 * classifies by prefix so it survives whatever the API returns); only the casing
 * is adapted, because the ledger's ALL-CAPS reads as shouting at row density.
 */
function actionLabel(action: string): { label: string; dot: string; ink: string } {
  const { label, tone } = classifyAction(action);
  const words = label.toLowerCase();
  return {
    label: words.charAt(0).toUpperCase() + words.slice(1),
    dot: TONE_DOT[tone] ?? TONE_DOT.neutral,
    ink: TONE_INK[tone] ?? TONE_INK.neutral,
  };
}

/** Restrained semantic markers — five tones, no rainbows. */
const TONE_DOT: Record<string, string> = {
  neutral: "bg-neutral-500",
  blue:    "bg-blue-600",
  green:   "bg-emerald-600",
  amber:   "bg-amber-500",
  red:     "bg-red-600",
};
const TONE_INK: Record<string, string> = {
  neutral: WB.ink2,
  blue:    "#1D4ED8",
  green:   "#047857",
  amber:   "#B45309",
  red:     "#B91C1C",
};

/**
 * Safety evidence-review row: asset → question → state → evidence count → time
 * → drill-in. Every value comes straight off the JobSummary payload; nothing is
 * derived, and the whole row stays a single link to the existing route.
 */
function SafetyJobRow({ job, divider }: { job: JobSummary; divider: boolean }) {
  const meta = statusMeta(job.status);
  return (
    <Link
      href={`/investigations/${job.job_id}`}
      className="group flex items-start gap-5 px-5 py-4 transition hover:bg-neutral-800"
      style={divider ? { borderTop: `1px solid ${WB.border}` } : undefined}
    >
      <div className="w-[128px] shrink-0">
        <p
          className="truncate font-mono text-[13px] font-semibold uppercase tracking-wide"
          style={{ color: WB.ink }}
          title={job.equipment_id ?? undefined}
        >
          {job.equipment_id || "—"}
        </p>
        <span
          className="mt-2 inline-flex items-center gap-1.5 text-[12px]"
          style={{ color: WB.ink2 }}
        >
          <span className={`size-1.5 shrink-0 rounded-full ${meta.bar}`} aria-hidden />
          {meta.label}
        </span>
      </div>

      <p
        className="line-clamp-2 min-w-0 flex-1 text-[14px] leading-snug"
        style={{ color: WB.ink }}
        title={job.objective_summary}
      >
        {job.objective_summary}
      </p>

      <div className="flex shrink-0 items-center gap-5 pt-0.5">
        <span
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] tabular-nums"
          style={{ background: WB.panel, borderColor: WB.border, color: WB.ink2 }}
        >
          <Library className="size-3.5" aria-hidden />
          {job.sources} source{job.sources !== 1 ? "s" : ""}
        </span>
        <span
          className="w-[124px] text-right text-[12px] tabular-nums"
          style={{ color: WB.muted }}
        >
          {formatDateTime(job.created_at)}
        </span>
        <ArrowRight
          className="size-4 shrink-0 transition group-hover:translate-x-0.5"
          style={{ color: WB.muted }}
          aria-hidden
        />
      </div>
    </Link>
  );
}

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

  // Newest first. The API deliberately returns its newest window in ascending
  // order (the ledger reads as a chronology); the safety view is a triage list,
  // so it reads the other way. Display-only — the array is not mutated.
  const events = audit ? [...audit.events].reverse() : [];
  // Ascending payload ⇒ the last element is the newest event.
  const latestTs = audit?.events.length ? audit.events[audit.events.length - 1].ts : null;

  // Every row below is a real field off the response. The backend verifies the
  // whole chain regardless of the `limit` window, so the status line is a
  // global claim, not a summary of the rows on screen.
  const chainFacts: Array<{ k: string; v: string }> = audit
    ? [
        { k: "Last audit entry",     v: latestTs ? formatDateTime(latestTs) : "—" },
        { k: "Events reviewed",      v: String(audit.events.length) },
        {
          k: "Verification status",
          v: audit.chain_valid ? "All records verified" : "Chain broken",
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h1
          className="text-[33px] font-bold leading-[1.1] tracking-[-0.02em]"
          style={{ color: WB.ink }}
        >
          Safety Workbench
        </h1>
        <p className="mt-2 text-[15px]" style={{ color: WB.ink2 }}>
          Review tamper-evident audit trail and investigation evidence.
        </p>
      </div>

      {error && <ErrorBlock message={error} onRetry={() => void load()} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.15fr]">
        <SafetySection
          label="Hash chain"
          hint="Investigation records are tamper-evident and verifiable."
        >
          {audit === null ? (
            <div className="p-5">
              <LoadingBlock />
            </div>
          ) : (
            <div className="p-5">
              <span
                className="inline-flex items-center gap-2"
                style={{ color: audit.chain_valid ? "#047857" : "#B91C1C" }}
              >
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    audit.chain_valid ? "bg-emerald-600" : "bg-red-600"
                  }`}
                  aria-hidden
                />
                <span className="text-[13px] font-semibold">
                  {audit.chain_valid
                    ? "valid — tamper-evident"
                    : "BROKEN — possible tampering"}
                </span>
              </span>
              <p className="mt-1.5 text-[12px]" style={{ color: WB.muted }}>
                Re-verified on every read.
              </p>

              <dl className="mt-4">
                {chainFacts.map((row) => (
                  <div
                    key={row.k}
                    className="flex items-center justify-between gap-3 py-2.5"
                    style={{ borderTop: `1px solid ${WB.border}` }}
                  >
                    <dt className="text-[13px]" style={{ color: WB.muted }}>{row.k}</dt>
                    <dd className="text-[13px] font-semibold" style={{ color: WB.ink }}>
                      {row.v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </SafetySection>

        <SafetySection
          label="Recent audit activity"
          hint="Latest actions in the audit trail for investigations and evidence access."
          action={
            <Link
              href="/audit"
              className="inline-flex items-center gap-1 text-[12px] font-semibold transition hover:opacity-70"
              style={{ color: WB.ink2 }}
            >
              View full audit log
              <ArrowRight className="size-3" />
            </Link>
          }
        >
          {audit === null ? (
            <div className="p-5">
              <LoadingBlock />
            </div>
          ) : events.length === 0 ? (
            <p className="px-5 py-6 text-[13px]" style={{ color: WB.ink2 }}>
              No audit events yet.
            </p>
          ) : (
            <ul>
              {events.map((e) => {
                const { label, dot, ink } = actionLabel(e.action);
                return (
                  <li
                    key={e.event_id}
                    className="flex items-center gap-3 px-5 py-3"
                    style={{ borderTop: `1px solid ${WB.border}` }}
                  >
                    <span className={`size-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
                    <span
                      className="shrink-0 text-[13px] font-semibold"
                      style={{ color: ink }}
                    >
                      {label}
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate font-mono text-[11px]"
                      style={{ color: WB.muted }}
                      title={e.action}
                    >
                      {e.action}
                    </span>
                    <span className="shrink-0 text-[12px]" style={{ color: WB.ink2 }}>
                      {e.outcome}
                    </span>
                    <span
                      className="w-[132px] shrink-0 text-right text-[12px] tabular-nums"
                      style={{ color: WB.muted }}
                    >
                      {formatDateTime(e.ts)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </SafetySection>
      </div>

      <SafetySection
        label="Evidence review — recent investigations"
        hint="Review completed investigations and supporting evidence."
      >
        {jobs === null ? (
          <div className="p-5">
            <LoadingBlock />
          </div>
        ) : jobs.length === 0 ? (
          <p className="px-5 py-6 text-[13px]" style={{ color: WB.ink2 }}>
            No investigations yet.
          </p>
        ) : (
          <div>
            {jobs.slice(0, 6).map((j, i) => (
              <SafetyJobRow key={j.job_id} job={j} divider={i > 0} />
            ))}
          </div>
        )}
      </SafetySection>
    </div>
  );
}

// ─── Admin ────────────────────────────────────────────────────────────────────

/**
 * Presentation-only captions. Not data — the health payload is a fixed key set
 * (postgres / qdrant / model_gateway / storage); an unrecognised key simply
 * gets no caption rather than an invented one.
 */
const SERVICE_ROLE: Record<string, string> = {
  postgres: "Database",
  qdrant: "Vector database",
  model_gateway: "Model gateway",
  storage: "File storage",
};

/** up = green, down = red. Two tones, and nothing else. */
const SVC_UP = {
  dot: "bg-emerald-500",
  bar: "bg-emerald-500",
  pill: "border-emerald-500/30 bg-emerald-500/10",
  ink: "#6EE7B7",
} as const;
const SVC_DOWN = {
  dot: "bg-red-500",
  bar: "bg-red-500",
  pill: "border-red-500/30 bg-red-500/10",
  ink: "#FCA5A5",
} as const;

const svcTone = (status: string) => (status === "up" ? SVC_UP : SVC_DOWN);

/**
 * Qualitative service bar.
 *
 * The fill widths are FIXED constants, not measurements — there is no timeseries
 * in the health payload and nothing here may imply one. Green fills the track
 * (up); red fills a short fixed segment (down). No numeric label is rendered.
 */
function ServiceBar({ up }: { up: boolean }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-neutral-700">
      <span className={`block h-full rounded-full ${up ? SVC_UP.bar : SVC_DOWN.bar}`} style={{ width: up ? "100%" : "40%" }} />
    </span>
  );
}

function AdminHome() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [models, setModels] = useState<
    Array<{ model_name: string; purpose: string; loaded: boolean }> | null
  >(null);
  const [docs, setDocs] = useState<DocumentOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    const cancelled = () => signal?.cancelled ?? false;

    // Fire all three in parallel — each resolves independently so a slow
    // endpoint doesn't block the others from rendering.
    await Promise.allSettled([
      getHealth()
        .then((h) => { if (!cancelled()) setHealth(h); })
        .catch(() => { if (!cancelled()) setHealth(null); }),
      getAdminModels()
        .then((m) => { if (!cancelled()) setModels(m); })
        .catch(() => { if (!cancelled()) setModels([]); }),
      listDocuments()
        .then((d) => { if (!cancelled()) setDocs(d); })
        .catch((e: unknown) => {
          if (cancelled()) return;
          setDocs([]);
          setError(e instanceof ApiError ? e.body.detail : "Failed to load documents");
        }),
    ]);
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

  // ── Derived operational summary ───────────────────────────────────────────
  // Every number below is counted off the response. Nothing is invented, and
  // the copy can never contradict the rows it sits above.
  const upCount = services.filter(([, s]) => s === "up").length;
  const downCount = services.length - upCount;

  const overall = !health
    ? null
    : downCount > 0
      ? { label: "Degraded", note: "Some services are unavailable", pill: "border-amber-500/30 bg-amber-500/10", ink: "#FCD34D", dot: "bg-amber-500" }
      : health.status === "degraded"
        ? { label: "Degraded", note: "Service reports degraded", pill: "border-amber-500/30 bg-amber-500/10", ink: "#FCD34D", dot: "bg-amber-500" }
        : { label: "OK", note: "All services responding", pill: "border-emerald-500/30 bg-emerald-500/10", ink: "#6EE7B7", dot: "bg-emerald-500" };

  const loadedCount = (models ?? []).filter((m) => m.loaded).length;
  const modelHeadline =
    models === null || models.length === 0
      ? "No models registered"
      : `${loadedCount} of ${models.length} models loaded`;
  const modelNote =
    models === null || models.length === 0
      ? null
      : loadedCount === 0
        ? "All models are currently not loaded"
        : loadedCount === models.length
          ? "All models are loaded"
          : `${loadedCount} of ${models.length} models loaded`;

  const indexed = (docs ?? []).filter((d) => d.status === "indexed").length;
  const quarantined = (docs ?? []).filter((d) => d.status === "quarantined").length;
  const docNote =
    docs === null || docs.length === 0
      ? { title: "Document library is empty", body: "Upload documents to build the retrieval corpus.", ink: WB.ink }
      : quarantined > 0
        ? {
            title: "Quarantine review required",
            body: `${quarantined} document${quarantined === 1 ? "" : "s"} held out of retrieval.`,
            ink: "#B45309",
          }
        : {
            title: "Document library is ready",
            body: "Manage documents, indexing and quarantine status.",
            ink: WB.ink,
          };

  return (
    <div className="space-y-4">
      <div>
        <h1
          className="text-[33px] font-bold leading-[1.1] tracking-[-0.02em]"
          style={{ color: WB.ink }}
        >
          Admin Workbench
        </h1>
        <p className="mt-2 text-[15px]" style={{ color: WB.ink2 }}>
          Service health, local models and document library.
        </p>
      </div>

      {error && <ErrorBlock message={error} onRetry={() => void load()} />}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Panel
          label="Service health"
          icon={HeartPulse}
          meta={`${services.length} service${services.length !== 1 ? "s" : ""}`}
          action={
            <Link
              href="/admin/system"
              className="inline-flex items-center gap-1 text-[12px] font-semibold transition hover:opacity-70"
              style={{ color: WB.ink2 }}
            >
              Open system admin
              <ArrowRight className="size-3" />
            </Link>
          }
          tone="ops"
        >
          {health === null ? (
            <LoadingBlock />
          ) : (
            <>
              <div className="rounded-lg border p-4" style={{ background: WB.panel, borderColor: WB.border }}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: WB.muted }}>
                      System status
                    </p>
                    <p className="mt-2 text-[20px] font-semibold leading-tight" style={{ color: WB.ink }}>
                      {upCount} service{upCount === 1 ? "" : "s"} healthy
                      <span className="px-1.5" style={{ color: WB.muted }}>·</span>
                      {downCount} unavailable
                    </p>
                    <p className="mt-1.5 text-[13px]" style={{ color: WB.ink2 }}>
                      Core services required for investigation and document processing.
                    </p>
                  </div>

                  {overall && (
                    <div
                      className={`shrink-0 rounded-lg border px-3.5 py-2.5 ${overall.pill}`}
                      style={{ borderColor: overall.pill.includes("amber") ? "#FDE68A" : "#A7F3D0" }}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`size-2 shrink-0 rounded-full ${overall.dot}`} aria-hidden />
                        <span className="text-[13px] font-bold uppercase tracking-wide" style={{ color: overall.ink }}>
                          {overall.label}
                        </span>
                      </span>
                      <p className="mt-1 text-[12px]" style={{ color: overall.ink }}>
                        {overall.note}
                      </p>
                    </div>
                  )}
                </div>
                <p className="mt-3 text-[11px]" style={{ color: WB.muted }}>
                  version {health.version}
                </p>
              </div>

              <ul className="mt-3 flex flex-col">
                {services.map(([name, status], i) => {
                  const t = svcTone(status);
                  const up = status === "up";
                  return (
                    <li
                      key={name}
                      className="flex items-center gap-4 py-3"
                      style={{ borderTop: `1px solid ${WB.border}` }}
                    >
                      <div className="w-[128px] shrink-0">
                        <p className="truncate text-[14px] font-semibold" style={{ color: WB.ink }}>
                          {name}
                        </p>
                        {SERVICE_ROLE[name] && (
                          <p className="mt-0.5 text-[12px]" style={{ color: WB.muted }}>
                            {SERVICE_ROLE[name]}
                          </p>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <ServiceBar up={up} />
                      </div>
                      <span
                        className={`inline-flex w-[74px] shrink-0 items-center justify-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-semibold ${t.pill}`}
                      >
                        <span className={`size-1.5 shrink-0 rounded-full ${t.dot}`} aria-hidden />
                        <span style={{ color: t.ink }}>{status}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Panel>

        <Panel
          label="Local model registry"
          icon={Cpu}
          meta={`${models?.length ?? 0} model${(models?.length ?? 0) !== 1 ? "s" : ""}`}
          tone="ops"
        >
          {models === null ? (
            <LoadingBlock />
          ) : (
            <>
              <div className="rounded-lg border p-4" style={{ background: WB.panel, borderColor: WB.border }}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: WB.muted }}>
                      Model status
                    </p>
                    <p className="mt-2 text-[20px] font-semibold leading-tight" style={{ color: WB.ink }}>
                      {modelHeadline}
                    </p>
                    <p className="mt-1.5 text-[13px]" style={{ color: WB.ink2 }}>
                      Local models used for investigation, retrieval and analysis.
                    </p>
                  </div>

                  {modelNote && (
                    <div
                      className="shrink-0 rounded-lg border px-3.5 py-2.5"
                      style={{ background: "#252420", borderColor: WB.border, maxWidth: 200 }}
                    >
                      <p className="text-center text-[12px] leading-snug" style={{ color: WB.ink2 }}>
                        {modelNote}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {models.length === 0 ? (
                <p className="py-4 text-[13px]" style={{ color: WB.ink2 }}>
                  No models registered.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col">
                  {models.map((m, i) => (
                    <li
                      key={m.model_name}
                      className="flex items-center justify-between gap-4 py-3"
                      style={{ borderTop: `1px solid ${WB.border}` }}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold" style={{ color: WB.ink }} title={m.model_name}>
                          {m.model_name}
                        </p>
                        <p className="mt-0.5 text-[12px]" style={{ color: WB.muted }}>
                          {m.purpose}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium`}
                        style={
                          m.loaded
                            ? { borderColor: "#34D39955", background: "#34D39918", color: "#6EE7B7" }
                            : { borderColor: WB.border, background: "#252420", color: WB.ink2 }
                        }
                      >
                        <span
                          className={`size-1.5 shrink-0 rounded-full ${m.loaded ? "bg-emerald-600" : "bg-neutral-500"}`}
                          aria-hidden
                        />
                        {m.loaded ? "loaded" : "not loaded"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Panel>
      </div>

      <Panel
        label="Document library state"
        meta={`${docs?.length ?? 0} document${(docs?.length ?? 0) !== 1 ? "s" : ""}`}
        tone="ops"
      >
        {docs === null ? (
          <LoadingBlock />
        ) : (
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex flex-wrap gap-3">
              {[
                { n: docs.length, label: "documents", tint: "#252420", ink: WB.ink },
                { n: indexed, label: "indexed", tint: "#34D39918", ink: "#6EE7B7" },
                { n: quarantined, label: "quarantined", tint: "#FBBF2418", ink: "#FCD34D" },
              ].map((m) => (
                <div
                  key={m.label}
                  className="min-w-[116px] flex-1 rounded-lg px-4 py-3"
                  style={{ background: m.tint }}
                >
                  <p className="text-[22px] font-semibold leading-none tabular-nums" style={{ color: m.ink }}>
                    {m.n}
                  </p>
                  <p className="mt-1.5 text-[12px]" style={{ color: WB.muted }}>
                    {m.label}
                  </p>
                </div>
              ))}
            </div>

            <span className="hidden h-10 w-px sm:block" style={{ background: WB.border }} aria-hidden />

            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold" style={{ color: docNote.ink }}>
                  {docNote.title}
                </p>
                <p className="mt-1 text-[13px]" style={{ color: WB.ink2 }}>
                  {docNote.body}
                </p>
              </div>
              <Link
                href="/documents"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-4 py-2 text-[13px] font-semibold transition hover:bg-neutral-800"
                style={{ borderColor: WB.border, color: WB.ink, background: WB.raised }}
              >
                Open library
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
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
        <div className="flex items-center gap-2 p-6 text-sm text-neutral-400">Loading…</div>
      </div>
    );
  }

  return (
    <AppShell title="Workbench">
      <div className="pb-12">
        {auth.user.role === "engineer" && <EngineerHome />}
        {auth.user.role === "supervisor" && <SupervisorHome />}
        {auth.user.role === "safety_officer" && <SafetyHome />}
        {auth.user.role === "admin" && <AdminHome />}
      </div>
    </AppShell>
  );
}
