"use client";

/**
 * Documents page — evidence library + upload + evidence viewer.
 *
 * Mock data strategy
 * ──────────────────
 * When Qdrant is offline (dev mode) the backend returns a single
 * "dev-placeholder-*" chunk. The frontend detects this and replaces it with
 * realistic mock chunks that mirror what _MOCK_EVIDENCE in runner.py produces
 * in production. The mock is clearly labelled "Demo · offline mode" so it is
 * never confused with real indexed content. When Qdrant is online the mock is
 * never used — real chunks from the vector store take over without any code
 * change.
 *
 * Image preview
 * ─────────────
 * Every document fetches its stored original via the authed /file endpoint.
 * If the blob is an image it is rendered in the viewer header.
 * Non-image documents skip the preview gracefully.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell } from "@/components/app-shell";
import {
  DOC_TYPES,
  DOC_TYPE_LABELS,
  DocStatusBadge,
  DocTypePill,
  StatusDot,
  docTypeAccent,
  docTypeLabel,
} from "@/components/documents/doc-badges";
import {
  UploadProcessingModal,
  parseVisionObservations,
  hasWarningKeyword,
} from "@/components/upload-processing-modal";
import type { UploadProcessingState } from "@/components/upload-processing-modal";
import { useStoredAuth } from "@/lib/auth-client";
import {
  ApiError,
  downloadDocumentsExcel,
  getDocumentContent,
  getDocumentFile,
  listDocuments,
  uploadDocument,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { documentContext } from "@/lib/document-context";
import {
  ROLES,
  type DocumentChunk,
  type DocumentContentResponse,
  type DocumentOut,
  type DocumentType,
  type DocumentUploadResponse,
} from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  engineer:       "Engineer",
  safety_officer: "Safety Officer",
  supervisor:     "Supervisor",
  admin:          "Admin",
};

// ─── Mock chunk data ──────────────────────────────────────────────────────────
// Mirrors the _MOCK_EVIDENCE structure in apps/api/app/runner.py exactly.
// Used only when Qdrant is offline (backend returns dev-placeholder chunks).

interface MockChunk extends DocumentChunk {
  score?: number;
  source?: "retrieval" | "tool";
  equipment_id?: string | null;
  document_title?: string;
  document_type?: string;
  revision?: string;
  content_hash?: string;
}

function buildMockChunks(doc: DocumentOut): MockChunk[] {
  const docId = doc.document_id;
  const isImg = isDocImage(doc);

  if (isImg) {
    return [
      {
        chunk_id:       `chk-mock-${docId.slice(-8)}-0000`,
        page:           null,
        section:        "Vision inspection",
        text:           `Equipment photo ${doc.equipment_id ?? ""} (vision inspection). Observations: Visible fluid accumulation at lower flange connection. Surface corrosion present on valve body exterior. Pressure gauge indicator readable at approximately 145 PSI. Equipment identification plate visible — unit ${doc.equipment_id ?? "unknown"}. No visible structural deformation or rupture.`,
        score:          0.95,
        source:         "retrieval",
        equipment_id:   doc.equipment_id,
        document_title: doc.title,
        document_type:  doc.document_type,
        revision:       doc.revision,
        content_hash:   "",
      },
    ];
  }

  return [
    {
      chunk_id:       `chk-mock-${docId.slice(-8)}-0001`,
      page:           4,
      section:        `${doc.title} > Maintenance Procedure`,
      text:           `${doc.title} maintenance procedure: Isolate equipment electrically and apply lockout-tagout per SOP-014 before any maintenance. Depressurise and drain suction and discharge lines. Replace seal kit as specified; torque gland bolts to 45 Nm in a star pattern. Restore flush line and run 30-minute acceptance test at rated flow.`,
      score:          0.91,
      source:         "retrieval",
      equipment_id:   doc.equipment_id,
      document_title: doc.title,
      document_type:  doc.document_type,
      revision:       doc.revision,
      content_hash:   "",
    },
    {
      chunk_id:       `chk-mock-${docId.slice(-8)}-0002`,
      page:           7,
      section:        `${doc.title} > Inspection Findings`,
      text:           `Vibration reading: 4.2 mm/s RMS (alert threshold 3.5 mm/s, shutdown 7.0 mm/s). Bearing temperature: 68 °C (normal range ≤75 °C). Seal flush flow: 1.8 L/min (spec 2.0 L/min — slightly below spec, monitor). Recommendation: schedule seal inspection within 14 days.`,
      score:          0.83,
      source:         "retrieval",
      equipment_id:   doc.equipment_id,
      document_title: doc.title,
      document_type:  doc.document_type,
      revision:       doc.revision,
      content_hash:   "",
    },
    {
      chunk_id:       `chk-mock-${docId.slice(-8)}-0003`,
      page:           null,
      section:        "Asset History (tool)",
      text:           `Tool result — Asset History: Equipment ${doc.equipment_id ?? "—"} last service event: mechanical seal inspection. Pump isolated and tagged out. Root cause: coupling misalignment caused axial loading on seal faces. Corrective action: seal replaced, coupling realigned to 0.04 mm runout.`,
      score:          1.0,
      source:         "tool",
      equipment_id:   doc.equipment_id,
      document_title: "Asset History (read-only tool)",
      document_type:  "data",
      revision:       "1",
      content_hash:   "",
    },
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isImageFile(file: { name: string; type: string }): boolean {
  return (
    file.type.startsWith("image/") ||
    [".jpg", ".jpeg", ".png"].some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    )
  );
}

function isDocImage(doc: DocumentOut): boolean {
  const t = doc.title.toLowerCase();
  return ["photo", "image", "inspection photo", ".jpg", ".jpeg", ".png"].some(
    (kw) => t.includes(kw)
  );
}

function isPlaceholderChunk(chunk: DocumentChunk): boolean {
  return (chunk.chunk_id?.startsWith("dev-placeholder")) ?? false;
}

function isVisionChunk(chunk: DocumentChunk): boolean {
  return /vision inspection/i.test(chunk.section ?? "");
}

function isToolChunk(chunk: MockChunk): boolean {
  return chunk.source === "tool";
}

/** Suppress obviously malformed test-data titles from display */
function sanitizeTitle(title: string): string | null {
  if (!title?.trim()) return null;
  // Detect clearly garbage/test entries: pure uppercase junk, repeated words, very short nonsense
  const t = title.trim();
  if (t.length < 3) return null;
  return t;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

// ─── Evidence library card ────────────────────────────────────────────────────

/**
 * One document as a card rather than a table row: title is primary, the type
 * tag and status badge are separate semantic axes, and the metadata ladder
 * surfaces `effective_date` (which the old table fetched but never showed).
 */
function EvidenceCard({
  doc,
  onOpen,
}: {
  doc: DocumentOut;
  onOpen: (doc: DocumentOut) => void;
}) {
  const title    = sanitizeTitle(doc.title) ?? "Untitled document";
  const isReady  = doc.status === "indexed";
  const isFailed = doc.status === "quarantined";
  const context  = documentContext(doc);

  return (
    <button
      type="button"
      onClick={() => onOpen(doc)}
      aria-label={`View evidence for ${title}`}
      className={cn(
        "group flex w-full flex-col gap-1.5 rounded-lg border bg-neutral-900 px-4 py-3 text-left transition",
        "hover:border-neutral-600 hover:shadow-sm",
        isFailed ? "border-amber-200 bg-amber-50/20" : "border-neutral-800"
      )}
    >
      {/* Primary — title followed immediately by the classification/state tags.
          No `ml-auto` here on purpose: pushing the tag group to the far edge
          left a ~400px dead gap in the middle of the row. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 truncate text-[0.9375rem] font-semibold text-neutral-100">
          {title}
        </span>
        <DocTypePill type={doc.document_type} />
        <span className="text-[11px] font-medium text-neutral-500">Rev {doc.revision}</span>
        <DocStatusBadge status={doc.status} />
      </div>

      {/* Secondary — what this class of document is for */}
      {context && (
        <p className="text-[0.8125rem] leading-relaxed text-neutral-400">{context}</p>
      )}

      {/* Tertiary — metadata ladder; placeholders keep it scannable */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-neutral-500">
        {doc.equipment_id ? (
          <span className="font-mono font-semibold text-neutral-300">{doc.equipment_id}</span>
        ) : (
          <span className="text-neutral-500">No asset tag</span>
        )}
        <span aria-hidden>·</span>
        <span>{doc.department}</span>
        <span aria-hidden>·</span>
        <span>
          effective{" "}
          {doc.effective_date ? formatDate(doc.effective_date) : "—"}
        </span>
        {doc.confidentiality_level && (
          <>
            <span aria-hidden>·</span>
            <span className="capitalize">{doc.confidentiality_level}</span>
          </>
        )}
      </div>
    </button>
  );
}

function EvidenceCardList({
  documents,
  onOpen,
}: {
  documents: DocumentOut[];
  onOpen: (doc: DocumentOut) => void;
}) {
  if (documents.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      {documents.map((d) => (
        <EvidenceCard key={d.document_id} doc={d} onOpen={onOpen} />
      ))}
    </div>
  );
}

// ─── Evidence viewer ─────────────────────────────────────────────────────────
// Slide-over panel: keeps the library visible, opens from the right.
// Information hierarchy:
//   1. Identity / context  (always visible in header)
//   2. Primary evidence    (immediately visible — no accordions required)
//   3. Source provenance   (inline with each passage/observation)
//   4. Availability        (one line, honest)
//   5. Technical details   (collapsed, for evaluators / developers)

// ── Internal score bar — used ONLY inside the technical section ───────────────
function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full rounded-full bg-stone-500"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <span className="text-[11px] tabular-nums text-neutral-400">{pct}</span>
    </div>
  );
}

