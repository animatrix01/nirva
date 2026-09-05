"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useStoredAuth } from "@/lib/auth-client";
import { ApiError, getEvals } from "@/lib/api";
import type { EvalsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function MetricCard({
  label,
  value,
  gatePassed,
  isCount = false,
}: {
  label: string;
  value: string;
  gatePassed: boolean;
  isCount?: boolean;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-neutral-400">{label}</p>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium",
            gatePassed
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          )}
        >
          {gatePassed ? "gate passed" : "gate failed"}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">
        {isCount
          ? "retrievals past a user's clearance — target 0"
          : "measured across the golden eval set"}
      </p>
    </div>
  );
}

function CaseBadge({ value, pass }: { value: boolean | null; pass: boolean }) {
  if (value === null) {
    return <span className="text-xs text-neutral-600">—</span>;
  }
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium",
        pass
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-red-500/10 text-red-400"
      )}
    >
      {value ? "yes" : "no"}
    </span>
  );
}

export default function EvaluationsPage() {
  const auth = useStoredAuth();
  const role = auth?.user.role ?? "";
  const canView = role === "admin" || role === "safety_officer";

  const [evals, setEvals] = useState<EvalsResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            className="mt-2 rounded-md border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
          >
            Retry
          </button>
        </div>
      ) : notFound ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-5 py-6 text-sm text-neutral-500">
          No evaluation run yet — run the eval suite and the latest results will
          appear here.
        </div>
      ) : evals === null ? (
        <div className="space-y-3" aria-busy="true">
          <div className="h-24 animate-pulse rounded-xl bg-neutral-800/50" />
          <div className="h-40 animate-pulse rounded-xl bg-neutral-800/50" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div>
            <h1 className="text-xl font-semibold text-white">
              Offline evaluation results
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              {evals.summary.cases_executed} cases executed ·{" "}
              {evals.summary.cite_cases} cite cases · dataset{" "}
              <span className="font-mono text-neutral-300">
                {evals.dataset_version}
              </span>{" "}
              · run at{" "}
              <span className="font-mono text-neutral-300">
                {new Date(evals.executed_at).toLocaleString()}
              </span>
            </p>
          </div>

          {/* Gates banner */}
          <div
            role="status"
            className={cn(
              "rounded-xl border p-4",
              allGatesPassed
                ? "border-emerald-500/40 bg-emerald-500/[0.06]"
                : "border-red-500/40 bg-red-500/[0.06]"
            )}
          >
            <p
              className={cn(
                "text-sm font-semibold",
                allGatesPassed ? "text-emerald-400" : "text-red-400"
              )}
            >
              {allGatesPassed
                ? "All gates passed"
                : `Failed gates: ${failedGates.join(", ")}`}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              Thresholds — Recall@5 ≥ {evals.gates.recall_at_5_min}, citation
              validity ≥ {evals.gates.citation_validity_min}, unauthorized ≤{" "}
              {evals.gates.unauthorized_max}
            </p>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Recall@5"
              value={pct(evals.summary.recall_at_5)}
              gatePassed={evals.gates.recall_pass}
            />
            <MetricCard
              label="Citation validity"
              value={pct(evals.summary.citation_validity)}
              gatePassed={evals.gates.citation_pass}
            />
            <MetricCard
              label="Grounded answer rate"
              value={pct(evals.summary.grounded_answer_rate)}
              gatePassed={evals.summary.grounded_answer_rate >= 0.85}
            />
            <MetricCard
              label="Correct abstention rate"
              value={pct(evals.summary.correct_abstention_rate)}
              gatePassed={evals.summary.correct_abstention_rate >= 0.9}
            />
            <MetricCard
              label="Unauthorized retrievals"
              value={String(evals.summary.unauthorized_retrieval_count)}
              gatePassed={evals.gates.unauthorized_pass}
              isCount
            />
            <MetricCard
              label="Injection block rate"
              value={pct(evals.summary.injection_block_rate)}
              gatePassed={evals.summary.injection_block_rate >= 1.0}
            />
          </div>

          {/* Per-case table */}
          <section>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
              Per-case results ({evals.cases.length})
            </p>
            <div className="max-h-[28rem] overflow-auto rounded-xl border border-neutral-800">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-neutral-900 text-neutral-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Case</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Question</th>
                    <th className="px-3 py-2 font-medium">Recall@5</th>
                    <th className="px-3 py-2 font-medium">Citation</th>
                    <th className="px-3 py-2 font-medium">Abstained</th>
                    <th className="px-3 py-2 font-medium">Unauth.</th>
                    <th className="px-3 py-2 font-medium">Blocked</th>
                  </tr>
                </thead>
                <tbody>
                  {evals.cases.map((c) => (
                    <tr key={c.case_id} className="border-t border-neutral-800/70">
                      <td className="px-3 py-2 font-mono text-neutral-300">
                        {c.case_id}
                      </td>
                      <td className="px-3 py-2 text-neutral-400">{c.category}</td>
                      <td className="px-3 py-2 text-neutral-400">{c.role}</td>
                      <td className="max-w-64 truncate px-3 py-2 text-neutral-300">
                        {c.question}
                      </td>
                      <td className="px-3 py-2 font-mono text-neutral-300">
                        {c.recall_at_5 === null ? "—" : c.recall_at_5.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 font-mono text-neutral-300">
                        {c.citation_validity === null
                          ? "—"
                          : c.citation_validity.toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <CaseBadge value={c.abstained} pass={c.abstained} />
                      </td>
                      <td className="px-3 py-2">
                        <CaseBadge value={c.unauthorized} pass={!c.unauthorized} />
                      </td>
                      <td className="px-3 py-2">
                        <CaseBadge value={c.blocked} pass={c.blocked === true} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
