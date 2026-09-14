"use client";

/**
 * Documents page — library table + upload form + evidence viewer.
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
 * Every document (not just vision chunks) fetches its stored original via the
 * authed /file endpoint. If the blob is an image it is rendered in the viewer
 * header. Non-image documents skip the preview gracefully.
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, FileText, Image as ImageIcon, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell } from "@/components/app-shell";
import {
  UploadProcessingModal,
  parseVisionObservations,
  hasWarningKeyword,
} from "@/components/upload-processing-modal";
import type { UploadProcessingState } from "@/components/upload-processing-modal";
import { useStoredAuth } from "@/lib/auth-client";
import {
  ApiError,
  getDocumentContent,
  getDocumentFile,
  listDocuments,
  uploadDocument,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ROLES,
  type DocumentChunk,
  type DocumentContentResponse,
  type DocumentOut,
  type DocumentType,
  type DocumentUploadResponse,
} from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPES: DocumentType[] = ["manual", "sop", "work_order", "incident", "data"];

const ROLE_LABELS: Record<string, string> = {
  engineer:       "Engineer",
  safety_officer: "Safety Officer",
  supervisor:     "Supervisor",
  admin:          "Admin",
};

// ─── Mock chunk data ──────────────────────────────────────────────────────────
//
// Mirrors the _MOCK_EVIDENCE structure in apps/api/app/runner.py exactly.
// Used only when Qdrant is offline (backend returns dev-placeholder chunks).
// Each mock chunk has the same fields as a real Qdrant payload + score/source.
//
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
    // Image document → mirror the vision inspection chunk the production
    // pipeline creates via describe_image() + VLM_OBSERVATIONS_PROMPT.
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

  // Text document → mirror the three retrieval chunks from _MOCK_EVIDENCE
  // adapted to the actual document's metadata.
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
      text:           `Vibration reading: 4.2 mm/s RMS (alert threshold 3.5 mm/s, shutdown 7.0 mm/s). Bearing temperature: 68 °C (normal range ≤75 °C). Seal flush flow: 1.8 L/min (spec 2.0 L/min — slightly below spec, monitor). Recommendation: schedule seal inspection within 14 days. Alignment check returned to service still misaligned per work order WO-2026-0892.`,
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

function statusBadgeClass(status: string): string {
  if (status === "indexed")     return "bg-emerald-950 text-emerald-300";
  if (status === "quarantined") return "bg-amber-950 text-amber-300";
  return "";
}

export function isImageFile(file: { name: string; type: string }): boolean {
  return (
    file.type.startsWith("image/") ||
    [".jpg", ".jpeg", ".png"].some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    )
  );
}

function isDocImage(doc: DocumentOut): boolean {
  // Heuristic: equipment_id present and docType is "data" or title contains
  // image-like words. In production, file_path suffix is definitive but that
  // field is not in DocumentOut. We use this only for mock chunk generation.
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

function docTypeLabel(t: string): string {
  return t.replace(/_/g, " ");
}

// ─── DocumentsTable ───────────────────────────────────────────────────────────

export function DocumentsTable({
  documents,
  onOpen,
}: {
  documents: DocumentOut[];
  onOpen: (doc: DocumentOut) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-800">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-stone-800 bg-stone-900/70 text-stone-500">
          <tr>
            <th className="px-3 py-2.5 font-medium">Title</th>
            <th className="px-3 py-2.5 font-medium">Type</th>
            <th className="px-3 py-2.5 font-medium">Revision</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Department</th>
            <th className="px-3 py-2.5 font-medium">Equipment</th>
            <th className="px-3 py-2.5 font-medium">Uploaded</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr
              key={d.document_id}
              className="border-t border-stone-800/60 transition-colors hover:bg-stone-900/30"
            >
              <td className="max-w-52 truncate px-3 py-2 font-medium text-stone-200">
                {d.title}
              </td>
              <td className="px-3 py-2 capitalize text-stone-400">
                {docTypeLabel(d.document_type)}
              </td>
              <td className="px-3 py-2 text-stone-400">{d.revision}</td>
              <td className="px-3 py-2">
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wide",
                    statusBadgeClass(d.status)
                  )}
                >
                  {d.status}
                </Badge>
              </td>
              <td className="px-3 py-2 text-stone-400">{d.department}</td>
              <td className="px-3 py-2 font-medium text-stone-300">
                {d.equipment_id ?? "—"}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-stone-500">
                {new Date(d.uploaded_at).toLocaleDateString()}
              </td>
              <td className="px-3 py-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 border-stone-700 bg-transparent text-xs text-stone-300 hover:border-stone-500 hover:bg-stone-800 hover:text-stone-100"
                  onClick={() => onOpen(d)}
                  aria-label={`View evidence for ${d.title}`}
                >
                  Evidence
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Evidence viewer components ───────────────────────────────────────────────

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-stone-800">
        <div
          className="h-full rounded-full bg-[#c8f135]"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <span className="text-[12px] font-semibold tabular-nums text-[#c8f135]">{pct}%</span>
    </div>
  );
}

// ── EvidRow — key/value row used in the details panel ─────────────────────────

function EvidRow({
  label,
  value,
  mono,
  highlight,
  accent,
  truncate: doTruncate,
  capitalize: doCap,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  accent?: boolean;
  truncate?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-[11px]">
      <span className="w-[72px] shrink-0 text-stone-500">{label}</span>
      <span
        className={cn(
          "min-w-0 leading-snug",
          mono      && "font-mono text-[10px]",
          accent     ? "font-semibold text-[#c8f135]" :
          highlight  ? "font-semibold text-stone-100"  : "text-stone-300",
          doTruncate && "truncate",
          doCap      && "capitalize"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ── VisionObservationList ─────────────────────────────────────────────────────

function VisionObservationList({
  text,
  equipmentId,
}: {
  text: string;
  equipmentId: string | null | undefined;
}) {
  const parsed = parseVisionObservations(text);
  const isDev  = parsed.length === 0; // blank parse = dev placeholder text

  // Use real parsed observations when available; fall back to mock sentences
  // extracted directly from the mock chunk text we already built above.
  // This avoids a second layer of mocking — the mock chunk text already
  // contains realistic observation sentences.
  const sentences = isDev ? [] : parsed;

  // Even when isDev, the mock chunk we injected already has real-looking text,
  // so just parse it directly regardless.
  const items = parseVisionObservations(text);
  const warnCount = items.filter((o) => hasWarningKeyword([o])).length;
  const isMock = text.includes("(vision inspection)") && items.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
          Equipment observations
        </p>
        {warnCount > 0 && (
          <span className="flex items-center gap-1 rounded bg-amber-950 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
            <AlertTriangle className="size-3" aria-hidden />
            {warnCount} anomal{warnCount === 1 ? "y" : "ies"}
          </span>
        )}
      </div>

      {/* Observation list */}
      {items.length > 0 ? (
        <ul className="flex flex-col gap-2" role="list">
          {items.map((obs, i) => {
            const warn = hasWarningKeyword([obs]);
            return (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-[3px] shrink-0 text-[11px]",
                    warn ? "text-amber-400" : "text-stone-600"
                  )}
                  aria-hidden
                >
                  {warn ? "⚠" : "·"}
                </span>
                <span
                  className={cn(
                    "text-sm leading-relaxed",
                    warn ? "text-amber-100" : "text-stone-200"
                  )}
                >
                  {obs}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        // Truly empty — dev placeholder with no parsable observations
        <p className="text-xs text-stone-600 italic">
          Vision model offline — observations unavailable in dev mode.
        </p>
      )}

      {/* Equipment line */}
      {equipmentId && (
        <div className="flex items-center gap-2 border-t border-stone-800/50 pt-2 text-[11px]">
          <span className="text-stone-600">Equipment</span>
          <span className="font-medium text-stone-300">{equipmentId}</span>
        </div>
      )}

      {/* Demo label */}
      {isMock && sentences.length > 0 && (
        <p className="text-[10px] text-stone-700 italic">
          Demo observations — vision model offline. Production shows real inspection output.
        </p>
      )}
    </div>
  );
}

