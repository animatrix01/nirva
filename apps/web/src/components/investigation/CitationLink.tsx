"use client";

/**
 * CitationLink — "View source" trigger + full evidence inspection modal.
 *
 * TRIGGER (compact prop=true — used by EvidencePanel):
 *   Plain text link: "View source →"
 *
 * TRIGGER (default — used inline in citations list):
 *   Numbered badge pill showing title + locator
 *
 * MODAL structure (engineering evidence inspection window):
 *   DOCUMENT
 *     Type chip · classification
 *     Title (dominant)
 *     Revision · Page · Section path
 *     Equipment ID
 *   ─────────────────────────────
 *   RELEVANT SOURCE PASSAGE
 *     Full verbatim passage (primary visual content)
 *   ─────────────────────────────
 *   WHY NIRVA RETRIEVED THIS
 *     why_retrieved explanation
 *   ─────────────────────────────
 *   RETRIEVAL TRACE
 *     Method · Index · Fusion · Score bar
 *   ─────────────────────────────
 *   TECHNICAL DETAILS ▾ (collapsible)
 *     Chunk ID · Content hash · Document ID
 */

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiError, getEvidence } from "@/lib/api";
import type { CitationRef } from "@/lib/types";
import type { EvidenceReference } from "@/lib/artifacts";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isTool(chunk_id: string, title?: string): boolean {
  return (
    chunk_id.startsWith("tool-") ||
    (title ?? "").toLowerCase().includes("(read-only tool)")
  );
}

function docTypeLabel(t: string | undefined): string {
  if (!t) return "";
  const map: Record<string, string> = {
    sop: "SOP",
    manual: "Manual",
    work_order: "Work Order",
    incident: "Incident",
    data: "Data",
  };
  return map[t] ?? t.replace(/_/g, " ");
}

function buildSectionBreadcrumb(section: string | null | undefined): string[] {
  if (!section || section.startsWith("Dev mode")) return [];
  return section
    .split(" > ")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const barColor =
    pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-red-400";
  const textColor =
    pct >= 80 ? "text-slate-900" : pct >= 60 ? "text-amber-700" : "text-red-600";
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn("h-full rounded-full", barColor)}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <span className={cn("text-sm font-bold tabular-nums", textColor)}>
        {pct}%
      </span>
    </div>
  );
}

// ─── Modal section heading ────────────────────────────────────────────────────

function ModalSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 px-8 py-5 last:border-0">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      {children}
    </div>
  );
}

// ─── Modal body ───────────────────────────────────────────────────────────────