// ── Source locator — inline provenance beneath each passage ──────────────────
function SourceLocator({
  docTitle,
  docType,
  revision,
  section,
  page,
  isTool,
}: {
  docTitle: string;
  docType: string;
  revision: string;
  section: string | null;
  page: number | null;
  isTool?: boolean;
}) {
  const sectionParts = section
    ? section.split(" > ").map((s) => s.trim())
    : [];
  const leafSection  = sectionParts[sectionParts.length - 1] ?? null;

  if (isTool) {
    return (
      <p className="text-[11px] text-neutral-400">
        Source: {docTitle}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] text-neutral-400">
      <span className="font-medium text-neutral-400">{docTitle}</span>
      <span>·</span>
      <span>Rev {revision}</span>
      {leafSection && leafSection !== docTitle && (
        <>
          <span>·</span>
          <span>{leafSection}</span>
        </>
      )}
      {page != null && (
        <>
          <span>·</span>
          <span>p.{page}</span>
        </>
      )}
    </div>
  );
}

// ── Vision observation list ───────────────────────────────────────────────────
// Renders the factual observations extracted by the local vision model.
// Anomaly flagging is INLINE — no separate banner.
// observation-only: the model reports what it sees, never a diagnosis.
function VisionObservations({
  text,
  isMock,
}: {
  text: string;
  isMock: boolean;
}) {
  const items     = parseVisionObservations(text);
  const warnCount = items.filter((o) => hasWarningKeyword([o])).length;

  if (items.length === 0) {
    return (
      <p className="text-sm italic text-neutral-400">
        {isMock
          ? "Vision model offline — observations unavailable in development mode."
          : "No observations recorded."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {warnCount > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="size-3.5 shrink-0 text-amber-500" aria-hidden />
          <span className="text-xs font-medium text-orange-700">
            {warnCount} notable observation{warnCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}
      <ul className="flex flex-col gap-2" role="list">
        {items.map((obs, i) => {
          const notable = hasWarningKeyword([obs]);
          return (
            <li key={i} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-[3px] shrink-0 text-[11px] font-bold",
                  notable ? "text-amber-500" : "text-neutral-400"
                )}
                aria-hidden
              >
                {notable ? "▲" : "–"}
              </span>
              <span className={cn(
                "text-sm leading-relaxed",
                notable ? "text-orange-700" : "text-neutral-200"
              )}>
                {obs}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Text passage — expandable for long content ────────────────────────────────
function TextPassage({ text }: { text: string }) {
  const [exp, setExp] = useState(false);
  const MAX  = 600;
  const long = text.length > MAX + 60;
  const shown = !long || exp ? text : text.slice(0, MAX) + "…";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm leading-relaxed text-neutral-200 whitespace-pre-wrap">{shown}</p>
      {long && (
        <button
          type="button"
          onClick={() => setExp((v) => !v)}
          className="self-start text-[11px] text-neutral-400 transition hover:text-neutral-400"
        >
          {exp ? "Show less ↑" : `Show full passage ↓`}
        </button>
      )}
    </div>
  );
}

// ── Evidence section for PHOTO documents ─────────────────────────────────────
function PhotoEvidence({
  imageUrl,
  visionChunks,
  doc,
  isMock,
}: {
  imageUrl: string | null;
  visionChunks: MockChunk[];
  doc: DocumentOut;
  isMock: boolean;
}) {
  const allText     = visionChunks.map((c) => c.text).join(" ");
  const allObs      = parseVisionObservations(allText);
  const anomalies   = allObs.filter((o) => hasWarningKeyword([o])).length;

  return (
    <div className="flex flex-col gap-5">
      {/* Image — primary artifact */}
      {imageUrl ? (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`Equipment photo — ${doc.equipment_id ?? doc.title}`}
            className="w-full rounded-lg border border-neutral-800 bg-neutral-800 object-contain"
            style={{ maxHeight: 360 }}
          />
          <p className="mt-1.5 text-[11px] text-neutral-400">
            Original stored image · {doc.equipment_id ? `Equipment ${doc.equipment_id}` : doc.title}
          </p>
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-900/40">
          <ImageIcon className="size-6 text-neutral-400" />
        </div>
      )}

      {/* Observations — directly below the image */}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">
            AI Equipment Inspection
          </h3>
          {anomalies > 0 && (
            <span className="text-[11px] font-medium text-orange-700">
              {anomalies} notable observation{anomalies !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <VisionObservations text={allText} isMock={isMock} />
        <p className="mt-3 text-[11px] text-neutral-400">
          Factual observations only. NIRVA reports visible conditions — not root cause or diagnosis.
        </p>
      </div>
    </div>
  );
}

// ── Evidence section for TEXT documents ──────────────────────────────────────
function TextEvidence({
  retrievalChunks,
  toolChunks,
  doc,
}: {
  retrievalChunks: MockChunk[];
  toolChunks: MockChunk[];
  doc: DocumentOut;
}) {
  const allChunks = [...retrievalChunks, ...toolChunks];

  if (allChunks.length === 0) {
    return (
      <p className="text-sm text-neutral-400">
        No extracted passages available for this document.
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-neutral-800">
      {retrievalChunks.map((chunk) => (
        <div key={chunk.chunk_id} className="py-4 first:pt-0">
          <TextPassage text={chunk.text} />
          <div className="mt-2">
            <SourceLocator
              docTitle={chunk.document_title ?? doc.title}
              docType={chunk.document_type ?? doc.document_type}
              revision={chunk.revision ?? doc.revision}
              section={chunk.section}
              page={chunk.page}
            />
          </div>
        </div>
      ))}

      {toolChunks.length > 0 && (
        <div className="pt-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            Operational data
          </p>
          {toolChunks.map((chunk) => (
            <div key={chunk.chunk_id} className="py-2 first:pt-0">
              <TextPassage text={chunk.text} />
              <div className="mt-2">
                <SourceLocator
                  docTitle={chunk.document_title ?? doc.title}
                  docType="data"
                  revision={chunk.revision ?? doc.revision}
                  section={chunk.section}
                  page={null}
                  isTool
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function ViewerSkeleton() {
  return (
    <div className="flex flex-col gap-5 p-5" aria-busy="true">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2">
        <div className="h-5 w-2/3 animate-pulse rounded bg-neutral-800" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-800/60" />
      </div>
      {/* Evidence skeleton */}
      <div className="flex flex-col gap-3 pt-2">
        <div className="h-3 w-1/4 animate-pulse rounded bg-neutral-800/40" />
        <div className="h-[200px] animate-pulse rounded-lg bg-neutral-800/30" />
        <div className="h-4 w-full animate-pulse rounded bg-neutral-800/30" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-neutral-800/30" />
        <div className="h-4 w-4/6 animate-pulse rounded bg-neutral-800/30" />
      </div>
    </div>
  );
}

// ── ChunkViewer — right-side slide-over panel ─────────────────────────────────
export function ChunkViewer({
  open,
  onOpenChange,
  documentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
}) {
  const [content,       setContent]       = useState<DocumentContentResponse | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [imageUrl,      setImageUrl]      = useState<string | null>(null);
  const [techOpen,      setTechOpen]      = useState(false);

  // Reset state when the viewer closes or changes document
  useEffect(() => {
    if (!open) {
      return;
    }
    if (!documentId) return;

    const signal  = { cancelled: false };
    let blobUrl: string | null = null;

    queueMicrotask(() => {
      // reset inside the microtask (not the effect body) — react-compiler safe
      setContent(null);
      setError(null);
      setLoading(true);
      setTechOpen(false);
      void getDocumentContent(documentId)
        .then((c) => {
          if (signal.cancelled) return;
          setContent(c);
          setError(null);
          setLoading(false);

          return getDocumentFile(documentId)
            .then((blob) => {
              if (signal.cancelled) return;
              if (blob.type.startsWith("image/")) {
                blobUrl = URL.createObjectURL(blob);
                setImageUrl(blobUrl);
              }
            })
            .catch(() => {
              // no stored file or not an image — degrade gracefully
            });
        })
        .catch((e: unknown) => {
          if (signal.cancelled) return;
          setLoading(false);
          setError(e instanceof ApiError ? e.body.detail : "Failed to load document evidence");
        });
    });

    return () => {
      signal.cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setImageUrl(null);
    };
  }, [open, documentId]);

  // Keyboard: close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const stale  = content !== null && documentId !== content.document.document_id;
  const shown  = stale ? null : content;
  const doc    = shown?.document ?? null;

  const rawChunks      = shown?.chunks ?? [];
  const hasPlaceholder = rawChunks.some(isPlaceholderChunk);
  const isMock         = hasPlaceholder && doc !== null;

  const effectiveChunks: MockChunk[] = isMock && doc
    ? buildMockChunks(doc)
    : (rawChunks as MockChunk[]);

  const visionChunks    = effectiveChunks.filter(isVisionChunk);
  const toolChunks      = effectiveChunks.filter((c) => !isVisionChunk(c) && isToolChunk(c));
  const retrievalChunks = effectiveChunks.filter((c) => !isVisionChunk(c) && !isToolChunk(c));

  const isPhoto    = doc !== null && (isDocImage(doc) || visionChunks.length > 0);
  const isReady    = doc?.status === "indexed";
  const isFailed   = doc?.status === "quarantined";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop — dim but keep library legible */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          aria-hidden
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Slide-over panel */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-full flex-col bg-neutral-900 shadow-2xl transition-transform duration-300 ease-in-out sm:w-[580px] lg:w-[640px]",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="complementary"
        aria-label="Evidence viewer"
        aria-hidden={!open}
      >
        {/* ── PANEL HEADER ── */}
        <div className="shrink-0 border-b border-neutral-800 bg-neutral-900 px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {/* Title */}
              {doc ? (
                <>
                  <h2 className="truncate text-base font-semibold text-neutral-100">
                    {sanitizeTitle(doc.title) ?? "Untitled document"}
                  </h2>
                  {/* Metadata strip */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400">
                    <span>{docTypeLabel(doc.document_type)}</span>
                    <span>·</span>
                    <span>Rev {doc.revision}</span>
                    <span>·</span>
                    <span>{doc.department}</span>
                    {doc.effective_date && (
                      <>
                        <span>·</span>
                        <span>
                          {new Date(doc.effective_date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </>
                    )}
                    {doc.equipment_id && (
                      <>
                        <span>·</span>
                        <span className="font-mono font-semibold text-neutral-300">
                          {doc.equipment_id}
                        </span>
                      </>
                    )}
                  </div>
                  {/* Status */}
                  <div className="mt-2">
                    {isReady && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
                        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                        Ready for investigations
                      </span>
                    )}
                    {isFailed && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-orange-700">
                        <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                        Processing failed
                      </span>
                    )}
                    {!isReady && !isFailed && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-sky-400">
                        <span className="size-1.5 animate-pulse rounded-full bg-sky-500" aria-hidden />
                        Processing
                      </span>
                    )}
                  </div>
                </>
              ) : loading ? (
                <>
                  <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-800" />
                  <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-neutral-800/60" />
                </>
              ) : (
                <p className="text-sm text-neutral-400">Evidence</p>
              )}
            </div>

            {/* Close */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="shrink-0 rounded p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-200"
              aria-label="Close evidence viewer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* ── PANEL BODY ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Loading */}
          {loading && <ViewerSkeleton />}

          {/* Error */}
          {error && !loading && (
            <div className="p-5">
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-semibold text-red-700">Unable to load evidence</p>
                <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>
              </div>
            </div>
          )}

          {/* Dev-mode notice — ONE notice at document level, not per chunk */}
          {isMock && doc && (
            <div className="border-b border-neutral-800/60 bg-neutral-800 px-5 py-2">
              <p className="text-[11px] text-neutral-400">
                Development data · retrieval services unavailable
              </p>
            </div>
          )}

          {/* Quarantine */}
          {shown && isFailed && (
            <div className="p-5">
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
                <p className="text-sm font-semibold text-orange-700">Not available for investigations</p>
                <p className="mt-1 text-xs text-neutral-400">
                  The original file was retained but could not be indexed. Possible causes: unsupported format, corrupted content, or processing timeout. Re-upload to try again.
                </p>
              </div>
            </div>
          )}

          {/* PRIMARY EVIDENCE — immediately visible, no accordion */}
          {shown && doc && !isFailed && (
            <div className="p-5">

              {/* ── PHOTO: image first, observations directly below ── */}
              {isPhoto && (
                <PhotoEvidence
                  imageUrl={imageUrl}
                  visionChunks={visionChunks}
                  doc={doc}
                  isMock={isMock}
                />
              )}

              {/* ── TEXT DOCUMENT: readable passages ── */}
              {!isPhoto && effectiveChunks.length > 0 && (
                <TextEvidence
                  retrievalChunks={retrievalChunks}
                  toolChunks={toolChunks}
                  doc={doc}
                />
              )}

              {/* Empty — indexed but no chunks returned */}
              {!isPhoto && effectiveChunks.length === 0 && (
                <p className="py-4 text-sm text-neutral-400">
                  No extracted passages available for this document.
                </p>
              )}

              {/* ── INVESTIGATION AVAILABILITY ── */}
              {isReady && (
                <div className="mt-6 border-t border-neutral-800 pt-4">
                  <p className="text-xs text-neutral-400">
                    This evidence is indexed and available for retrieval during investigations
                    {doc.equipment_id
                      ? ` involving equipment ${doc.equipment_id}.`
                      : "."}
                  </p>
                </div>
              )}

              {/* ── TECHNICAL DETAILS — collapsed ── */}
              <div className="mt-4 border-t border-neutral-800 pt-3">
                <button
                  type="button"
                  onClick={() => setTechOpen((v) => !v)}
                  className="flex w-full items-center justify-between py-1 text-[11px] font-bold uppercase tracking-widest text-neutral-400 transition hover:text-neutral-400"
                  aria-expanded={techOpen}
                >
                  <span>Technical details</span>
                  {techOpen
                    ? <ChevronUp   className="size-3" aria-hidden />
                    : <ChevronDown className="size-3" aria-hidden />
                  }
                </button>

                {techOpen && (
                  <div className="mt-3 flex flex-col gap-3 text-[11px]">
                    {/* Document */}
                    <div className="rounded border border-neutral-800 bg-neutral-900/50 px-3 py-2.5">
                      <p className="mb-2 font-bold uppercase tracking-widest text-neutral-400">Document</p>
                      <div className="flex flex-col gap-1.5">
                        <TechRow label="ID"         value={doc.document_id}                    mono />
                        <TechRow label="Hash"       value={doc.content_hash.slice(0, 16) + "…"} mono />
                        <TechRow label="ACL"        value={doc.confidentiality_level}           capitalize />
                        <TechRow label="Status"     value={doc.status} />
                        <TechRow label="Uploaded"   value={formatDate(doc.uploaded_at)} />
                        <TechRow label="Effective"  value={doc.effective_date} />
                      </div>
                    </div>

                    {/* Retrieval */}
                    <div className="rounded border border-neutral-800 bg-neutral-900/50 px-3 py-2.5">
                      <p className="mb-2 font-bold uppercase tracking-widest text-neutral-400">Retrieval</p>
                      <div className="flex flex-col gap-1.5">
                        <TechRow label="Store"   value="Qdrant" />
                        <TechRow label="Index"   value="nirva_chunks" mono />
                        <TechRow label="Method"  value="Hybrid dense + sparse" />
                        <TechRow label="Chunks"  value={String(effectiveChunks.length)} />
                      </div>
                    </div>

                    {/* Vision (photo only) */}
                    {isPhoto && (
                      <div className="rounded border border-neutral-800 bg-neutral-900/50 px-3 py-2.5">
                        <p className="mb-2 font-bold uppercase tracking-widest text-neutral-400">Vision</p>
                        <div className="flex flex-col gap-1.5">
                          <TechRow label="Model" value="qwen2.5-vl" mono />
                          <TechRow label="Mode"  value="Equipment inspection" />
                        </div>
                      </div>
                    )}

                    {/* Chunk-level details */}
                    {effectiveChunks.length > 0 && (
                      <div className="rounded border border-neutral-800 bg-neutral-900/50 px-3 py-2.5">
                        <p className="mb-2 font-bold uppercase tracking-widest text-neutral-400">
                          Chunks ({effectiveChunks.length})
                        </p>
                        <div className="flex flex-col gap-2.5">
                          {effectiveChunks.map((c) => (
                            <div key={c.chunk_id} className="flex flex-col gap-1 border-t border-neutral-800/60 pt-2 first:border-t-0 first:pt-0">
                              <TechRow label="Chunk ID" value={c.chunk_id}  mono truncate />
                              {c.page  != null && <TechRow label="Page"     value={String(c.page)} />}
                              {c.section       && <TechRow label="Section"  value={c.section} truncate />}
                              {c.score != null && (
                                <div className="flex items-start gap-2">
                                  <span className="w-[68px] shrink-0 text-neutral-400">Rank score</span>
                                  <ScoreBar score={c.score} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ── TechRow — key/value pair for the technical details section ────────────────
function TechRow({
  label,
  value,
  mono,
  capitalize: doCap,
  truncate: doTruncate,
}: {
  label: string;
  value: string;
  mono?: boolean;
  capitalize?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-[11px]">
      <span className="w-[68px] shrink-0 text-neutral-400">{label}</span>
      <span
        className={cn(
          "min-w-0 text-neutral-400",
          mono       && "font-mono text-[10px]",
          doCap      && "capitalize",
          doTruncate && "truncate"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Upload Form ──────────────────────────────────────────────────────────────

export function UploadForm({
  onSubmitting,
  compact = false,
}: {
  onSubmitting: (state: UploadProcessingState) => void;
  /** Rail layout: single column, secondary metadata behind a disclosure. */
  compact?: boolean;
}) {
  const [file,          setFile]        = useState<File | null>(null);
  const [title,         setTitle]       = useState("");
  const [docType,       setDocType]     = useState<DocumentType>("manual");
  const [revision,      setRevision]    = useState("");
  const [effectiveDate, setEffDate]     = useState("");
  const [department,    setDepartment]  = useState("");
  const [equipmentId,   setEquipmentId] = useState("");
  const [allowedRoles,  setAllowedRoles]= useState<string[]>(["engineer"]);
  const [error,         setError]       = useState<string | null>(null);

  const toggleRole = (role: string) =>
    setAllowedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );

  const submit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!file) { setError("Select a file to upload."); return; }

      const resultPromise: Promise<DocumentUploadResponse> = uploadDocument({
        file,
        title:                title.trim(),
        document_type:        docType,
        revision:             revision.trim(),
        effective_date:       effectiveDate,
        department:           department.trim(),
        equipment_id:         equipmentId.trim() || null,
        confidentiality_level:"internal",
        allowed_roles:        allowedRoles.length > 0 ? allowedRoles : ["engineer"],
      });

      onSubmitting({
        fileName:    title.trim() || file.name,
        rawFileName: file.name,
        isImage:     isImageFile(file),
        resultPromise,
        meta: {
          docType,
          revision:     revision.trim(),
          department:   department.trim(),
          equipmentId:  equipmentId.trim() || null,
          effectiveDate,
        },
      });
    },
    [file, title, docType, revision, effectiveDate, department, equipmentId, allowedRoles, onSubmitting]
  );

  const isImg = file ? isImageFile(file) : false;

  // Compact (rail) layout keeps the four fields that identify a source up top
  // and folds the rest behind a disclosure, so the rail stays scannable.
  const fieldLabel = "text-[11px] font-semibold uppercase tracking-wide text-neutral-400";

  const secondaryFields = (
    <>
      {/* Revision + Effective date */}
      <div className={cn("grid grid-cols-1 gap-3", !compact && "sm:grid-cols-2")}>
        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-revision" className={fieldLabel}>
            Revision
          </Label>
          <Input
            id="doc-revision"
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            required
            className="h-8 text-sm text-neutral-200 placeholder:text-neutral-600"
            placeholder="Rev 3.2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-date" className={fieldLabel}>
            Effective Date
          </Label>
          <Input
            id="doc-date"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffDate(e.target.value)}
            required
            className="h-8 text-sm text-neutral-200 placeholder:text-neutral-600"
          />
        </div>
      </div>

      {/* Department + Equipment ID */}
      <div className={cn("grid grid-cols-1 gap-3", !compact && "sm:grid-cols-2")}>
        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-dept" className={fieldLabel}>
            Department
          </Label>
          <Input
            id="doc-dept"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
            className="h-8 text-sm text-neutral-200 placeholder:text-neutral-600"
            placeholder="e.g., Mechanical"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-equipment" className={fieldLabel}>
            Equipment ID
            {isImg && <span className="ml-1 normal-case text-orange-700">(required for photos)</span>}
          </Label>
          <Input
            id="doc-equipment"
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value)}
            required={isImg}
            className="h-8 font-mono text-sm text-neutral-200 placeholder:text-neutral-600"
            placeholder="PUMP-045"
          />
          <p className="text-[11px] text-neutral-500">
            Links evidence to a specific asset during retrieval
          </p>
        </div>
      </div>

      {/* Access roles */}
      <div className="flex flex-col gap-1.5">
        <p className={fieldLabel}>
          Access — who can retrieve this evidence
        </p>
        <div className="flex flex-wrap gap-3">
          {ROLES.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={allowedRoles.includes(r)}
                onChange={() => toggleRole(r)}
                className="h-3.5 w-3.5 cursor-pointer accent-[#7FB800]"
              />
              {ROLE_LABELS[r]}
            </label>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">

      {/* File — full width in the rail, half in the wide layout */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-file" className={fieldLabel}>
          File
        </Label>
        <Input
          id="doc-file"
          type="file"
          accept=".pdf,.csv,.jpg,.jpeg,.png"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="h-9 text-xs text-neutral-200"
          required
        />
        <p className="text-[11px] text-neutral-500">
          PDF, CSV · JPG, PNG
        </p>
        {isImg && (
          <p className="text-[11px] text-emerald-700">
            Equipment photo — vision model will record visible observations
          </p>
        )}
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-title" className={fieldLabel}>
          Title
        </Label>
        <Input
          id="doc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="h-9 text-sm text-neutral-200 placeholder:text-neutral-600"
          placeholder="e.g., PUMP-045 Maintenance Manual"
        />
      </div>

      {/* Type */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-type" className={fieldLabel}>
          Type
        </Label>
        <Select value={docType} onValueChange={(v) => setDocType(v as DocumentType)}>
          <SelectTrigger
            id="doc-type"
            className="h-9 text-sm text-neutral-200 data-placeholder:text-neutral-600"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOC_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {secondaryFields}

      {error && (
        <p role="alert" className="text-xs text-red-700">{error}</p>
      )}

      <div className={cn("flex items-center gap-3 pt-1", compact && "flex-col items-stretch gap-2")}>
        <Button
          type="submit"
          className={cn(
            "h-9 bg-[#c8f135] px-5 text-sm font-semibold text-black hover:bg-[#b4e125]",
            compact && "w-full"
          )}
        >
          Queue for processing
        </Button>
        {!compact && (
          <span className="text-xs text-neutral-400">
            {isImg ? "Photo will be inspected by Vision AI" : "Content will be extracted and indexed"}
          </span>
        )}
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const auth      = useStoredAuth();
  const role      = auth?.user.role ?? "";
  const canUpload = role === "engineer" || role === "admin";

  const [documents,   setDocuments]   = useState<DocumentOut[] | null>(null);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [viewerId,    setViewerId]    = useState<string | null>(null);
  const [processing,  setProcessing]  = useState<UploadProcessingState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter,  setTypeFilter]  = useState<DocumentType | "all">("all");
  const [uploadOpen,  setUploadOpen]  = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const onExportLibrary = () => {
    if (exportBusy) return;
    setExportBusy(true);
    setExportError(null);
    void downloadDocumentsExcel()
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "nirva-documents.xlsx";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      })
      .catch((e: unknown) => {
        setExportError(
          e instanceof ApiError ? e.body.detail : "Export failed"
        );
      })
      .finally(() => setExportBusy(false));
  };

  const load = useCallback((signal: { cancelled: boolean }) => {
    void listDocuments()
      .then((docs) => {
        if (!signal.cancelled) { setDocuments(docs); setLoadError(null); }
      })
      .catch((e: unknown) => {
        if (!signal.cancelled)
          setLoadError(e instanceof ApiError ? e.body.detail : "Failed to load documents");
      });
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    queueMicrotask(() => load(signal));
    return () => { signal.cancelled = true; };
  }, [load]);

  const handleDismiss = useCallback(() => {
    setProcessing(null);
    setUploadOpen(false);
    const signal = { cancelled: false };
    load(signal);
  }, [load]);

  // When upload starts, close the drawer automatically
  const handleSubmitting = useCallback((state: UploadProcessingState) => {
    setProcessing(state);
    setUploadOpen(false);
  }, []);

  const readyCount      = documents?.filter((d) => d.status === "indexed").length ?? 0;
  const processingCount = documents?.filter((d) => d.status !== "indexed" && d.status !== "quarantined").length ?? 0;
  const failedCount     = documents?.filter((d) => d.status === "quarantined").length ?? 0;

  // Client-side filtering: free text across the searchable metadata fields,
  // plus an optional single-type facet. Source of truth is still the API's
  // role-filtered list (COMMON §c.1) — this never widens what a caller sees.
  const q = searchQuery.toLowerCase().trim();
  const visible = (documents ?? []).filter((d) => {
    if (typeFilter !== "all" && d.document_type !== typeFilter) return false;
    if (!q) return true;
    return (
      d.title.toLowerCase().includes(q) ||
      (d.equipment_id ?? "").toLowerCase().includes(q) ||
      d.department.toLowerCase().includes(q) ||
      d.document_type.toLowerCase().includes(q)
    );
  });

  return (
    <AppShell title="">
      <main className="w-full flex-1 pb-12">
        <div className="mx-auto max-w-[1400px]">

        {/* ── Page header ── */}
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-neutral-300">
            Plant knowledge
          </p>
          <h1 className="mt-1 text-2xl font-bold text-neutral-100">Evidence library</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-400">
            These are not stored files. Each source has been processed into extracted
            sections or image observations, tagged to equipment, and made retrievable
            for future investigations — within the access rules that came with the
            document.
          </p>
        </div>

        {/* ── Two-column body: library (left) + add-plant-knowledge rail (right) ── */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_480px] lg:-mr-6">

          {/* ═══ LEFT — library ═══ */}
          <div className="min-w-0">
            {/* Toolbar — search then type facets, one row (reference placement) */}
            {documents !== null && documents.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search title, equipment, department"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-72 rounded-md border border-neutral-700 bg-neutral-900 py-1.5 pl-8 pr-8 text-xs text-neutral-200 outline-none transition placeholder:text-neutral-600 focus:border-neutral-500"
                    aria-label="Search documents"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200"
                      aria-label="Clear search"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(["all", ...DOC_TYPES] as const).map((t) => {
                    const active = typeFilter === t;
                    const count =
                      t === "all"
                        ? visible.length
                        : documents.filter((d) => d.document_type === t).length;
                    if (t !== "all" && count === 0) return null;
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setTypeFilter(t)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition",
                          active
                            ? "border-[#c8f135] bg-neutral-800 text-white"
                            : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-600"
                        )}
                      >
                        {t !== "all" && (
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              active ? "bg-neutral-900/70" : docTypeAccent(t).dot
                            )}
                            aria-hidden
                          />
                        )}
                        {t === "all" ? "All" : DOC_TYPE_LABELS[t]}
                        <span className={active ? "text-white/70" : "text-neutral-500"}>{count}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="ml-auto flex flex-col items-end gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onExportLibrary}
                    disabled={exportBusy}
                    className="bg-neutral-900"
                  >
                    {exportBusy ? "Exporting…" : "Export Excel"}
                  </Button>
                  {exportError && (
                    <span role="alert" className="text-xs text-red-700 dark:text-red-400">
                      {exportError}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Stats + role-filter disclosure. Reveals a count only — never a
                withheld title — so it stays inside the frozen ACL contract
                (COMMON §c.1), which requires excluded documents not to appear. */}
            {documents !== null && (
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
                  <span className="font-bold text-neutral-100">{readyCount}</span>
                  <span className="text-neutral-400">indexed</span>
                </span>
                {processingCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 animate-pulse rounded-full bg-sky-500" aria-hidden />
                    <span className="font-bold text-neutral-100">{processingCount}</span>
                    <span className="text-neutral-400">processing</span>
                  </span>
                )}
                {failedCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-amber-500" aria-hidden />
                    <span className="font-bold text-neutral-100">{failedCount}</span>
                    <span className="text-neutral-400">failed</span>
                  </span>
                )}
                <span className="text-neutral-500">
                  {role && (
                    <>
                      Sources outside your clearance are withheld from this view and will not
                      be used for retrieval
                      {role ? <> (<span className="font-semibold text-neutral-300">{role}</span>)</> : null}.
                    </>
                  )}
                </span>
              </div>
            )}

            {/* ── Load error ── */}
            {loadError && (
              <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">{loadError}</p>
              </div>
            )}

            {/* ── Loading skeleton ── */}
            {documents === null && !loadError && (
              <div className="mt-5 space-y-2.5" aria-busy="true">
                <div className="h-20 animate-pulse rounded-lg bg-neutral-800" />
                <div className="h-20 animate-pulse rounded-lg bg-neutral-800" />
                <div className="h-20 animate-pulse rounded-lg bg-neutral-800" />
                <div className="h-20 animate-pulse rounded-lg bg-neutral-800" />
              </div>
            )}

            {/* Empty state — no sources at all */}
            {documents !== null && documents.length === 0 && (
              <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-12 text-center">
                <p className="text-base font-semibold text-neutral-200">
                  No documents in the evidence library
                </p>
                <p className="mt-1 text-sm text-neutral-400">
                  Upload manuals, SOPs, work orders, or equipment photos to build the evidence base
                </p>
              </div>
            )}

            {/* No results for the current query */}
            {documents !== null && documents.length > 0 && visible.length === 0 && (
              <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-10 text-center">
                <p className="text-sm text-neutral-400">
                  No sources match{" "}
                  {q ? (
                    <span className="font-semibold text-neutral-100">&ldquo;{searchQuery}&rdquo;</span>
                  ) : (
                    <span className="font-semibold text-neutral-100">
                      {DOC_TYPE_LABELS[typeFilter as DocumentType]}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Try equipment ID, title, or department
                </p>
              </div>
            )}

            {/* Cards — full width, one per row */}
            <div className="mt-3">
              <EvidenceCardList
                documents={visible}
                onOpen={(d) => setViewerId(d.document_id)}
              />
            </div>
          </div>

          {/* ═══ RIGHT — add plant knowledge rail ═══ */}
          <aside className="lg:sticky lg:top-16 lg:self-start">
            {canUpload ? (
              <div className="rounded-xl lg:rounded-r-none border border-neutral-800 bg-neutral-900 p-5 lg:pr-10">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                  Add plant knowledge
                </p>
                <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                  A source is queued, processed into sections, then becomes retrievable
                  evidence.
                </p>
                <div className="mt-4">
                  <UploadForm onSubmitting={handleSubmitting} compact />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-neutral-800 bg-neutral-800 p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                  Add plant knowledge
                </p>
                <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                  Document upload is available to engineers and admins.
                </p>
              </div>
            )}
          </aside>

        </div>

        </div>
      </main>

      <UploadProcessingModal state={processing} onDismiss={handleDismiss} />

      <ChunkViewer
        open={viewerId !== null}
        onOpenChange={(o) => { if (!o) setViewerId(null); }}
        documentId={viewerId}
      />
    </AppShell>
  );
}
