"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, Search, Shield } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useStoredAuth } from "@/lib/auth-client";
import { ApiError, getAudit } from "@/lib/api";
import type { AuditEvent, AuditResponse } from "@/lib/types";

// ─── Audit ledger design tokens ───────────────────────────────────────────────
// Claude-black surfaces, file-scoped so no global theme shifts. See the class
// on the page root for the canvas colour.
const AT = {
  page:  "#1C1B18",
  card:  "#201F1C",
  border:"#2E2D29",
  ink:   "#E8E5DD",
  ink2:  "#7A7668",
  lime:  "#c8f135",
  hair:  "var(--audit-row-hair)",
} as const;

// ─── Semantic event vocabulary ────────────────────────────────────────────────
// Actions are classified by PREFIX, not by an invented event list, so the
// ledger renders correctly for whatever the API actually returns. The real
// corpus is: job.created, job.completed, retrieval.*, tool.*. The approval /
// auth / denied / contradiction / gap rules are fallbacks for richer runs and
// are deliberately NOT seeded here.

type Tone = "neutral" | "blue" | "amber" | "red" | "green";

const TONE: Record<Tone, { label: string; text: string; marker: string; dot: string }> = {
  neutral: { label: "ok",   text: "#A8A29E", marker: "#9CA3AF", dot: "#34D399" },
  blue:    { label: "ok",   text: "#93C5FD", marker: "#60A5FA", dot: "#34D399" },
  green:   { label: "ok",   text: "#6EE7B7", marker: "#34D399", dot: "#34D399" },
  amber:   { label: "warn", text: "#FCD34D", marker: "#FBBF24", dot: "#FBBF24" },
  red:     { label: "bad",  text: "#FCA5A5", marker: "#F87171", dot: "#F87171" },
};

/** Exact actions, checked first. */
const ACTION_EXACT: Record<string, { label: string; tone: Tone }> = {
  "job.created":   { label: "INVESTIGATION CREATED",   tone: "neutral" },
  "job.completed": { label: "INVESTIGATION COMPLETED", tone: "green"   },
};

/** Prefix/substring rules, checked in order. */
const ACTION_RULES: Array<{ test: (a: string) => boolean; label: string; tone: Tone }> = [
  { test: (a) => a.startsWith("approval."),                                  label: "APPROVAL ACTION",        tone: "green"   },
  { test: (a) => a.startsWith("auth."),                                      label: "ACCESS EVENT",          tone: "red"     },
  { test: (a) => a.includes("denied") || a.includes("forbidden") || a.includes("policy"), label: "ACCESS DENIED", tone: "red"     },
  { test: (a) => a.includes("injection"),                                    label: "INJECTION BLOCKED",      tone: "red"     },
  { test: (a) => a.includes("contradiction"),                                label: "CONTRADICTION FOUND",    tone: "amber"   },
  { test: (a) => a.includes("gap"),                                          label: "GAP IDENTIFIED",         tone: "amber"   },
  { test: (a) => a.includes("review"),                                      label: "REVIEW REQUIRED",        tone: "amber"   },
  { test: (a) => a.startsWith("retrieval."),                                label: "EVIDENCE RETRIEVED",     tone: "blue"    },
  { test: (a) => a.startsWith("tool."),                                      label: "TOOL INVOKED",           tone: "blue"    },
];

/** Human label + semantic tone for an action string. Never throws. */
export function classifyAction(action: string): { label: string; tone: Tone } {
  const exact = ACTION_EXACT[action];
  if (exact) return exact;
  for (const rule of ACTION_RULES) {
    if (rule.test(action)) return { label: rule.label, tone: rule.tone };
  }
  // Unknown action — show it as-is rather than hide the row.
  return { label: action.replace(/[._]/g, " ").toUpperCase(), tone: "neutral" };
}

/** Ledger category. Order is stable; All is implicit. */
export type Category = "all" | "investigations" | "evidence" | "decisions" | "access";

const CATEGORY_RULES: Array<{ id: Exclude<Category, "all">; test: (a: string) => boolean }> = [
  { id: "investigations", test: (a) => a.startsWith("job.") },
  { id: "evidence",       test: (a) => a.startsWith("retrieval.") || a.startsWith("tool.") },
  { id: "decisions",      test: (a) => a.startsWith("approval.") },
  { id: "access",         test: (a) => a.startsWith("auth.") || a.includes("denied") || a.includes("injection") || a.includes("login") },
];

