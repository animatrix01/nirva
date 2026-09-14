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
import { AlertCircle, CheckCircle2, Copy, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  { key: "received",     label: "Upload received",      operation: "File stored · SHA-256 dedup check" },
  { key: "parsing",      label: "Document parsing",     operation: "Docling layout extraction · page structure" },
  { key: "chunking",     label: "Structural chunking",  operation: "Hierarchy-preserved sections · §c.4 metadata" },
  { key: "embedding",    label: "Embedding & indexing", operation: "Dense + sparse vectors · Qdrant upsert" },
  { key: "verification", label: "Verification",         operation: "Index confirmed · provenance recorded" },
  { key: "ready",        label: "Ready",                operation: "Available for retrieval" },
];

const IMAGE_STAGES: StageDef[] = [
  { key: "received",   label: "Upload received",        operation: "Image stored · SHA-256 dedup check" },
  { key: "vision",     label: "Vision inspection",      operation: "qwen2.5vl · equipment observation recording" },
  { key: "extraction", label: "Observation extraction", operation: "Structured notes · anomaly detection" },
  { key: "indexing",   label: "Metadata & indexing",    operation: "Dense + sparse vectors · Qdrant upsert" },
  { key: "ready",      label: "Ready",                  operation: "Available for retrieval" },
];

/**
 * ms each stage is "active" — 1100 ms gives a clean cadence that reads
 * naturally. A 1 000 ms initial boot delay is added before stage 0.
 * Total: ~7.6 s for PDF (1 s boot + 6 × 1.1 s), ~6.5 s for image.
 */
const STAGE_MS  = 1100;
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

/**
 * 16 vertical bars whose heights oscillate using sin() at different frequencies.
 * When active=true the centre bars glow lime; when false all bars are dim stone.
 * Uses requestAnimationFrame so the oscillation is smooth and frame-rate aware.
 */
