"use client";

/**
 * EvidencePanel — investigation evidence workspace (right column).
 *
 * Layout:
 *   EVIDENCE header (count + hybrid-retrieval note folded in)
 *   ──────────────────────────────────────────────────
 *   For each citation (always-expanded record):
 *     NN  Document title (truncated)            score%
 *     type · revision · page/section
 *     ┌─ Relevant passage excerpt ─┐
 *     Score bar + View source
 *
 * Clicking a record's "View source" opens the CitationLink modal for full
 * evidence inspection without cluttering the panel view.
 *
 * Technical provenance details (chunk_id, hash) are not shown inline —
 * they appear in the CitationLink inspection modal on demand.
 */

import { useState, useEffect } from "react";
import { ApiError, getEvidence } from "@/lib/api";
import { CitationLink } from "@/components/investigation/CitationLink";
import type { CitationRef } from "@/lib/types";
import type { EvidenceReference } from "@/lib/artifacts";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isToolSource(c: CitationRef): boolean {
  return c.chunk_id.startsWith("tool-");
}

function docTypeLabel(t: string | undefined): string {
  if (!t) return "Document";
  const map: Record<string, string> = {
    sop: "SOP",
    manual: "Manual",
    work_order: "Work Order",
    incident: "Incident",
    data: "Data",
  };
  return map[t] ?? t.replace(/_/g, " ");
}

function sectionLeaf(section: string | null | undefined): string | null {
  if (!section || section.startsWith("Dev mode")) return null;
  return section.split(" > ").pop()?.trim() ?? null;
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const barColor =
    pct >= 85 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} aria-hidden />
      </div>
      <span className="text-sm font-bold tabular-nums text-slate-900">{pct}%</span>
    </div>
  );
}

// ─── Single source record (always expanded) ───────────────────────────────────

function SourceRecord({
  citation,
  index,
  jobId,
}: {
  citation: CitationRef;
  index: number;
  jobId: string;
}) {
  const [detail, setDetail] = useState<EvidenceReference | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const signal = { cancelled: false };
    queueMicrotask(() => {
      if (signal.cancelled) return;
      setLoading(true);
      setDetail(null);
      setError(null);
      void getEvidence(jobId, citation.chunk_id)
      .then((e) => {
        if (!signal.cancelled) {
          setDetail(e);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!signal.cancelled) {
          setError(
            e instanceof ApiError ? e.body.detail : "Failed to load source"
          );
          setLoading(false);
        }
      });
    });
    return () => {
      signal.cancelled = true;
    };
  }, [jobId, citation.chunk_id]);

  const isTool = isToolSource(citation);
  const leaf = sectionLeaf(detail?.section);

  // Build compact location string
  const locationParts: string[] = [];
  if (citation.revision) locationParts.push(citation.revision);
  if (citation.locator) locationParts.push(citation.locator);
  if (leaf && !locationParts.join(" ").includes(leaf))
    locationParts.push(`§ ${leaf}`);

  const miniScore =
    detail && !isTool && typeof detail.score === "number" && detail.score > 0
      ? `${Math.round(detail.score * 100)}%`
      : null;

  return (
    <article className="border-b border-slate-200 last:border-0 py-4 first:pt-0">
      {/* ── Always-visible header row ── */}
      <div className="flex w-full items-start gap-3 text-left">
        <span className="flex size-7 shrink-0 items-center justify-center rounded bg-[#B9FF52] text-sm font-bold text-black tabular-nums select-none">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-bold leading-snug text-slate-900" title={citation.title}>
            {citation.title}
          </span>
          <span className="block truncate text-xs font-medium text-slate-500 mt-0.5">
            {[
              detail?.document_type ? docTypeLabel(detail.document_type) : null,
              locationParts.join(" · ") || null,
              isTool ? "Tool" : "Retrieval",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
      </div>

      {/* ── Detail (always rendered) ── */}
      <div className="mt-3 pl-10">
          {/* Equipment ID */}
          {detail?.equipment_id && (
            <p className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
              Equipment · {detail.equipment_id}
            </p>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="h-12 animate-pulse rounded bg-slate-100" aria-busy="true" />
          )}

          {/* Error */}
          {error && (
            <p role="alert" className="text-xs text-red-500">{error}</p>
          )}

          {/* ── Source passage excerpt ── */}
          {detail && (
            <div
              className={cn(
                "rounded border-l-2 px-3 py-3 mb-3",
                isTool
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-400 bg-slate-50"
              )}
            >
              <p className="text-sm leading-relaxed text-slate-800 line-clamp-4">
                {detail.passage_text}
              </p>
            </div>
          )}

          {/* ── Retrieval score + view source link ── */}
          <div className="flex items-center justify-between gap-3">
            {detail && !isTool && typeof detail.score === "number" && detail.score > 0 ? (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Retrieval score
                </span>
                <ScoreBar score={detail.score} />
              </div>
            ) : detail && isTool ? (
              <span className="text-xs font-semibold text-blue-600">
                Read-only operational tool
              </span>
            ) : (
              <div />
            )}

            {/* CitationLink opens full inspection modal */}
            <CitationLink
              citation={citation}
              jobId={jobId}
              index={index}
              compact
            />
          </div>
        </div>
    </article>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 px-5 py-6">
      <p className="text-sm font-medium text-slate-600">No evidence sources cited.</p>
      <p className="mt-1 text-sm text-slate-500 leading-relaxed">
        Citations appear once the investigation retrieves and grounds its findings.
      </p>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function EvidencePanel({
  jobId,
  citations,
}: {
  jobId: string;
  citations: CitationRef[];
}) {
  const retrievalCitations = citations.filter((c) => !isToolSource(c));
  const toolCitations = citations.filter((c) => isToolSource(c));

  return (
    <div className="flex flex-col">

      {/* ── HEADER (method folded in — no separate tag box) ── */}
      <div className="mb-4 flex items-baseline justify-between">
        <p className="text-sm font-bold uppercase tracking-wide text-slate-900">
          Evidence
          {citations.length > 0 &&
            ` · ${citations.length} source${citations.length !== 1 ? "s" : ""}`}
          <span className="ml-2 font-medium normal-case tracking-normal text-slate-500">
            hybrid retrieval
          </span>
        </p>
      </div>

      {citations.length === 0 && <EmptyState />}

      {/* ── DOCUMENT SOURCES (first open, rest collapsed) ── */}
      {retrievalCitations.length > 0 && (
        <section className="mb-2">
          {toolCitations.length > 0 && (
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">
              Document sources
            </p>
          )}
          <div>
            {retrievalCitations.map((c, i) => (
              <SourceRecord
                key={c.chunk_id}
                citation={c}
                index={i}
                jobId={jobId}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── TOOL RESULTS (collapsed) ── */}
      {toolCitations.length > 0 && (
        <section className="mt-2">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-900">
            Tool results
          </p>
          <div>
            {toolCitations.map((c, i) => (
              <SourceRecord
                key={c.chunk_id}
                citation={c}
                index={retrievalCitations.length + i}
                jobId={jobId}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}