const inCategory = (action: string, cat: Category): boolean => {
  if (cat === "all") return true;
  const rule = CATEGORY_RULES.find((c) => c.id === cat);
  return rule ? rule.test(action) : true;
};

type OutcomeFilter = "all" | "ok" | "blocked" | "error";

/**
 * Single source of truth for the ledger's column template. The header row and
 * every event row MUST use this, otherwise the labels stop lining up with
 * their data and fall into implicit single-column stacking.
 */
const LEDGER_COLS =
  "110px minmax(0,1fr) 150px 150px 130px 120px 32px";

/** Key/value line used inside the expanded audit detail panel. */
function DetailRow({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <p className="flex flex-wrap gap-x-2">
      <span className="shrink-0 font-semibold" style={{ color: AT.ink2 }}>{k}:</span>
      <span
        className={`min-w-0 break-all ${mono ? "font-mono text-[11px]" : ""}`}
        style={{ color: AT.ink }}
      >
        {v}
      </span>
    </p>
  );
}

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
  const [category, setCategory] = useState<Category>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
      if (!inCategory(e.action, category)) return false;
      if (cutoff !== null && !isNaN(cutoff) && new Date(e.ts).getTime() < cutoff)
        return false;
      if (
        q &&
        !`${e.action} ${e.actor} ${e.argument_summary}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [audit, actionFilter, actorFilter, outcomeFilter, fromDate, search, category]);

  // Per-category counts are computed over the same base list as the other
  // filters so the numbers on the chips are never misleading.
  const categoryCounts = useMemo(() => {
    const events = audit?.events ?? [];
    const counts: Record<Category, number> = {
      all: events.length,
      investigations: 0,
      evidence: 0,
      decisions: 0,
      access: 0,
    };
    for (const e of events) {
      if (inCategory(e.action, "investigations")) counts.investigations += 1;
      else if (inCategory(e.action, "evidence")) counts.evidence += 1;
      else if (inCategory(e.action, "decisions")) counts.decisions += 1;
      else if (inCategory(e.action, "access")) counts.access += 1;
    }
    return counts;
  }, [audit]);

  const stats = useMemo(() => {
    const events = audit?.events ?? [];
    return {
      total: events.length.toLocaleString(),
      blocked: events.filter((e) => e.outcome === "blocked").length,
      approvals: events.filter((e) => e.action.startsWith("approval.")).length,
    };
  }, [audit]);

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectClass =
    "rounded-md border bg-neutral-900 px-3 py-2 text-[13px] outline-none transition";

  const controlStyle = { background: AT.card, borderColor: AT.border, color: AT.ink2 };

  /** Two-line timestamp: date line + time line, per the reference ledger. */
  function Stamp({ ts }: { ts: string }) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return <span style={{ color: AT.ink2 }}>—</span>;
    return (
      <span className="whitespace-nowrap">
        <span className="block text-[12px] font-medium" style={{ color: AT.ink }}>
          {d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
        </span>
        <span className="block text-[11px]" style={{ color: AT.ink2 }}>
          {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </span>
      </span>
    );
  }

  const OutcomeCell = ({ outcome }: { outcome: AuditEvent["outcome"] }) => {
    const tone: Tone = outcome === "ok" ? "green" : outcome === "error" ? "red" : "amber";
    const label = outcome === "ok" ? "Success" : outcome === "error" ? "Denied" : "Blocked";
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]" style={{ color: TONE[tone].text }}>
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: TONE[tone].dot }} />
        {label}
      </span>
    );
  };

  return (
    <AppShell title="">
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
          <div
            className="flex flex-col"
            style={{ background: AT.page, margin: "-1rem -1.5rem", padding: "1.5rem" }}
          >
            {/* 1. Page header */}
            <h1
              className="text-[32px] font-bold leading-[1.12] tracking-[-0.02em]"
              style={{ color: AT.ink }}
            >
              Audit Trail
            </h1>
            <p className="mt-1.5 text-[15px]" style={{ color: AT.ink2 }}>
              Append-only record of investigations, evidence access, system actions and decisions.
            </p>

            {/* 2. Integrity strip — one horizontal band, not KPI cards */}
            <div
              className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg border px-5 py-3.5"
              style={{ background: AT.card, borderColor: AT.border }}
            >
              <div className="flex items-center gap-2.5">
                <Shield
                  className="size-4"
                  style={{ color: audit.chain_valid ? "#15803D" : "#B91C1C" }}
                  aria-hidden
                />
                <div>
                  <p
                    className="text-[13px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: audit.chain_valid ? "#15803D" : "#B91C1C" }}
                  >
                    {audit.chain_valid ? "Hash chain valid" : "Hash chain broken"}
                  </p>
                  <p className="text-[11px]" style={{ color: AT.ink2 }}>
                    Append-only · Tamper-evident
                  </p>
                </div>
              </div>

              {[
                { v: stats.total,     k: "Total events" },
                { v: stats.blocked,   k: "Blocked events" },
                { v: stats.approvals, k: "Approval decisions" },
              ].map((s) => (
                <div key={s.k}>
                  <p className="text-[17px] font-semibold tabular-nums" style={{ color: AT.ink }}>{s.v}</p>
                  <p className="text-[11px]" style={{ color: AT.ink2 }}>{s.k}</p>
                </div>
              ))}

              <div className="ml-auto text-right">
                <p className="text-[11px]" style={{ color: AT.ink2 }}>Last verified</p>
                <p className="text-[12px] font-medium" style={{ color: AT.ink }}>{verifiedAt ?? "…"}</p>
              </div>
            </div>

            {/* 3. Category bar — all five always visible, zero counts muted */}
            <div className="mt-5 flex flex-wrap gap-1.5" role="tablist" aria-label="Audit categories">
              {([
                { id: "all",            label: "All events" },
                { id: "investigations", label: "Investigations" },
                { id: "evidence",       label: "Evidence" },
                { id: "decisions",      label: "Decisions" },
                { id: "access",         label: "Access & security" },
              ] as const).map((c) => {
                const active = category === c.id;
                const n = categoryCounts[c.id];
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCategory(c.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-medium transition"
                    style={{
                      background: active ? "#e2e8f0" : AT.card,
                      borderColor: active ? "#94a3b8" : AT.border,
                      color: active ? AT.ink : n === 0 ? "#A8A29E" : AT.ink2,
                    }}
                  >
                    {c.label}
                    <span
                      className="tabular-nums"
                      style={{ color: active ? AT.ink2 : n === 0 ? "#C7C5BE" : AT.ink2 }}
                    >
                      {n}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 4. Filters — actor / outcome / date / search all preserved */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by event"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className={selectClass}
                style={controlStyle}
              >
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {a === "all" ? "All event types" : a}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by actor"
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                className={selectClass}
                style={controlStyle}
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
                style={controlStyle}
              >
                <option value="all">All outcomes</option>
                <option value="ok">ok</option>
                <option value="blocked">blocked</option>
                <option value="error">error</option>
              </select>
              <div className="relative">
                <Calendar
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2"
                  style={{ color: AT.ink2 }}
                  aria-hidden
                />
                <input
                  type="date"
                  aria-label="From date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rounded-md border py-2 pl-8 pr-3 text-[13px] outline-none transition"
                  style={controlStyle}
                />
              </div>

              <div className="relative ml-auto">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2"
                  style={{ color: AT.ink2 }}
                  aria-hidden
                />
                <input
                  type="text"
                  placeholder="Search audit log…"
                  aria-label="Search audit log"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64 rounded-md border py-2 pl-8 pr-3 text-[13px] outline-none transition placeholder:text-[#A8A29E]"
                  style={{ ...controlStyle, color: AT.ink }}
                />
              </div>
            </div>

            {/* 5. Ledger */}
            <div
              className="mt-4 overflow-hidden rounded-lg border"
              style={{ background: AT.card, borderColor: AT.border }}
            >
              <div
                className="grid items-center gap-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em]"
                style={{
                  gridTemplateColumns: LEDGER_COLS,
                  background: "#FBFBF9",
                  borderBottom: `1px solid ${AT.border}`,
                  color: AT.ink2,
                }}
              >
                {/* Offset clears the 3px semantic marker in the rows below. */}
                <span className="pl-[22px]">Timestamp</span>
                <span>Event</span>
                <span>Actor</span>
                <span>Reference</span>
                <span>Outcome</span>
                <span>Hash</span>
                <span className="text-right">Details</span>
              </div>

              {filtered.length === 0 ? (
                <p className="px-4 py-10 text-center text-[13px]" style={{ color: AT.ink2 }}>
                  No audit events match the current filters.
                </p>
              ) : (
                filtered.map((e) => {
                  const { label, tone } = classifyAction(e.action);
                  const open = expanded.has(e.event_id);
                  return (
                    <div
                      key={e.event_id}
                      style={{ borderBottom: `1px solid ${AT.border}` }}
                    >
                      <div
                        role={e.job_id ? "button" : undefined}
                        tabIndex={e.job_id ? 0 : undefined}
                        onClick={() => {
                          // Whole-row navigation is preserved exactly as before.
                          if (e.job_id) router.push(`/investigations/${e.job_id}`);
                        }}
                        onKeyDown={(ev) => {
                          if (e.job_id && (ev.key === "Enter" || ev.key === " ")) {
                            ev.preventDefault();
                            router.push(`/investigations/${e.job_id}`);
                          }
                        }}
                        className="grid w-full items-center gap-3 px-4 py-3 transition"
                        style={{
                          gridTemplateColumns: LEDGER_COLS,
                          background: open ? "#FBFBF9" : AT.card,
                          cursor: e.job_id ? "pointer" : "default",
                        }}
                      >
                        {/* 2–3px semantic marker + timestamp */}
                        <span className="flex items-center gap-2.5">
                          <span
                            className="h-8 w-[3px] shrink-0 rounded-full"
                            style={{ background: TONE[tone].marker }}
                            aria-hidden
                          />
                          <Stamp ts={e.ts} />
                        </span>

                        {/* Event label + details */}
                        <span className="min-w-0">
                          <span
                            className="block text-[12px] font-bold uppercase tracking-[0.08em]"
                            style={{ color: tone === "neutral" ? AT.ink : TONE[tone].text }}
                          >
                            {label}
                          </span>
                          <span
                            className="mt-0.5 block truncate text-[13px]"
                            style={{ color: AT.ink2 }}
                            title={e.argument_summary}
                          >
                            {e.argument_summary}
                          </span>
                        </span>

                        {/* Actor + role */}
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium" style={{ color: AT.ink }}>
                            {e.actor}
                          </span>
                          <span className="block text-[11px]" style={{ color: AT.ink2 }}>{e.actor_role}</span>
                        </span>

                        {/* Reference */}
                        <span
                          className="truncate font-mono text-[12px]"
                          style={{ color: AT.ink2 }}
                          title={e.job_id}
                        >
                          {e.job_id ? `${e.job_id.slice(0, 8)}…` : "—"}
                        </span>

                        <OutcomeCell outcome={e.outcome} />

                        {/* Hash — visually secondary */}
                        <span className="truncate font-mono text-[12px]" style={{ color: AT.ink2 }} title={e.hash}>
                          {e.hash.slice(0, 10)}…
                        </span>

                        {/* Expand control — stopPropagation so it never navigates */}
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-label={open ? "Hide full audit details" : "Show full audit details"}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            toggleRow(e.event_id);
                          }}
                          className="flex size-7 items-center justify-center rounded-md transition"
                          style={{ color: AT.ink2 }}
                        >
                          <ChevronRight
                            className="size-4 transition-transform"
                            style={{ transform: open ? "rotate(90deg)" : "none" }}
                            aria-hidden
                          />
                        </button>
                      </div>

                      {open && (
                        <div
                          className="grid gap-x-3 gap-y-2 px-4 pb-4 pt-1 text-[12px]"
                          style={{
                            gridTemplateColumns: "110px minmax(0,1fr)",
                            background: "#FBFBF9",
                          }}
                        >
                          <span />
                          <div className="flex flex-col gap-1.5">
                            {/* Raw action always available per the spec */}
                            <DetailRow k="Action" v={e.action} mono />
                            <DetailRow k="Event ID" v={e.event_id} mono />
                            <DetailRow k="Outcome" v={e.outcome} />
                            <DetailRow k="Actor" v={`${e.actor} (${e.actor_role})`} />
                            <DetailRow k="Arguments" v={e.argument_summary} />
                            <DetailRow k="Previous hash" v={e.prev_hash} mono />
                            <DetailRow k="Hash" v={e.hash} mono />
                            {e.job_id && (
                              <p className="pt-1">
                                <Link
                                  href={`/investigations/${e.job_id}`}
                                  onClick={(ev) => ev.stopPropagation()}
                                  className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
                                  style={{ color: AT.ink }}
                                >
                                  Open investigation {e.job_id.slice(0, 8)}…
                                  <ChevronRight className="size-3" aria-hidden />
                                </Link>
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
    </AppShell>
  );
}