function Waveform({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Bar geometry
    const W    = canvas.width;
    const H    = canvas.height;
    const gap  = 3;
    const barW = Math.floor((W - gap * (BAR_COUNT - 1)) / BAR_COUNT);

    // Each bar gets a unique frequency + phase offset
    const freqs  = Array.from({ length: BAR_COUNT }, (_, i) => 0.8 + i * 0.18);
    const phases = Array.from({ length: BAR_COUNT }, (_, i) => (i * Math.PI * 0.4));

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i < BAR_COUNT; i++) {
        const x = i * (barW + gap);
        const raw = 0.5 + 0.5 * Math.sin(t * freqs[i] * 0.001 + phases[i]);
        const minH = active ? 0.15 : 0.08;
        const maxH = active ? 1.0  : 0.22;
        const h = (minH + raw * (maxH - minH)) * H;
        const y = H - h;

        // Centre 4 bars get lime when active
        const centre = Math.abs(i - (BAR_COUNT - 1) / 2) < 2.5;
        const lime = "#c8f135";
        const dim  = active ? "#44403c" : "#2a2826";

        if (active && centre) {
          ctx.fillStyle = lime;
          ctx.globalAlpha = 0.85 + 0.15 * raw;
        } else {
          ctx.fillStyle = dim;
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

// ─── Stage row (right column) ─────────────────────────────────────────────────

function StageRow({ stage }: { stage: StageState }) {
  const { status, def } = stage;
  return (
    <div className="flex items-start gap-3" role="listitem" aria-label={`${def.label}: ${status}`}>
      {/* Indicator */}
      <div className="mt-[2px] flex w-4 shrink-0 items-center justify-center">
        {status === "complete" && (
          <span className="text-[13px] font-bold text-[#c8f135]" aria-hidden>✓</span>
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

      {/* Text */}
      <div className="flex min-w-0 flex-col gap-[2px]">
        <span className={`text-[13px] font-semibold leading-tight transition-colors duration-200 ${
          status === "active"   ? "text-white"    :
          status === "complete" ? "text-stone-400":
          status === "error"    ? "text-red-400"  : "text-stone-700"
        }`}>
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
    state.meta.equipmentId ? `${state.meta.equipmentId}` : null,
    state.meta.department  || null,
    state.meta.revision    || null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex items-center gap-3 rounded border border-stone-800 bg-stone-900/50 px-4 py-2.5">
      <Icon className="size-3.5 shrink-0 text-stone-600" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-stone-200">
        {state.fileName}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        {tags.map((t, i) => (
          <span key={i} className="text-[10px] font-medium uppercase tracking-widest text-stone-600">
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
  const [copied, setCopied] = useState(false);
  const { meta, fileName, isImage } = state;
  const hasChunks = result.chunks > 0;

  const copyHash = () => {
    void navigator.clipboard.writeText(result.content_hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (result.duplicate) {
    return (
      <div className="animate-fade-up flex w-full flex-col gap-5">
        <div className="flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-amber-400" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-400">
            Already indexed
          </span>
        </div>
        <div>
          <p className="text-sm font-medium text-stone-300 leading-relaxed">
            This file has already been indexed. No processing was performed.
          </p>
          <p className="mt-1 text-xs text-stone-600">
            Exact SHA-256 content hash matched an existing document.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600">
            Content hash
          </span>
          <div className="flex items-center gap-2">
            <code className="font-mono text-[11px] text-stone-400 break-all">{result.content_hash}</code>
            <button type="button" onClick={copyHash}
              className="shrink-0 rounded p-1 text-stone-600 transition hover:text-stone-300"
              aria-label="Copy hash">
              <Copy className="size-3" />
            </button>
            {copied && <span className="text-[11px] text-stone-600">Copied</span>}
          </div>
        </div>
        <Button variant="outline" size="sm" className="self-start" onClick={onDismiss}>
          Return to library
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-up flex w-full flex-col gap-0">

      {/* STATUS HEADER */}
      <div className="flex items-center gap-2 pb-4">
        <CheckCircle2 className="size-4 shrink-0 text-[#c8f135]" aria-hidden />
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#c8f135]">
          Document processed
        </span>
      </div>

      {/* DOCUMENT NAME + STATUS */}
      <div className="border-t border-stone-700/60 pt-4 pb-5">
        <p className="text-[22px] font-bold leading-tight text-white break-words tracking-tight">
          {fileName}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className={`rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest border ${
            result.status === "indexed"
              ? "bg-emerald-900/60 text-emerald-300 border-emerald-700/50"
              : "bg-amber-900/60 text-amber-300 border-amber-700/50"
          }`}>
            {result.status}
          </span>
          {hasChunks
            ? <span className="text-[12px] font-medium text-stone-400">{result.chunks} chunk{result.chunks !== 1 ? "s" : ""} indexed</span>
            : <span className="text-[12px] text-stone-500">Stored · vector index pending</span>
          }
        </div>
      </div>

      {/* TWO-COLUMN METADATA + PROCESSING */}
      <div className="border-t border-stone-700/60 pt-4 pb-5 grid grid-cols-2 gap-x-8">
        <div className="flex flex-col gap-0.5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Document</p>
          <MetaRow label="Type"       value={meta.docType.replace("_", " ")} />
          <MetaRow label="Revision"   value={meta.revision || "—"} />
          <MetaRow label="Department" value={meta.department || "—"} />
          <MetaRow label="Equipment"  value={meta.equipmentId ?? "—"} accent={!!meta.equipmentId} />
          <MetaRow label="Source"     value={isImage ? "Image / photo" : "Document"} />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Processing</p>
          <CheckRow label="File stored"                                         done />
          <CheckRow label={isImage ? "Vision inspection run" : "Content parsed"} done />
          <CheckRow label="Chunks created"                                      done />
          <CheckRow label="Metadata attached"                                   done />
          <CheckRow label="Indexed for retrieval"                               done={hasChunks} />
        </div>
      </div>

      {/* VISION SECTION */}
      {isImage && (
        <div className="border-t border-stone-700/60 pt-4 pb-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Vision inspection</p>
          {hasChunks ? (
            <div className="flex flex-col gap-2">
              <CheckRow label="Equipment observation recorded" done />
              <CheckRow label="Visual condition analysed"      done />
              <CheckRow label="Indexed for evidence retrieval" done />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <CheckRow label="Image stored on disk"                            done />
              <CheckRow label="Inspection pending — vision model unavailable"   done={false} />
              <p className="mt-1 text-[11px] text-stone-600 leading-relaxed">
                Observations will be recorded when Ollama is running.
              </p>
            </div>
          )}
        </div>
      )}

      {/* PROVENANCE */}
      <div className="border-t border-stone-700/60 pt-4 pb-4 flex flex-col gap-2">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">Provenance</p>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px]">
          <span className="text-stone-500 font-medium">Document ID</span>
          <code className="font-mono text-stone-300 break-all">{result.document_id}</code>
          <span className="text-stone-500 font-medium">Content hash</span>
          <div className="flex items-center gap-1.5">
            <code className="font-mono text-stone-300 break-all">{result.content_hash.slice(0, 24)}…</code>
            <button type="button" onClick={copyHash}
              className="shrink-0 rounded p-0.5 text-stone-600 transition hover:text-stone-300"
              aria-label="Copy full hash">
              <Copy className="size-3" />
            </button>
            {copied && <span className="text-stone-500">Copied</span>}
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="border-t border-stone-800 pt-4 flex items-center gap-3">
        <Button size="sm" className="bg-[#c8f135] text-stone-900 hover:bg-[#d4f55a]" onClick={onDismiss}>
          View in library
        </Button>
        <Button variant="outline" size="sm" onClick={onDismiss}>
          Upload another
        </Button>
      </div>
    </div>
  );
}

function MetaRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 py-0.5 text-[13px]">
      <span className="w-20 shrink-0 text-stone-500 font-medium">{label}</span>
      <span className={`capitalize font-semibold ${accent ? "text-[#c8f135]" : "text-white"}`}>{value}</span>
    </div>
  );
}

function CheckRow({ label, done, icon }: { label: string; done: boolean; icon?: string }) {
  const marker = icon ?? (done ? "✓" : "○");
  return (
    <div className="flex items-center gap-2.5 py-0.5 text-[13px]">
      <span className={`w-3.5 shrink-0 text-center text-[13px] font-bold ${done ? "text-[#c8f135]" : "text-stone-700"}`} aria-hidden>
        {marker}
      </span>
      <span className={`font-medium ${done ? "text-stone-100" : "text-stone-600"}`}>{label}</span>
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
      // 1 s boot delay — let the waveform play before progress starts
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
      {/* Wider card for two-column layout */}
      <div className="flex w-full max-w-2xl flex-col gap-0">

        {/* ── ANIMATING PHASE ── */}
        {phase === "animating" && (
          <div className="flex flex-col gap-6">

            {/* TOP ROW: logo (left) + stage list (right) */}
            <div className="grid grid-cols-[200px_1fr] gap-8 items-start">

              {/* LEFT: logo + waveform */}
              <div className="flex flex-col items-center gap-4">
                {/* Logo */}
                <div className="animate-nirva-breathe" aria-hidden>
                  <img
                    src="/nirva_logo_-removebg-preview.png"
                    alt="NIRVA"
                    className="object-contain"
                    style={{ width: 80, height: 80 }}
                  />
                </div>

                {/* Divider line from logo to waveform */}
                <div className="h-4 w-px bg-stone-800" aria-hidden />

                {/* Waveform */}
                <div className="w-full px-1">
                  <Waveform active={waveformActive} />
                </div>
              </div>

              {/* RIGHT: stage list */}
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

            {/* BOTTOM: file info strip — full width */}
            <FileInfoStrip state={state} />
          </div>
        )}

        {/* ── RESULT PHASE ── */}
        {phase === "result" && result && (
          <ResultView result={result} state={state} onDismiss={onDismiss} />
        )}

        {/* ── ERROR PHASE ── */}
        {phase === "error" && (
          <div className="animate-fade-up flex w-full flex-col gap-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0 text-red-400" aria-hidden />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-red-400">
                Upload failed
              </span>
            </div>
            <p className="text-sm text-stone-400 leading-relaxed">{errorMsg}</p>
            <Button variant="outline" size="sm" className="self-start" onClick={onDismiss}>
              Back to upload
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
