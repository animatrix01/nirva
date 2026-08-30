"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, Search, Shield } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { useStoredAuth } from "@/lib/auth-client";
import { ApiError, getAudit } from "@/lib/api";
import type { AuditResponse } from "@/lib/types";

const OUTCOME_BADGES: Record<string, string> = {
  ok: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  error: "bg-red-500/10 text-red-400 border border-red-500/20",
  blocked: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
};

type OutcomeFilter = "all" | "ok" | "blocked" | "error";

export default function AuditPage() {
  const auth = useStoredAuth();
  const role = auth?.user.role ?? "";
  const canView = role === "admin" || role === "safety_officer";
  const router = useRouter();

  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);

  const [actionFilter, setActionFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!canView) return;
    const signal = { cancelled: false };
    queueMicrotask(() => {
      void getAudit({ limit: 500 })
        .then((data) => {
          if (!signal.cancelled) {
            setAudit(data);
            setVerifiedAt(new Date().toLocaleString());
          }
        })
        .catch((e: unknown) => {
          if (!signal.cancelled) {
            setError(
              e instanceof ApiError ? e.body.detail : "Failed to load audit log"
            );
          }
        });
    });
    return () => {
      signal.cancelled = true;
    };
  }, [canView]);

  const actors = useMemo(() => {
    if (!audit) return ["all"];
    const set = new Set(audit.events.map((e) => e.actor));
    return ["all", ...Array.from(set).sort()];
  }, [audit]);

  const actions = useMemo(() => {
    if (!audit) return ["all"];
    const set = new Set(audit.events.map((e) => e.action));
    return ["all", ...Array.from(set).sort()];
  }, [audit]);

  const filtered = useMemo(() => {
    if (!audit) return [];
    const q = search.trim().toLowerCase();
    const cutoff = fromDate ? new Date(fromDate).getTime() : null;
    return audit.events.filter((e) => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (actorFilter !== "all" && e.actor !== actorFilter) return false;
      if (outcomeFilter !== "all" && e.outcome !== outcomeFilter) return false;
      if (cutoff !== null && !isNaN(cutoff) && new Date(e.ts).getTime() < cutoff)
        return false;
      if (
        q &&
        !`${e.action} ${e.actor} ${e.argument_summary}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [audit, actionFilter, actorFilter, outcomeFilter, fromDate, search]);

  const stats = useMemo(() => {
    const events = audit?.events ?? [];
    return {
      total: events.length.toLocaleString(),
      blocked: events.filter((e) => e.outcome === "blocked").length,
      approvals: events.filter((e) => e.action.startsWith("approval.")).length,
    };
  }, [audit]);

  const selectClass =
    "rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 outline-none transition focus:border-neutral-600";

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="Audit log" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {!canView ? (
          <p role="alert" className="text-destructive text-sm">
            Audit access is restricted to admins and safety officers.
          </p>
        ) : error ? (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        ) : !audit ? (
          <div className="h-64 animate-pulse rounded-md bg-muted/50" aria-busy="true" />
        ) : (
          <div className="flex flex-col">
            {/* 1. Page header */}
            <h1 className="text-xl font-semibold uppercase tracking-widest text-white">
              Audit log
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              System activity and security events
            </p>

            {/* Security banner */}
            <div className="mt-5 flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex items-center gap-2.5">
                <Shield
                  className={`size-4 ${
                    audit.chain_valid ? "text-emerald-400" : "text-red-400"
                  }`}
                />
                <span className="text-sm font-medium text-white">Hash chain</span>
                <span
                  className={
                    audit.chain_valid
                      ? "text-sm font-medium text-emerald-400"
                      : "text-sm font-medium text-red-400"
                  }
                >
                  {audit.chain_valid ? "valid" : "BROKEN"}
                </span>
                <span className="text-sm text-neutral-400">— tamper-evident</span>
              </div>
              <span className="font-mono text-sm text-neutral-500">
                Last verified: {verifiedAt ?? "…"}
              </span>
            </div>

            {/* 2. Summary stats */}
            <div className="mt-4 grid grid-cols-3 rounded-md border border-neutral-800">
              <div className="p-6">
                <p className="text-3xl font-semibold text-white">{stats.total}</p>
                <p className="mt-1 text-sm text-neutral-400">Total events</p>
              </div>
              <div className="border-l border-neutral-800 p-6">
                <p className="text-3xl font-semibold text-white">{stats.blocked}</p>
                <p className="mt-1 text-sm text-neutral-400">Blocked events</p>
              </div>
              <div className="border-l border-neutral-800 p-6">
                <p className="text-3xl font-semibold text-white">{stats.approvals}</p>
                <p className="mt-1 text-sm text-neutral-400">Approval decisions</p>
              </div>
            </div>

            {/* 3. Filters */}
            <div className="mt-10">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-white">
                Audit events
              </h2>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Filter by event"
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className={selectClass}
                  >
                    {actions.map((a) => (
                      <option key={a} value={a}>
                        {a === "all" ? "All events" : a}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by actor"
                    value={actorFilter}
                    onChange={(e) => setActorFilter(e.target.value)}
                    className={selectClass}
                  >
                    {actors.map((a) => (
                      <option key={a} value={a}>
                        {a === "all" ? "All actors" : a}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by outcome"
                    value={outcomeFilter}
                    onChange={(e) => setOutcomeFilter(e.target.value as OutcomeFilter)}
                    className={selectClass}
                  >
                    <option value="all">All outcomes</option>
                    <option value="ok">ok</option>
                    <option value="blocked">blocked</option>
                    <option value="error">error</option>
                  </select>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="date"
                      aria-label="From date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="rounded-md border border-neutral-800 bg-neutral-900 py-2 pl-9 pr-3 text-sm text-neutral-300 outline-none transition focus:border-neutral-600"
                    />
                  </div>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search audit log..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-64 rounded-md border border-neutral-800 bg-neutral-900 py-2 pl-9 pr-3 text-sm text-neutral-200 outline-none transition placeholder:text-neutral-500 focus:border-neutral-600"
                  />
                </div>
              </div>
            </div>

            {/* 4. Data table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-800">
                    {["Time", "Actor", "Action", "Summary (redacted)", "Outcome", "Hash", ""].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-4 font-sans text-sm font-normal text-neutral-400"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-6 text-sm text-neutral-500"
                      >
                        No audit events match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((e) => (
                      <tr
                        key={e.event_id}
                        className={`border-b border-neutral-800 transition-colors hover:bg-neutral-900/60 ${
                          e.job_id ? "cursor-pointer" : ""
                        }`}
                        onClick={() => {
                          if (e.job_id) router.push(`/investigations/${e.job_id}`);
                        }}
                      >
                        <td className="px-4 py-4 font-sans text-sm text-neutral-300 whitespace-nowrap">
                          {new Date(e.ts).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 font-sans text-sm text-neutral-200">
                          {e.actor}
                        </td>
                        <td className="px-4 py-4 font-sans text-sm text-neutral-200">
                          {e.action}
                        </td>
                        <td className="max-w-72 truncate px-4 py-4 font-sans text-sm font-normal text-neutral-400">
                          {e.argument_summary}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-medium ${
                              OUTCOME_BADGES[e.outcome] ??
                              "bg-neutral-500/10 text-neutral-400 border border-neutral-500/20"
                            }`}
                          >
                            {e.outcome}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-mono text-sm text-neutral-300">
                          {e.hash.slice(0, 12)}…
                        </td>
                        <td className="px-4 py-4 text-right">
                          <ChevronRight className="ml-auto size-4 text-neutral-600" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
