"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useStoredAuth } from "@/lib/auth-client";
import { ApiError, getEvals } from "@/lib/api";
import type { EvalsCase, EvalsResponse } from "@/lib/types";

// ─── Evals design tokens ──────────────────────────────────────────────────────
// File-scoped so no global theme is touched. The page keeps the AppShell
// blue-grey canvas; these apply to the white surfaces inside it.
const EV = {
  card:   "#FFFFFF",
  border: "#E2E8F0",
  head:   "#F8FAFC",
  ink:    "#0F172A",
  ink2:   "#475569",
  muted:  "#64748B",
  good:   "#15803D",
  goodBg: "#ECFDF5",
  bad:    "#B91C1C",
  badBg:  "#FEF2F2",
  amber:  "#B45309",
} as const;

const PAGE_SIZE = 10;

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Restrained boolean state: a dot plus a word, not a coloured pill. */
function StateDot({ value, pass }: { value: boolean | null; pass: boolean }) {
  if (value === null) return <span className="text-[13px]" style={{ color: EV.muted }}>—</span>;
  const good = pass;
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]"
      style={{ color: good ? EV.good : EV.bad }}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: good ? EV.good : EV.bad }}
        aria-hidden
      />
      {value ? "Yes" : "No"}
    </span>
  );
}

type Metric = {
  label: string;
  value: string;
  target: string;
  passed: boolean;
};

/**
 * One neutral group (Retrieval Quality / Answer Reliability / Safety & Access)
 * holding two compact metric rows. No icons, no coloured header — the meaning
 * comes from typography and grouping.
 */
