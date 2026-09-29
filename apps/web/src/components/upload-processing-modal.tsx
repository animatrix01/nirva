"use client";

/**
 * UploadProcessingModal
 *
 * Processing screen layout:
 *   ┌─────────────────────────────────────────┐
 *   │  [NIRVA logo, breathing]                │
 *   │  [Waveform bar — 16 animated bars]      │
 *   ├──────────────────┬──────────────────────┤
 *   │  file info strip │  stage list (right)  │
 *   └──────────────────┴──────────────────────┘
 *
 * Timing: STAGE_MS = 1100 ms/stage → 6 stages = ~6.6 s, 5 stages = ~5.5 s.
 * An extra 1 s "boot" delay fires before stage 0 to give the waveform time
 * to establish itself visually before progress starts.
 *
 * Architecture: backend upload is synchronous. Animation runs optimistically
 * in parallel with the HTTP POST. Response arrival gates the result panel.
 */

import { useEffect, useRef, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, Copy, FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentType, DocumentUploadResponse } from "@/lib/types";

// ─── Public interface ────────────────────────────────────────────────────────

export interface UploadProcessingState {
  fileName: string;
  rawFileName: string;
  isImage: boolean;
  resultPromise: Promise<DocumentUploadResponse>;
  meta: {
    docType: DocumentType;
    revision: string;
    department: string;
    equipmentId: string | null;
    effectiveDate: string;
  };
}

// ─── Stage definitions ────────────────────────────────────────────────────────

interface StageDef {
  key: string;
  label: string;
  operation: string;
}

const PDF_STAGES: StageDef[] = [
  { key: "received",     label: "Uploading",            operation: "Storing document securely" },
  { key: "parsing",      label: "Reading content",      operation: "Extracting text and structure" },
  { key: "chunking",     label: "Creating evidence",    operation: "Building searchable sections" },
  { key: "embedding",    label: "Indexing",             operation: "Making evidence retrievable" },
  { key: "verification", label: "Finalizing",           operation: "Applying access permissions" },
  { key: "ready",        label: "Ready",                operation: "Available for investigations" },
];

const IMAGE_STAGES: StageDef[] = [
  { key: "received",   label: "Uploading",              operation: "Storing equipment photo" },
  { key: "vision",     label: "Inspecting equipment",   operation: "AI analyzing visible condition" },
  { key: "extraction", label: "Recording observations", operation: "Detecting anomalies and features" },
  { key: "indexing",   label: "Indexing evidence",      operation: "Making observations searchable" },
  { key: "ready",      label: "Ready",                  operation: "Available for investigations" },
];

const STAGE_MS   = 1100;
const BOOT_DELAY = 1000;

// ─── Stage state ──────────────────────────────────────────────────────────────

type StageStatus = "pending" | "active" | "complete" | "error";
interface StageState { def: StageDef; status: StageStatus; }

function buildStages(isImage: boolean): StageState[] {
  return (isImage ? IMAGE_STAGES : PDF_STAGES).map((def) => ({
    def,
    status: "pending" as StageStatus,
  }));
}

// ─── Observation parsing (re-exported for ChunkViewer) ────────────────────────

