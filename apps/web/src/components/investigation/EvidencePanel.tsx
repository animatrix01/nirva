"use client";

/**
 * EvidencePanel — investigation evidence workspace (right column).
 *
 * Layout:
 *   EVIDENCE header + source count + hybrid retrieval tag
 *   ──────────────────────────────────────────────────
 *   For each citation (compact source record):
 *     NN  DOC TYPE                  [source method]
 *     Document title
 *     Revision · Page N · §Section
 *     ┌─ Relevant passage excerpt ─┐
 *     Score bar if available
 *   ──────────────────────────────────────────────────
 *   SOURCE TRACE (compact index at bottom)
 *     01  Title .................. Page N
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
    pct >= 80 ? "bg-emerald-600" : pct >= 60 ? "bg-stone-400" : "bg-stone-600";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-stone-800">
        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} aria-hidden />
      </div>
      <span className="text-[11px] tabular-nums text-stone-400">{pct}%</span>
    </div>
  );
}

// ─── Single source record ─────────────────────────────────────────────────────

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

  return (
    <article className="border-b border-stone-800 last:border-0 py-4 first:pt-0">
      {/* ── Top row: index + type + method ── */}
      <div className="flex items-center gap-2 mb-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded bg-stone-800 text-[10px] font-bold text-stone-400 tabular-nums select-none">
          {String(index + 1).padStart(2, "0")}
        </span>
        {detail?.document_type && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
            {docTypeLabel(detail.document_type)}
          </span>
        )}
        <span
          className={cn(
            "ml-auto text-[10px] font-semibold uppercase tracking-widest",
            isTool ? "text-blue-500" : "text-stone-600"
          )}
        >
          {isTool ? "Tool" : "Retrieval"}
        </span>
      </div>

      {/* ── Document title ── */}
      <p className="text-[13px] font-semibold leading-snug text-stone-100 mb-0.5">
        {citation.title}
      </p>

      {/* ── Location line ── */}
      {locationParts.length > 0 && (
        <p className="text-[11px] text-stone-500 mb-2">
          {locationParts.join(" · ")}
        </p>
      )}

      {/* Equipment ID */}
      {detail?.equipment_id && (
        <p className="text-[11px] font-medium text-stone-400 mb-2">
          Equipment · {detail.equipment_id}
        </p>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="h-12 animate-pulse rounded bg-stone-800/40" aria-busy="true" />
      )}

      {/* Error */}
      {error && (
        <p role="alert" className="text-[11px] text-red-400">{error}</p>
      )}

      {/* ── Source passage excerpt ── */}
      {detail && (
        <div
          className={cn(
            "rounded-sm border-l-2 px-3 py-2.5 mb-2.5",
            isTool
              ? "border-blue-700/40 bg-blue-950/15"
              : "border-stone-600/40 bg-stone-900/50"
          )}
        >
          {/* Truncate long passages to ~3 lines for panel view */}
          <p className="text-[12px] leading-relaxed text-stone-300 line-clamp-4">
            {detail.passage_text}
          </p>
        </div>
      )}

      {/* ── Retrieval score + view source link ── */}
      <div className="flex items-center gap-3">
        {detail && !isTool && typeof detail.score === "number" && detail.score > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-stone-700">
              Score
            </span>
            <ScoreBar score={detail.score} />
          </div>
        )}
        {detail && isTool && (
          <span className="text-[10px] text-stone-700">
            Read-only operational tool
          </span>
        )}

        {/* CitationLink opens full inspection modal */}
        <div className="ml-auto">
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

// ─── Source trace (compact index) ────────────────────────────────────────────

function SourceTrace({
  citations,
  jobId,
}: {
  citations: CitationRef[];
  jobId: string;
}) {
  if (citations.length === 0) return null;
  return (
    <section className="mt-5 pt-5 border-t border-stone-800">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">
        Source trace
      </p>
      <ol className="flex flex-col gap-1.5">
        {citations.map((c, i) => (
          <li key={c.chunk_id} className="flex items-baseline gap-2 text-[11px]">
            <span className="w-5 shrink-0 font-mono text-stone-600 tabular-nums select-none">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="flex-1 text-stone-400 truncate" title={c.title}>
              {c.title}
            </span>
            <span className="shrink-0 font-mono text-stone-600 text-[10px]">
              {c.locator}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="rounded border border-dashed border-stone-800 px-5 py-6">
      <p className="text-[13px] text-stone-600">No evidence sources cited.</p>
      <p className="mt-1 text-[11px] text-stone-700 leading-relaxed">
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

      {/* ── HEADER ── */}
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">
          Evidence
          {citations.length > 0 &&
            ` · ${citations.length} source${citations.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Hybrid retrieval tag */}
      {citations.length > 0 && (
        <div className="mb-4 flex flex-col gap-1 rounded-sm border border-stone-800 bg-stone-900/40 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
            Hybrid retrieval
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-stone-600">
            <span>Dense + sparse</span>
            <span aria-hidden>·</span>
            <span>Rank-fused</span>
            <span aria-hidden>·</span>
            <span>ACL-filtered</span>
          </div>
        </div>
      )}

      {citations.length === 0 && <EmptyState />}

      {/* ── DOCUMENT SOURCES ── */}
      {retrievalCitations.length > 0 && (
        <section className="mb-2">
          {toolCitations.length > 0 && (
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-stone-600">
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

      {/* ── TOOL RESULTS ── */}
      {toolCitations.length > 0 && (
        <section className="mt-2">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-stone-600">
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

      {/* ── SOURCE TRACE ── */}
      <SourceTrace citations={citations} jobId={jobId} />
    </div>
  );
}