function InspectionModalBody({
  citation,
  evidence,
}: {
  citation: CitationRef;
  evidence: EvidenceReference;
}) {
  const [techOpen, setTechOpen] = useState(false);

  const tool = isTool(evidence.chunk_id, evidence.document_title);
  const sectionParts = buildSectionBreadcrumb(evidence.section);
  const hasScore = typeof evidence.score === "number" && evidence.score > 0;

  return (
    <div className="flex flex-col">

      {/* ── DOCUMENT ── */}
      <div className="border-b border-slate-100 px-8 pb-6 pt-4">
        {/* Chips row */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {evidence.document_type && (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">
              {docTypeLabel(evidence.document_type)}
            </span>
          )}
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest",
              tool
                ? "bg-blue-50 text-blue-600"
                : "bg-slate-100 text-slate-500"
            )}
          >
            {tool ? "Tool result" : "Retrieval"}
          </span>
          {evidence.confidentiality_level && (
            <span className="ml-auto rounded border border-slate-200 px-2 py-0.5 text-[10px] capitalize text-slate-500">
              {evidence.confidentiality_level}
            </span>
          )}
        </div>

        {/* Document title — dominant */}
        <h2 className="text-xl font-bold leading-snug text-slate-900 break-words">
          {evidence.document_title || citation.title}
        </h2>

        {/* Location line */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-400">
          {citation.revision && <span>{citation.revision}</span>}
          {evidence.page != null && (
            <>
              <span aria-hidden>·</span>
              <span className="font-medium text-slate-600">
                Page {evidence.page}
              </span>
            </>
          )}
          {sectionParts.length > 0 && (
            <>
              <span aria-hidden>·</span>
              <ol
                className="flex flex-wrap items-center gap-1"
                aria-label="Section path"
              >
                {sectionParts.map((part, i) => (
                  <li key={i} className="flex items-center gap-1">
                    {i > 0 && (
                      <span className="text-slate-300" aria-hidden>›</span>
                    )}
                    <span
                      className={
                        i === sectionParts.length - 1
                          ? "font-medium text-slate-600"
                          : "text-slate-400"
                      }
                    >
                      {part}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
          {evidence.equipment_id && (
            <>
              <span aria-hidden>·</span>
              <span className="font-semibold text-slate-700">
                {evidence.equipment_id}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── RELEVANT SOURCE PASSAGE ── */}
      <ModalSection label="Relevant source passage">
        <div
          className={cn(
            "rounded-sm border-l-2 px-5 py-4",
            tool
              ? "border-blue-300 bg-blue-50"
              : "border-slate-300 bg-slate-50"
          )}
        >
          <p className="text-sm leading-[1.8] text-slate-800 whitespace-pre-wrap">
            {evidence.passage_text}
          </p>
        </div>
      </ModalSection>

      {/* ── WHY NIRVA RETRIEVED THIS ── */}
      {evidence.why_retrieved && (
        <ModalSection label="Why NIRVA retrieved this">
          <p className="text-sm leading-relaxed text-slate-600">
            {evidence.why_retrieved}
          </p>
        </ModalSection>
      )}

      {/* ── RETRIEVAL TRACE ── */}
      <ModalSection label={tool ? "Source" : "Retrieval trace"}>
        {tool ? (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex gap-8">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
                  Method
                </p>
                <p className="font-medium text-slate-800">
                  Read-only operational tool
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
                  Access
                </p>
                <p className="text-slate-600">
                  Asset history · inventory · episodic memory
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                Method
              </p>
              <p className="text-sm font-semibold text-slate-800">
                Hybrid dense + sparse
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                Fusion
              </p>
              <p className="text-sm text-slate-600">
                Reciprocal-rank · ACL-filtered
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                Index
              </p>
              <p className="text-sm text-slate-600">nirva_chunks · Qdrant</p>
            </div>
            {hasScore && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                  Relevance score
                </p>
                <ScoreBar score={evidence.score!} />
              </div>
            )}
          </div>
        )}
      </ModalSection>

      {/* ── TECHNICAL DETAILS (collapsible) ── */}
      <div className="px-8 py-4">
        <button
          type="button"
          onClick={() => setTechOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 transition hover:text-slate-600"
          aria-expanded={techOpen}
        >
          {techOpen ? (
            <ChevronDown className="size-3" aria-hidden />
          ) : (
            <ChevronRight className="size-3" aria-hidden />
          )}
          Technical details
        </button>

        {techOpen && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-xs">
            <dt className="font-semibold text-slate-500">Chunk ID</dt>
            <dd className="font-mono text-slate-600 break-all">
              {evidence.chunk_id}
            </dd>

            {evidence.document_id && (
              <>
                <dt className="font-semibold text-slate-500">Document ID</dt>
                <dd className="font-mono text-slate-600 break-all">
                  {evidence.document_id}
                </dd>
              </>
            )}

            {evidence.content_hash && (
              <>
                <dt className="font-semibold text-slate-500">Content hash</dt>
                <dd className="font-mono text-slate-600 break-all">
                  {evidence.content_hash.slice(0, 24)}…
                </dd>
              </>
            )}

            <dt className="font-semibold text-slate-500">Classification</dt>
            <dd className="capitalize text-slate-600">
              {evidence.confidentiality_level}
            </dd>
          </dl>
        )}
      </div>

    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface CitationLinkProps {
  citation: CitationRef;
  jobId: string;
  /** Index in the citations array — shown in the badge. */
  index?: number;
  /**
   * compact=true: renders as a plain "View source →" text link.
   * compact=false (default): renders as a numbered badge pill.
   */
  compact?: boolean;
}

export function CitationLink({
  citation,
  jobId,
  index,
  compact = false,
}: CitationLinkProps) {
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceReference | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tool = isTool(citation.chunk_id, citation.title);

  async function handleOpen() {
    setOpen(true);
    if (evidence) return;
    setLoading(true);
    setError(null);
    try {
      const ev = await getEvidence(jobId, citation.chunk_id);
      setEvidence(ev);
    } catch (e: unknown) {
      setError(
        e instanceof ApiError ? e.body.detail : "Failed to load source"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* ── Trigger ── */}
      {compact ? (
        <button
          type="button"
          onClick={() => void handleOpen()}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 hover:border-slate-400 whitespace-nowrap"
          aria-label={`View source: ${citation.title}, ${citation.revision}, ${citation.locator}`}
        >
          View source →
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handleOpen()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors",
            tool
              ? "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100"
              : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
          )}
          title={`Open source: ${citation.title} ${citation.revision} ${citation.locator}`}
          aria-label={`View source: ${citation.title}, ${citation.revision}, ${citation.locator}`}
        >
          {index != null && (
            <span className="flex size-4 items-center justify-center rounded bg-slate-200 text-[9px] font-bold text-slate-600">
              {index + 1}
            </span>
          )}
          <span className="max-w-[180px] truncate">{citation.title}</span>
          <span className="shrink-0 text-slate-400">{citation.locator}</span>
        </button>
      )}

      {/* ── Evidence inspection modal ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="overflow-hidden flex flex-col p-0 !max-w-none bg-white"
          style={{ width: "min(96vw, 860px)", maxHeight: "90vh" }}
        >
          {/* Modal header */}
          <DialogHeader className="shrink-0 border-b border-slate-200 bg-slate-50 px-8 pt-5 pb-4">
            <DialogTitle className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Source inspection
            </DialogTitle>
            <p className="mt-0.5 text-xs text-slate-500">
              {citation.title}
              {citation.revision && ` · ${citation.revision}`}
              {citation.locator && ` · ${citation.locator}`}
            </p>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto bg-white">
            {loading && (
              <div className="px-8 py-8 flex flex-col gap-4">
                <div className="h-6 w-2/3 animate-pulse rounded bg-slate-200" />
                <div className="h-32 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
              </div>
            )}

            {error && (
              <div className="px-8 py-6">
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              </div>
            )}

            {evidence && !loading && (
              <InspectionModalBody citation={citation} evidence={evidence} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