export function parseVisionObservations(text: string): string[] {
  const cleaned = text
    .replace(/^Equipment photo[^.]*\(vision inspection\)\.\s*Observations:\s*/i, "")
    .trim();
  if (!cleaned || cleaned.startsWith("[")) return [];
  return cleaned.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

export function hasWarningKeyword(observations: string[]): boolean {
  const RE = /\b(leak|damage|corrosi|wear|crack|ruptur|fractur|misalign|overheat|defect|fail|anomal)\b/i;
  return observations.some((o) => RE.test(o));
}

// ─── Waveform component ───────────────────────────────────────────────────────

const BAR_COUNT = 16;

function Waveform({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W    = canvas.width;
    const H    = canvas.height;
    const gap  = 3;
    const barW = Math.floor((W - gap * (BAR_COUNT - 1)) / BAR_COUNT);
    const freqs  = Array.from({ length: BAR_COUNT }, (_, i) => 0.8 + i * 0.18);
    const phases = Array.from({ length: BAR_COUNT }, (_, i) => (i * Math.PI * 0.4));

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < BAR_COUNT; i++) {
        const x   = i * (barW + gap);
        const raw = 0.5 + 0.5 * Math.sin(t * freqs[i] * 0.001 + phases[i]);
        const minH = active ? 0.15 : 0.08;
        const maxH = active ? 1.0  : 0.22;
        const h    = (minH + raw * (maxH - minH)) * H;
        const y    = H - h;
        const centre = Math.abs(i - (BAR_COUNT - 1) / 2) < 2.5;

        if (active && centre) {
          ctx.fillStyle = "#B9FF52";
          ctx.globalAlpha = 0.85 + 0.15 * raw;
        } else {
          ctx.fillStyle = active ? "#44403c" : "#2a2826";
          ctx.globalAlpha = active ? 0.55 : 0.30;
        }
        ctx.fillRect(x, y, barW, h);
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      width={BAR_COUNT * 10 + (BAR_COUNT - 1) * 3}
      height={36}
      className="w-full"
      style={{ imageRendering: "pixelated" }}
      aria-hidden
    />
  );
}

// ─── Stage row ────────────────────────────────────────────────────────────────

function StageRow({ stage }: { stage: StageState }) {
  const { status, def } = stage;
  return (
    <div className="flex items-start gap-3" role="listitem" aria-label={`${def.label}: ${status}`}>
      <div className="mt-[2px] flex w-4 shrink-0 items-center justify-center">
        {status === "complete" && (
          <span className="text-[13px] font-bold text-[#B9FF52]" aria-hidden>✓</span>
        )}
        {status === "active" && (
          <span
            className="inline-block size-2 rounded-full bg-stone-200"
            aria-hidden
            style={{ animation: "nirva-breathe 1.1s ease-in-out infinite" }}
          />
        )}
        {status === "error" && (
          <span className="text-[13px] text-red-500" aria-hidden>✗</span>
        )}
        {status === "pending" && (
          <span className="inline-block size-[5px] rounded-full bg-stone-700" aria-hidden />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-[2px]">
        <span className={cn(
          "text-[13px] font-semibold leading-tight transition-colors duration-200",
          status === "active"   ? "text-white"     :
          status === "complete" ? "text-stone-500"  :
          status === "error"    ? "text-red-400"    : "text-stone-700"
        )}>
          {def.label}
        </span>
        {status === "active" && (
          <span className="text-[11px] leading-tight text-stone-500">{def.operation}</span>
        )}
      </div>
    </div>
  );
}

// ─── File info strip ──────────────────────────────────────────────────────────

function FileInfoStrip({ state }: { state: UploadProcessingState }) {
  const ext  = state.rawFileName.split(".").pop()?.toUpperCase() ?? "FILE";
  const Icon = state.isImage ? ImageIcon : FileText;
  const tags = [
    ext,
    state.meta.equipmentId ?? null,
    state.meta.department  || null,
    state.meta.revision    || null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex items-center gap-3 rounded border border-stone-800 bg-stone-900/50 px-4 py-2.5">
      <Icon className="size-3.5 shrink-0 text-stone-600" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-stone-200">
        {state.fileName}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        {tags.map((t, i) => (
          <span key={i} className="text-[10px] font-semibold uppercase tracking-widest text-stone-600">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Result view ──────────────────────────────────────────────────────────────

function ResultView({
  result,
  state,
  onDismiss,
}: {
  result: DocumentUploadResponse;
  state: UploadProcessingState;
  onDismiss: () => void;
}) {
  const [copied,     setCopied]     = useState(false);
  const [visionObs,  setVisionObs]  = useState<string[] | null>(null);
  const [loadingObs, setLoadingObs] = useState(false);
  const { meta, fileName, isImage } = state;
  const hasChunks    = result.chunks > 0;
  const evidenceReady = result.status === "indexed" && hasChunks;

  // Fetch vision observations if this is an image with chunks
  useEffect(() => {
    if (!isImage || !hasChunks) return;
    setLoadingObs(true);
    import("@/lib/api").then(({ getDocumentContent }) => {
      getDocumentContent(result.document_id)
        .then((content) => {
          const visionChunk = content.chunks.find((c) =>
            /vision inspection/i.test(c.section ?? "")
          );
          if (visionChunk) {
            const obs = parseVisionObservations(visionChunk.text);
            setVisionObs(obs);
          }
          setLoadingObs(false);
        })
        .catch(() => setLoadingObs(false));
    }).catch(() => setLoadingObs(false));
  }, [isImage, hasChunks, result.document_id]);

  const copyHash = () => {
    void navigator.clipboard.writeText(result.content_hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const anomalyCount = visionObs ? visionObs.filter((o) => hasWarningKeyword([o])).length : 0;

  // ── Duplicate ──
  if (result.duplicate) {
    return (
      <div className="animate-fade-up flex w-full flex-col gap-5">
        <div className="flex items-center gap-2.5">
          <AlertCircle className="size-4 shrink-0 text-amber-400" aria-hidden />
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            Already indexed
          </span>
        </div>

        <div className="rounded-lg border border-amber-800/40 bg-amber-950/15 px-4 py-3">
          <p className="text-sm font-semibold text-amber-200">{fileName}</p>
          <p className="mt-1 text-xs text-stone-400">
            Exact content match. No reprocessing needed — evidence is already searchable in investigations.
          </p>
        </div>

        <div className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-stone-500">Content hash</span>
          <div className="flex items-center gap-2">
            <code className="font-mono text-stone-600 break-all">{result.content_hash}</code>
            <button type="button" onClick={copyHash}
              className="shrink-0 rounded p-1 text-stone-600 transition hover:text-stone-300"
              aria-label="Copy hash">
              <Copy className="size-3" />
            </button>
            {copied && <span className="text-stone-600">Copied</span>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md bg-[#B9FF52] px-4 py-2 text-sm font-semibold text-black hover:bg-[#A8EF47]"
          >
            Back to library
          </button>
        </div>
      </div>
    );
  }

  // ── Normal result ──
  return (
    <div className="animate-fade-up flex w-full flex-col gap-5">

      {/* Status header */}
      <div className="flex items-center gap-2.5">
        <CheckCircle2 className="size-4 shrink-0 text-[#B9FF52]" aria-hidden />
        <span className="text-xs font-bold uppercase tracking-widest text-[#B9FF52]">
          {evidenceReady ? "Indexed" : "Processing complete"}
        </span>
      </div>

      {/* Document name + status pill */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-lg font-bold leading-snug text-white break-words flex-1">
          {fileName}
        </p>
        {evidenceReady && (
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded border border-emerald-800/50 bg-emerald-950/30 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
            Searchable
          </span>
        )}
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
        <div className="flex items-baseline gap-2">
          <span className="w-20 shrink-0 text-stone-500">Type</span>
          <span className="font-medium capitalize text-stone-200">{meta.docType.replace("_", " ")}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="w-20 shrink-0 text-stone-500">Revision</span>
          <span className="font-medium text-stone-200">{meta.revision || "—"}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="w-20 shrink-0 text-stone-500">Department</span>
          <span className="font-medium text-stone-200">{meta.department || "—"}</span>
        </div>
        {meta.equipmentId && (
          <div className="flex items-baseline gap-2">
            <span className="w-20 shrink-0 text-stone-500">Equipment</span>
            <span className="font-mono font-semibold text-[#B9FF52]">{meta.equipmentId}</span>
          </div>
        )}
        {hasChunks && (
          <div className="flex items-baseline gap-2">
            <span className="w-20 shrink-0 text-stone-500">Evidence</span>
            <span className="font-medium text-stone-200">{result.chunks} source{result.chunks !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Vision observations — images only */}
      {isImage && evidenceReady && (
        <div className="border-t border-stone-800 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
              Vision Inspection
            </p>
            {anomalyCount > 0 && (
              <span className="flex items-center gap-1 rounded border border-amber-800/50 bg-amber-950/30 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                <AlertTriangle className="size-2.5" aria-hidden />
                {anomalyCount} anomal{anomalyCount === 1 ? "y" : "ies"}
              </span>
            )}
          </div>

          {loadingObs ? (
            <p className="text-xs text-stone-500">Loading observations…</p>
          ) : visionObs && visionObs.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {visionObs.map((obs, i) => {
                const warn = hasWarningKeyword([obs]);
                return (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={cn("mt-[3px] shrink-0 text-[11px]", warn ? "text-amber-400" : "text-stone-600")}
                      aria-hidden
                    >
                      {warn ? "▲" : "–"}
                    </span>
                    <span className={warn ? "text-amber-200" : "text-stone-200"}>{obs}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-stone-600">No observations recorded</p>
          )}
        </div>
      )}

      {/* Technical details (collapsible) */}
      <div className="border-t border-stone-800 pt-3">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-xs font-bold uppercase tracking-widest text-stone-600 transition hover:text-stone-400">
            <span>Technical details</span>
            <ChevronDown className="size-3 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-2 flex flex-col gap-1.5 text-xs">
            <div className="flex items-baseline gap-2">
              <span className="w-28 shrink-0 text-stone-500">Document ID</span>
              <code className="font-mono text-stone-400">{result.document_id}</code>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="w-28 shrink-0 text-stone-500">Content hash</span>
              <div className="flex items-center gap-2">
                <code className="font-mono text-stone-400 break-all">{result.content_hash.slice(0, 32)}…</code>
                <button type="button" onClick={copyHash}
                  className="shrink-0 rounded p-0.5 text-stone-600 transition hover:text-stone-300"
                  aria-label="Copy hash">
                  <Copy className="size-3" />
                </button>
                {copied && <span className="text-stone-500">Copied</span>}
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="w-28 shrink-0 text-stone-500">Status</span>
              <span className="text-stone-400">{result.status}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="w-28 shrink-0 text-stone-500">Chunks</span>
              <span className="text-stone-400">{result.chunks}</span>
            </div>
          </div>
        </details>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md bg-[#B9FF52] px-4 py-2 text-sm font-semibold text-black hover:bg-[#A8EF47]"
        >
          View in library
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 transition hover:bg-neutral-800"
        >
          Upload another
        </button>
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface Props {
  state: UploadProcessingState | null;
  onDismiss: () => void;
}

type Phase = "animating" | "result" | "error";

export function UploadProcessingModal({ state, onDismiss }: Props) {
  const [phase,    setPhase]    = useState<Phase>("animating");
  const [stages,   setStages]   = useState<StageState[]>([]);
  const [result,   setResult]   = useState<DocumentUploadResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const animDoneRef = useRef(false);
  const resultRef   = useRef<DocumentUploadResponse | null>(null);
  const errorRef    = useRef<string | null>(null);

  useEffect(() => {
    if (!state) return;

    animDoneRef.current = false;
    resultRef.current   = null;
    errorRef.current    = null;
    setResult(null);
    setErrorMsg(null);
    setPhase("animating");
    setStages(buildStages(state.isImage));

    const defs = state.isImage ? IMAGE_STAGES : PDF_STAGES;
    let cancelled = false;

    async function runAnimation() {
      await new Promise<void>((r) => setTimeout(r, BOOT_DELAY));
      if (cancelled) return;

      for (let i = 0; i < defs.length; i++) {
        if (cancelled) return;
        setStages((prev) =>
          prev.map((s, idx) => ({
            ...s,
            status: idx < i ? "complete" : idx === i ? "active" : "pending",
          }))
        );
        await new Promise<void>((r) => setTimeout(r, STAGE_MS));
      }
      if (cancelled) return;

      setStages((prev) => prev.map((s) => ({ ...s, status: "complete" })));
      animDoneRef.current = true;

      if (resultRef.current !== null) {
        setResult(resultRef.current);
        setPhase("result");
      } else if (errorRef.current !== null) {
        setErrorMsg(errorRef.current);
        setPhase("error");
      }
    }

    void runAnimation();

    state.resultPromise
      .then((res) => {
        resultRef.current = res;
        if (animDoneRef.current) { setResult(res); setPhase("result"); }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Upload failed — please try again.";
        errorRef.current = msg;
        if (animDoneRef.current) { setErrorMsg(msg); setPhase("error"); }
      });

    return () => { cancelled = true; };
  }, [state]);

  if (!state) return null;

  const activeStage    = stages.find((s) => s.status === "active");
  const waveformActive = phase === "animating" && activeStage !== undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#1a1917]/97 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Document processing"
    >
      <div className="flex w-full max-w-2xl flex-col gap-0">

        {/* Animating phase */}
        {phase === "animating" && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-[200px_1fr] gap-8 items-start">
              {/* Logo + waveform */}
              <div className="flex flex-col items-center gap-4">
                <div className="animate-nirva-breathe" aria-hidden>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/nirva_logo_-removebg-preview.png"
                    alt="NIRVA"
                    className="object-contain"
                    style={{ width: 80, height: 80 }}
                  />
                </div>
                <div className="h-4 w-px bg-stone-800" aria-hidden />
                <div className="w-full px-1">
                  <Waveform active={waveformActive} />
                </div>
              </div>

              {/* Stage list */}
              <div
                className="flex flex-col gap-3 border-l border-stone-800 pl-8 pt-1"
                role="list"
                aria-label="Processing stages"
              >
                {stages.map((stage) => (
                  <StageRow key={stage.def.key} stage={stage} />
                ))}
              </div>
            </div>

            <FileInfoStrip state={state} />
          </div>
        )}

        {/* Result phase */}
        {phase === "result" && result && (
          <ResultView result={result} state={state} onDismiss={onDismiss} />
        )}

        {/* Error phase */}
        {phase === "error" && (
          <div className="animate-fade-up flex w-full flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="size-4 shrink-0 text-red-400" aria-hidden />
              <span className="text-xs font-bold uppercase tracking-widest text-red-400">
                Upload failed
              </span>
            </div>
            <p className="text-sm text-stone-400 leading-relaxed">{errorMsg}</p>
            <button
              type="button"
              onClick={onDismiss}
              className="self-start rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-300 transition hover:bg-neutral-800"
            >
              Back to upload
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