function MetricGroup({ title, blurb, metrics }: { title: string; blurb: string; metrics: Metric[] }) {
  return (
    <section
      className="overflow-hidden rounded-[10px] border"
      style={{ background: EV.card, borderColor: EV.border }}
    >
      <div className="px-4 pt-4 pb-3">
        <h3 className="text-[16px] font-semibold leading-tight" style={{ color: EV.ink }}>{title}</h3>
        <p className="mt-1 text-[13px] leading-snug" style={{ color: EV.muted }}>{blurb}</p>
      </div>
      <div>
        {metrics.map((m) => (
          <div
            key={m.label}
            className="flex items-center justify-between gap-3 px-4 py-3"
            style={{ borderTop: `1px solid ${EV.border}` }}
          >
            <div className="min-w-0">
              <p className="text-[14px] font-medium" style={{ color: EV.ink }}>{m.label}</p>
              <p className="mt-0.5 text-[12px]" style={{ color: EV.muted }}>{m.target}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-[24px] font-semibold tabular-nums" style={{ color: EV.ink }}>{m.value}</span>
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium"
                style={{
                  background: m.passed ? EV.goodBg : EV.badBg,
                  color: m.passed ? EV.good : EV.bad,
                }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: m.passed ? EV.good : EV.bad }}
                  aria-hidden
                />
                {m.passed ? "Gate passed" : "Gate failed"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Derived outcome buckets — EvalsCase has no `outcome` field. */
type OutcomeKey = "all" | "blocked" | "unauthorized" | "abstained" | "answered";

const OUTCOME_LABEL: Record<OutcomeKey, string> = {
  all: "All outcomes",
  blocked: "Blocked",
  unauthorized: "Unauthorized",
  abstained: "Abstained",
  answered: "Answered",
};

/** Mutually exclusive; verified to partition all 105 cases exactly. */
function outcomeOf(c: EvalsCase): Exclude<OutcomeKey, "all"> {
  if (c.blocked === true) return "blocked";
  if (c.unauthorized === true) return "unauthorized";
  if (c.abstained === true) return "abstained";
  return "answered";
}

const controlCls =
  "rounded-lg border px-3 py-2 text-[13px] outline-none transition";
const controlStyle = { background: EV.card, borderColor: EV.border, color: EV.ink2 };

export default function EvaluationsPage() {
  const auth = useStoredAuth();
  const role = auth?.user.role ?? "";
  const canView = role === "admin" || role === "safety_officer";

  const [evals, setEvals] = useState<EvalsResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client-side view state over the already-fetched 105 cases.
  const [category, setCategory] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [outcome, setOutcome] = useState<OutcomeKey>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    try {
      const data = await getEvals();
      if (!signal?.cancelled) {
        setEvals(data);
        setNotFound(false);
        setError(null);
      }
    } catch (e: unknown) {
      if (signal?.cancelled) return;
      if (e instanceof ApiError && e.status === 404) {
        setNotFound(true);
        setError(null);
      } else {
        setNotFound(false);
        setError(
          e instanceof ApiError ? e.body.detail : "Failed to load evaluations"
        );
      }
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    const signal = { cancelled: false };
    queueMicrotask(() => void load(signal));
    return () => {
      signal.cancelled = true;
    };
  }, [canView, load]);

  const categories = useMemo(() => {
    if (!evals) return ["all"];
    return ["all", ...Array.from(new Set(evals.cases.map((c) => c.category))).sort()];
  }, [evals]);

  const roles = useMemo(() => {
    if (!evals) return ["all"];
    return ["all", ...Array.from(new Set(evals.cases.map((c) => c.role))).sort()];
  }, [evals]);

  const filtered = useMemo(() => {
    if (!evals) return [];
    const q = search.trim().toLowerCase();
    return evals.cases.filter((c) => {
      if (category !== "all" && c.category !== category) return false;
      if (roleFilter !== "all" && c.role !== roleFilter) return false;
      if (outcome !== "all" && outcomeOf(c) !== outcome) return false;
      if (q && !`${c.case_id} ${c.question} ${c.category} ${c.role}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [evals, category, roleFilter, outcome, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageCases = filtered.slice(start, start + PAGE_SIZE);

  // Any filter change returns the reader to the first page.
  const resetTo = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  const allGatesPassed =
    evals !== null &&
    evals.gates.recall_pass &&
    evals.gates.citation_pass &&
    evals.gates.unauthorized_pass;

  const failedGates = evals
    ? [
        !evals.gates.recall_pass ? "Recall@5" : null,
        !evals.gates.citation_pass ? "Citation validity" : null,
        !evals.gates.unauthorized_pass ? "Unauthorized retrieval" : null,
      ].filter((g): g is string => g !== null)
    : [];

  return (
    <AppShell title="Evaluations">
      {!canView ? (
        <p role="alert" className="text-destructive text-sm">
          Evaluations are restricted to admins and safety officers.
        </p>
      ) : error ? (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-slate-800 hover:bg-neutral-800"
          >
            Retry
          </button>
        </div>
      ) : notFound ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500">
          No evaluation run yet — run the eval suite and the latest results will
          appear here.
        </div>
      ) : evals === null ? (
        <div className="space-y-3" aria-busy="true">
          <div className="h-24 animate-pulse rounded-xl bg-slate-50" />
          <div className="h-40 animate-pulse rounded-xl bg-slate-50" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* ── Header ── */}
          <header>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: EV.muted }}>
              Evaluations
            </p>
            <h1 className="mt-1.5 text-[33px] font-bold leading-[1.12] tracking-[-0.02em]" style={{ color: EV.ink }}>
              Offline Evaluation Results
            </h1>
            <p className="mt-2 text-[15px]" style={{ color: EV.ink2 }}>
              Measure NIRVA&rsquo;s retrieval, reasoning, grounding and safety using a fixed
              evaluation dataset.
            </p>
          </header>

          {/* ── Run + gate status strip ── */}
          <section
            role="status"
            className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border px-4 py-3"
            style={{ background: EV.card, borderColor: EV.border }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full"
                style={{ background: allGatesPassed ? EV.goodBg : EV.badBg }}
                aria-hidden
              >
                {allGatesPassed ? (
                  <Check className="size-4" style={{ color: EV.good }} />
                ) : (
                  <span className="text-[13px] font-bold" style={{ color: EV.bad }}>!</span>
                )}
              </span>
              <div>
                <p
                  className="text-[14px] font-semibold"
                  style={{ color: allGatesPassed ? EV.good : EV.bad }}
                >
                  {allGatesPassed ? "All gates passed" : `Failed gates: ${failedGates.join(", ")}`}
                </p>
                <p className="mt-0.5 text-[12px]" style={{ color: EV.muted }}>
                  Thresholds — Recall@5 ≥ {evals.gates.recall_at_5_min}, citation validity ≥{" "}
                  {evals.gates.citation_validity_min}, unauthorized ≤{" "}
                  {evals.gates.unauthorized_max}
                </p>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-x-6 gap-y-2">
              {[
                { k: "Run",        v: new Date(evals.executed_at).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) },
                { k: "Time",       v: new Date(evals.executed_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) },
                { k: "Dataset",    v: evals.dataset_version, mono: true },
                { k: "Cases",      v: String(evals.summary.cases_executed) },
                { k: "Cite cases", v: String(evals.summary.cite_cases) },
              ].map((m) => (
                <div key={m.k}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: EV.muted }}>
                    {m.k}
                  </p>
                  <p
                    className={`mt-0.5 text-[14px] font-semibold ${m.mono ? "font-mono text-[13px]" : ""}`}
                    style={{ color: EV.ink }}
                  >
                    {m.v}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Three grouped metric sections (replaces six KPI cards) ── */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricGroup
              title="Retrieval Quality"
              blurb="Is the right evidence being retrieved?"
              metrics={[
                {
                  label: "Recall@5",
                  value: pct(evals.summary.recall_at_5),
                  target: `Target ≥ ${Math.round(evals.gates.recall_at_5_min * 100)}%`,
                  passed: evals.gates.recall_pass,
                },
                {
                  label: "Citation validity",
                  value: pct(evals.summary.citation_validity),
                  target: `Target = ${Math.round(evals.gates.citation_validity_min * 100)}%`,
                  passed: evals.gates.citation_pass,
                },
              ]}
            />
            <MetricGroup
              title="Answer Reliability"
              blurb="Are answers grounded and correct when evidence is missing?"
              metrics={[
                {
                  label: "Grounded answer rate",
                  value: pct(evals.summary.grounded_answer_rate),
                  target: "Target ≥ 85%",
                  passed: evals.summary.grounded_answer_rate >= 0.85,
                },
                {
                  label: "Correct abstention rate",
                  value: pct(evals.summary.correct_abstention_rate),
                  target: "Target ≥ 90%",
                  passed: evals.summary.correct_abstention_rate >= 0.9,
                },
              ]}
            />
            <MetricGroup
              title="Safety & Access"
              blurb="Does NIRVA respect access control and block malicious input?"
              metrics={[
                {
                  label: "Unauthorized retrievals",
                  value: String(evals.summary.unauthorized_retrieval_count),
                  target: `Target ≤ ${evals.gates.unauthorized_max}`,
                  passed: evals.gates.unauthorized_pass,
                },
                {
                  label: "Injection block rate",
                  value: pct(evals.summary.injection_block_rate),
                  target: "Target = 100%",
                  passed: evals.summary.injection_block_rate >= 1.0,
                },
              ]}
            />
          </div>

          {/* ── Per-case results ── */}
          <section
            className="overflow-hidden rounded-[10px] border"
            style={{ background: EV.card, borderColor: EV.border }}
          >
            <div
              className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-3"
              style={{ borderBottom: `1px solid ${EV.border}` }}
            >
              <div>
                <h2 className="text-[16px] font-semibold" style={{ color: EV.ink }}>
                  Per-case Results ({evals.cases.length})
                </h2>
                <p className="mt-0.5 text-[13px]" style={{ color: EV.muted }}>
                  Detailed results for each evaluation case in this run.
                </p>
              </div>
              {/* Filters — client-side only */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filter by category"
                  value={category}
                  onChange={(e) => resetTo(setCategory)(e.target.value)}
                  className={controlCls}
                  style={controlStyle}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>
                  ))}
                </select>
                <select
                  aria-label="Filter by role"
                  value={roleFilter}
                  onChange={(e) => resetTo(setRoleFilter)(e.target.value)}
                  className={controlCls}
                  style={controlStyle}
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>{r === "all" ? "All roles" : r}</option>
                  ))}
                </select>
                <select
                  aria-label="Filter by outcome"
                  value={outcome}
                  onChange={(e) => resetTo(setOutcome)(e.target.value as OutcomeKey)}
                  className={controlCls}
                  style={controlStyle}
                >
                  {(Object.keys(OUTCOME_LABEL) as OutcomeKey[]).map((o) => (
                    <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>
                  ))}
                </select>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2"
                    style={{ color: EV.muted }}
                    aria-hidden
                  />
                  <input
                    type="text"
                    placeholder="Search cases…"
                    aria-label="Search cases"
                    value={search}
                    onChange={(e) => resetTo(setSearch)(e.target.value)}
                    className={`${controlCls} w-56 pl-8`}
                    style={{ ...controlStyle, color: EV.ink }}
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr style={{ background: EV.head, borderBottom: `1px solid ${EV.border}` }}>
                    {[
                      "Case", "Category", "Role", "Question",
                      "Recall@5", "Citation", "Abstained", "Unauth.", "Blocked", "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className={`px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] ${
                          h === "Actions" ? "text-right" : ""
                        }`}
                        style={{ color: EV.muted }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageCases.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-[13px]" style={{ color: EV.ink2 }}>
                        No cases match the current filters.
                      </td>
                    </tr>
                  ) : (
                    pageCases.map((c) => (
                      <tr
                        key={c.case_id}
                        style={{ borderTop: `1px solid ${EV.border}` }}
                        className="transition"
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#F8FAFC"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = EV.card; }}
                      >
                        <td className="px-3 py-2.5 font-mono text-[12px] font-semibold" style={{ color: EV.ink }}>
                          {c.case_id}
                        </td>
                        <td className="px-3 py-2.5" style={{ color: EV.ink2 }}>{c.category}</td>
                        <td className="px-3 py-2.5" style={{ color: EV.ink2 }}>{c.role}</td>
                        <td className="max-w-md px-3 py-2.5" style={{ color: EV.ink }} title={c.question}>
                          <span className="line-clamp-1">{c.question}</span>
                        </td>
                        <td className="px-3 py-2.5 font-mono tabular-nums" style={{ color: EV.ink2 }}>
                          {c.recall_at_5 === null ? "—" : c.recall_at_5.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5 font-mono tabular-nums" style={{ color: EV.ink2 }}>
                          {c.citation_validity === null ? "—" : c.citation_validity.toFixed(2)}
                        </td>
                        <td className="px-3 py-2.5">
                          <StateDot value={c.abstained} pass={c.abstained} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StateDot value={c.unauthorized} pass={!c.unauthorized} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StateDot value={c.blocked} pass={c.blocked === true} />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <ChevronRight className="ml-auto size-4" style={{ color: EV.muted }} aria-hidden />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            <div
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              style={{ borderTop: `1px solid ${EV.border}`, background: EV.head }}
            >
              <p className="text-[13px]" style={{ color: EV.ink2 }}>
                {filtered.length === 0
                  ? "No cases"
                  : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length} cases`}
                {filtered.length !== evals.cases.length && ` (filtered from ${evals.cases.length})`}
              </p>

              {pageCount > 1 && (
                <nav className="flex items-center gap-1" aria-label="Pagination">
                  <PageBtn
                    label="Previous"
                    disabled={safePage === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ‹
                  </PageBtn>
                  {pageNumbers(safePage, pageCount).map((n, i) =>
                    n === "…" ? (
                      <span key={`gap-${i}`} className="px-1.5 text-[13px]" style={{ color: EV.muted }}>…</span>
                    ) : (
                      <button
                        key={n}
                        type="button"
                        aria-current={n === safePage ? "page" : undefined}
                        onClick={() => setPage(n)}
                        className="min-w-8 rounded-md border px-2 py-1 text-[13px] font-medium transition"
                        style={
                          n === safePage
                            ? { borderColor: "#C4F135", background: "#C4F135", color: "#1A1917" }
                            : { borderColor: EV.border, background: EV.card, color: EV.ink2 }
                        }
                      >
                        {n}
                      </button>
                    )
                  )}
                  <PageBtn
                    label="Next"
                    disabled={safePage === pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    ›
                  </PageBtn>
                </nav>
              )}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function PageBtn({
  children, label, disabled, onClick,
}: { children: React.ReactNode; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-md border text-[13px] transition disabled:opacity-40"
      style={{ borderColor: EV.border, background: EV.card, color: EV.ink2 }}
    >
      {children}
    </button>
  );
}

/** 1 2 3 4 5 … 11 style window. */
function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i += 1) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}