// ── TextPassage ───────────────────────────────────────────────────────────────

function TextPassage({ text }: { text: string }) {
  const [exp, setExp] = useState(false);
  const MAX = 560;
  const long  = text.length > MAX + 60;
  const shown = !long || exp ? text : text.slice(0, MAX) + "…";

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm leading-relaxed text-stone-200 whitespace-pre-wrap">{shown}</p>
      {long && (
        <button
          type="button"
          onClick={() => setExp((v) => !v)}
          className="self-start text-[11px] text-stone-600 transition hover:text-stone-400"
        >
          {exp ? "Show less ↑" : `Show full passage (${text.length} chars) ↓`}
        </button>
      )}
    </div>
  );
}

// ── SourceTypePill ────────────────────────────────────────────────────────────

function SourceTypePill({ source }: { source: string | undefined }) {
  if (source === "tool") {
    return (
      <span className="rounded bg-blue-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-blue-400">
        Tool result
      </span>
    );
  }
  if (source === "retrieval") {
    return (
      <span className="rounded bg-stone-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
        Retrieval
      </span>
    );
  }
  return null;
}

// ── ChunkCard ─────────────────────────────────────────────────────────────────

function ChunkCard({
  chunk,
  doc,
  imageUrl,
  isMock,
}: {
  chunk: MockChunk;
  doc: DocumentOut;
  imageUrl: string | null;
  isMock: boolean;
}) {
  const [techOpen, setTechOpen] = useState(false);
  const vision = isVisionChunk(chunk);
  const tool   = isToolChunk(chunk);

  const sectionParts = chunk.section
    ? chunk.section.split(" > ").map((s) => s.trim())
    : [];
  const leafSection = sectionParts[sectionParts.length - 1] ?? null;

  // Score: use chunk-level score if present (mock and production both carry it)
  const score = chunk.score ?? null;

  return (
    <article className="overflow-hidden rounded-lg border border-stone-800 bg-stone-900/25">

      {/* ── Locator bar ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-stone-800 bg-stone-900/60 px-4 py-2.5">
        {chunk.page != null && (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
            Page {chunk.page}
          </span>
        )}
        {sectionParts.length > 0 && (
          <ol className="flex min-w-0 flex-wrap items-center gap-1" aria-label="Section path">
            {sectionParts.map((part, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-stone-700" aria-hidden>›</span>}
                <span
                  className={cn(
                    "text-[11px]",
                    i === sectionParts.length - 1
                      ? "font-medium text-stone-300"
                      : "text-stone-600"
                  )}
                >
                  {part}
                </span>
              </li>
            ))}
          </ol>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isMock && (
            <span className="rounded bg-stone-900 px-2 py-0.5 text-[10px] font-medium text-stone-600 border border-stone-800">
              Demo
            </span>
          )}
          {vision && (
            <span className="rounded bg-stone-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
              Vision
            </span>
          )}
          <SourceTypePill source={chunk.source} />
        </div>
      </div>

      {/* ── Two-panel body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px]">

        {/* LEFT — source content */}
        <div className="flex flex-col gap-4 px-5 py-4">
          {/* Image preview for vision chunks */}
          {vision && imageUrl && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-stone-600">
                Stored image
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={`Equipment image — ${doc.title}`}
                className="max-h-60 w-auto rounded border border-stone-800 bg-stone-950 object-contain"
              />
            </div>
          )}

          {vision ? (
            <VisionObservationList
              text={chunk.text}
              equipmentId={doc.equipment_id}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {tool && (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-500">
                  Tool result
                </p>
              )}
              <TextPassage text={chunk.text} />
            </div>
          )}
        </div>

        {/* RIGHT — evidence details */}
        <div className="flex flex-col border-t border-stone-800 lg:border-t-0 lg:border-l lg:border-stone-800">

          {/* SOURCE */}
          <div className="border-b border-stone-800/60 bg-stone-900/50 px-4 py-3">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-3.5 w-[3px] rounded-full bg-[#c8f135]" aria-hidden />
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-300">
                Source
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <EvidRow label="Document"   value={chunk.document_title ?? doc.title} highlight />
              <EvidRow label="Type"       value={docTypeLabel(chunk.document_type ?? doc.document_type)} capitalize />
              <EvidRow label="Revision"   value={chunk.revision ?? doc.revision} />
              {doc.department   && <EvidRow label="Department" value={doc.department} />}
              {doc.equipment_id && <EvidRow label="Equipment"  value={doc.equipment_id} accent />}
              {leafSection && !vision && !tool && (
                <EvidRow label="Section" value={leafSection} />
              )}
              {chunk.page != null && (
                <EvidRow label="Page" value={String(chunk.page)} highlight />
              )}
            </div>
          </div>

          {/* RETRIEVAL */}
          <div className="border-b border-stone-800/60 bg-stone-950/40 px-4 py-3">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-3.5 w-[3px] rounded-full bg-blue-500" aria-hidden />
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-300">
                Retrieval
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {tool ? (
                <>
                  <EvidRow label="Method" value="Read-only operational tool" highlight />
                  <EvidRow label="Reason" value="Asset / inventory / memory lookup" />
                </>
              ) : (
                <>
                  <EvidRow label="Method" value="Hybrid dense + sparse" highlight />
                  <EvidRow label="Index"  value="nirva_chunks · Qdrant" />
                </>
              )}
              {score !== null && (
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="w-[72px] shrink-0 text-stone-500">Score</span>
                  <ScoreBar score={score} />
                </div>
              )}
              <EvidRow label="ACL" value={doc.confidentiality_level} capitalize />
            </div>
          </div>

          {/* TECHNICAL (collapsible) */}
          <div className="px-4 py-3">
            <button
              type="button"
              onClick={() => setTechOpen((v) => !v)}
              className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-stone-600 transition hover:text-stone-400"
              aria-expanded={techOpen}
            >
              <span>Technical details</span>
              {techOpen
                ? <ChevronUp   className="size-3" aria-hidden />
                : <ChevronDown className="size-3" aria-hidden />
              }
            </button>

            {techOpen && (
              <div className="mt-2 flex flex-col gap-1.5">
                <EvidRow label="Chunk ID" value={chunk.chunk_id}      mono truncate />
                <EvidRow label="Doc ID"   value={doc.document_id}     mono truncate />
                <EvidRow label="Hash"     value={doc.content_hash ? doc.content_hash.slice(0, 16) + "…" : "—"} mono />
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Main ChunkViewer ──────────────────────────────────────────────────────────

export function ChunkViewer({
  open,
  onOpenChange,
  documentId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
}) {
  const [content,  setContent]  = useState<DocumentContentResponse | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !documentId) return;
    const signal  = { cancelled: false };
    let blobUrl: string | null = null;

    queueMicrotask(() => {
      void getDocumentContent(documentId)
        .then((c) => {
          if (!signal.cancelled) { setContent(c); setError(null); }

          // Always attempt to fetch the stored original — the backend serves
          // the raw file bytes regardless of document type. Non-image mimes
          // are silently ignored below.
          return getDocumentFile(documentId)
            .then((blob) => {
              if (signal.cancelled) return;
              if (blob.type.startsWith("image/")) {
                blobUrl = URL.createObjectURL(blob);
                setImageUrl(blobUrl);
              }
              // PDF / CSV: no preview, chunks only.
            })
            .catch(() => {
              // File missing or endpoint error — degrade gracefully.
            });
        })
        .catch((e: unknown) => {
          if (!signal.cancelled)
            setError(
              e instanceof ApiError
                ? e.body.detail
                : "Failed to load document content"
            );
        });
    });

    return () => {
      signal.cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setImageUrl(null);
    };
  }, [open, documentId]);

  // Stale guard — hide old content while the new document loads
  const stale  = content !== null && documentId !== content.document.document_id;
  const shown  = stale ? null : content;
  const doc    = shown?.document ?? null;

  // ── Chunk processing ───────────────────────────────────────────────────────
  // Detect dev-placeholder response and replace with realistic mock chunks.
  const rawChunks     = shown?.chunks ?? [];
  const hasPlaceholder = rawChunks.some(isPlaceholderChunk);
  const isMock         = hasPlaceholder && doc !== null;

  const effectiveChunks: MockChunk[] = isMock && doc
    ? buildMockChunks(doc)
    : (rawChunks as MockChunk[]);

  // Classify into vision / retrieval / tool sections
  const visionChunks    = effectiveChunks.filter(isVisionChunk);
  const toolChunks      = effectiveChunks.filter((c) => !isVisionChunk(c) && isToolChunk(c));
  const retrievalChunks = effectiveChunks.filter((c) => !isVisionChunk(c) && !isToolChunk(c));

  const totalSources = effectiveChunks.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col overflow-hidden p-0 !max-w-none"
        style={{ width: "min(98vw, 1320px)", maxHeight: "92vh" }}
      >
        {/* ── HEADER ── */}
        <DialogHeader className="shrink-0 border-b border-stone-800 px-6 pt-5 pb-4">
          <div className="flex items-start gap-4">
            {/* Document identity */}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <DialogTitle className="flex items-center gap-2 text-[15px] font-semibold leading-snug text-stone-100">
                {/* Doc type icon */}
                {doc && isDocImage(doc)
                  ? <ImageIcon className="size-4 shrink-0 text-stone-500" aria-hidden />
                  : <FileText  className="size-4 shrink-0 text-stone-500" aria-hidden />
                }
                {doc?.title ?? "Document"}
              </DialogTitle>
              {doc && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-stone-500">
                  <span>{doc.revision}</span>
                  <span aria-hidden>·</span>
                  <span className="capitalize">{docTypeLabel(doc.document_type)}</span>
                  <span aria-hidden>·</span>
                  <span>{doc.confidentiality_level}</span>
                  {doc.department && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{doc.department}</span>
                    </>
                  )}
                  {doc.equipment_id && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="font-semibold text-stone-300">{doc.equipment_id}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Stats */}
            {shown && (
              <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                <span className="text-[13px] font-semibold text-stone-200">
                  {totalSources} source{totalSources !== 1 ? "s" : ""}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-stone-600">
                  {isMock ? "demo data" : `${rawChunks.length} indexed`}
                </span>
              </div>
            )}
          </div>

          {/* Image preview — header-level, shown for all image documents */}
          {imageUrl && (
            <div className="mt-4 flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={`Stored image — ${doc?.title ?? "document"}`}
                className="max-h-80 w-auto max-w-[55%] rounded border border-stone-800 bg-stone-950 object-contain"
              />
              <div className="flex flex-col gap-1 pt-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-600">
                  Stored original
                </p>
                <p className="text-xs text-stone-500">
                  {doc?.title}
                </p>
                {doc?.equipment_id && (
                  <p className="text-xs text-stone-400 font-medium">
                    Equipment · {doc.equipment_id}
                  </p>
                )}
              </div>
            </div>
          )}

          {!shown && !error && (
            <p className="mt-3 text-xs text-stone-600" aria-busy="true">
              Loading evidence…
            </p>
          )}
        </DialogHeader>

        {/* ── BODY ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-8">

          {error && (
            <p role="alert" className="text-sm text-red-400">{error}</p>
          )}



          {/* ── VISION INSPECTION section ── */}
          {visionChunks.length > 0 && doc && (
            <section>
              <SectionHeading
                label="Vision inspection"
                count={visionChunks.length}
                detail="Equipment photo · VLM observation recording"
              />
              <div className="flex flex-col gap-4">
                {visionChunks.map((c) => (
                  <ChunkCard
                    key={c.chunk_id}
                    chunk={c}
                    doc={doc}
                    imageUrl={imageUrl}
                    isMock={isMock}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── DOCUMENT SOURCES section ── */}
          {retrievalChunks.length > 0 && doc && (
            <section>
              <SectionHeading
                label="Document sources"
                count={retrievalChunks.length}
                detail="Hybrid dense + sparse retrieval · ACL-filtered"
              />
              <div className="flex flex-col gap-4">
                {retrievalChunks.map((c) => (
                  <ChunkCard
                    key={c.chunk_id}
                    chunk={c}
                    doc={doc}
                    imageUrl={null}
                    isMock={isMock}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── TOOL RESULTS section ── */}
          {toolChunks.length > 0 && doc && (
            <section>
              <SectionHeading
                label="Tool results"
                count={toolChunks.length}
                detail="Read-only operational lookups · asset history · inventory"
              />
              <div className="flex flex-col gap-4">
                {toolChunks.map((c) => (
                  <ChunkCard
                    key={c.chunk_id}
                    chunk={c}
                    doc={doc}
                    imageUrl={null}
                    isMock={isMock}
                  />
                ))}
              </div>
            </section>
          )}

          {shown && effectiveChunks.length === 0 && (
            <p className="text-sm text-stone-600">No indexed chunks for this document.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({
  label,
  count,
  detail,
}: {
  label: string;
  count: number;
  detail: string;
}) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">
        {label}
      </h3>
      <span className="text-[10px] text-stone-700">
        {count} source{count !== 1 ? "s" : ""}
      </span>
      <span className="hidden text-[10px] text-stone-700 sm:inline">· {detail}</span>
    </div>
  );
}

// ─── UploadForm ───────────────────────────────────────────────────────────────

export function UploadForm({
  onSubmitting,
}: {
  onSubmitting: (state: UploadProcessingState) => void;
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
      if (!file) { setError("Choose a file to upload."); return; }

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

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-file">File</Label>
          <Input
            id="doc-file"
            type="file"
            accept=".pdf,.csv,.jpg,.jpeg,.png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && isImageFile(file) && (
            <p className="text-xs text-stone-500">
              Photo — vision inspection will record equipment observations at ingestion.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-title">Title</Label>
          <Input
            id="doc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-type">Type</Label>
          <Select value={docType} onValueChange={(v) => setDocType(v as DocumentType)}>
            <SelectTrigger id="doc-type" aria-label="Document type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-revision">Revision</Label>
          <Input
            id="doc-revision"
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-date">Effective date</Label>
          <Input
            id="doc-date"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffDate(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-dept">Department</Label>
          <Input
            id="doc-dept"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="doc-equipment">Equipment ID (optional)</Label>
          <Input
            id="doc-equipment"
            value={equipmentId}
            onChange={(e) => setEquipmentId(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label>Allowed roles</Label>
          <div className="flex flex-wrap gap-2 pt-1">
            {ROLES.map((r) => (
              <label key={r} className="flex items-center gap-1.5 text-xs text-stone-300">
                <input
                  type="checkbox"
                  checked={allowedRoles.includes(r)}
                  onChange={() => toggleRole(r)}
                />
                {ROLE_LABELS[r]}
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">{error}</p>
      )}

      <Button type="submit" className="self-start">
        Upload
      </Button>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const auth      = useStoredAuth();
  const role      = auth?.user.role ?? "";
  const canUpload = role === "engineer" || role === "admin";

  const [documents,  setDocuments]  = useState<DocumentOut[] | null>(null);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [viewerId,   setViewerId]   = useState<string | null>(null);
  const [processing, setProcessing] = useState<UploadProcessingState | null>(null);

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
    const signal = { cancelled: false };
    load(signal);
  }, [load]);

  return (
    <AppShell title="Document library">
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">

        {loadError && (
          <p role="alert" className="mb-4 text-sm text-red-400">{loadError}</p>
        )}

        {!documents && !loadError ? (
          <div className="h-48 animate-pulse rounded bg-stone-900/50" aria-busy="true" />
        ) : (
          <div className="flex flex-col gap-8">

            {/* ── Upload — always at the top so it stays reachable regardless of library size ── */}
            {canUpload && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-300">
                  Upload document
                </h2>
                <div className="rounded-lg border border-stone-800 p-5">
                  <UploadForm onSubmitting={setProcessing} />
                </div>
              </section>
            )}

            {/* ── Divider ── */}
            <div className="h-px bg-stone-800" aria-hidden />

            {/* ── Library — below upload, grows as more documents are added ── */}
            <section>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-300">
                  Library
                </h2>
                <span className="text-xs text-stone-600">
                  {documents?.length ?? 0} document{documents?.length !== 1 ? "s" : ""} · ACL-filtered for your role
                </span>
              </div>

              {documents && documents.length === 0 && (
                <p className="rounded-lg border border-stone-800 bg-stone-900/30 px-5 py-6 text-sm text-stone-600">
                  No documents yet — upload the first one above.
                </p>
              )}

              {documents && documents.length > 0 && (
                <DocumentsTable
                  documents={documents}
                  onOpen={(d) => setViewerId(d.document_id)}
                />
              )}
            </section>

            {/* Non-engineer/admin fallback */}
            {!canUpload && (
              <p className="text-sm text-stone-600">
                Document upload is restricted to engineers and admins.
              </p>
            )}

          </div>
        )}
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
