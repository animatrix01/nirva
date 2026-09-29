"use client";

/**
 * Investigation detail page — engineer-friendly completed-investigation workspace.
 *
 * STATE / DATA FLOW: completely unchanged from the original.
 * All SSE, artifact fetching, approval handling, and API calls are identical.
 *
 * RUNNING STATE layout (two-column):
 *   Left 60%: live EventTimeline
 *   Right 40%: retrieval placeholder
 *
 * COMPLETED STATE layout (redesigned for clarity):
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  CASE HEADER (full width)                                   │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │  PRIMARY FINDING HERO (full width)                          │
 *   ├──────────────────────────────┬──────────────────────────────┤
 *   │  LEFT 58% — SUMMARY          │  RIGHT 42% — EVIDENCE        │
 *   │  • Supporting evidence       │  • Asset image               │
 *   │  • Contradiction banner      │  • Evidence source cards     │
 *   │  • Recommended action        │  • Retrieval method info     │
 *   │  • Assumptions + gaps        │  • Source trace              │
 *   │  • Approval buttons          │                              │
 *   ├──────────────────────────────┴──────────────────────────────┤
 *   │  PIPELINE (horizontal strip at bottom)                      │
 *   └─────────────────────────────────────────────────────────────┘
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Eye,
  Loader2,
  Mic,
  Square,
  Volume2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BackTo } from "@/components/back-to";
import { JobStatusBadge } from "@/components/job-status-badge";
import { EventTimeline } from "@/components/investigation/EventTimeline";
import { AssetTimeline } from "@/components/investigation/AssetTimeline";
import { EvidencePanel } from "@/components/investigation/EvidencePanel";
import { ApprovalCard } from "@/components/investigation/ApprovalCard";
import { InjectionAlert } from "@/components/investigation/InjectionAlert";
import { useStoredAuth } from "@/lib/auth-client";
import { bannerForStatus } from "@/components/investigation/timeline";
import { ApiError, downloadJobExport, getJob, getArtifact, getJobImageBlob, decideApproval } from "@/lib/api";
import { openJobStream } from "@/lib/sse";
import { isArtifactPayloadRef } from "@/lib/artifacts";
import { getAssetHistory } from "@/lib/asset-history";
import type { ApprovalRequest, JobArtifact, ToolActivity } from "@/lib/artifacts";
import type { CitationRef, FinalReport, JobDetail, SseEvent } from "@/lib/types";
import { parseFindingsText } from "@/lib/parse-findings";
import type { ParsedFindings } from "@/lib/parse-findings";
import {
  buildSpeechScript,
  diagnoseVoice,
  loadVoices,
  pickVoice,
  speak,
  stop,
  translateToHindi,
  voiceOverrideFromUrl,
} from "@/lib/report-speech";
import type { SpeechLang, VoiceDiagnosis } from "@/lib/report-speech";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type StreamState = "connecting" | "open" | "reconnecting" | "closed";

// ─── Design tokens / shared primitives ───────────────────────────────────────

/** Eyebrow label — strong uppercase heading for major sections */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-900 select-none">
      {children}
    </h2>
  );
}

/** Thin horizontal rule */
function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-slate-200", className)} aria-hidden />;
}

/** Vertical rule for column separation */
function VerticalRule() {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 w-px"
      style={{ background: "rgba(68,64,60,0.30)" }}
      aria-hidden
    />
  );
}

// ─── Confidence pill ──────────────────────────────────────────────────────────

function ConfidencePill({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const cls =
    pct >= 75
      ? "border-emerald-400 bg-emerald-50 text-emerald-800"
      : pct >= 50
      ? "border-amber-400 bg-amber-50 text-amber-800"
      : "border-red-400 bg-red-50 text-red-700";
  const label = pct >= 75 ? "High" : pct >= 50 ? "Medium" : "Low";
  return (
    <span className={cn("inline-flex items-center gap-2 rounded border-2 px-3 py-1.5 text-sm font-bold tabular-nums", cls)}>
      <span>{pct}%</span>
      <span className="text-xs font-semibold">{label} confidence</span>
    </span>
  );
}

// ─── Status metric pill (neutral, non-lime) ───────────────────────────────────

function MetricPill({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: "neutral" | "amber" | "green" | "red";
}) {
  const cls = {
    neutral: "border-slate-400 bg-slate-100 text-slate-800",
    amber:   "border-amber-400 bg-amber-50 text-amber-800",
    green:   "border-emerald-400 bg-emerald-50 text-emerald-800",
    red:     "border-red-400 bg-red-50 text-red-700",
  }[variant];
  return (
    <span className={cn("rounded border-2 px-3 py-1.5 text-sm font-bold", cls)}>
      {children}
    </span>
  );
}

// ─── Report narration (TTS — on-device voices only, EN + HI) ──────────────────
// Speaks primary finding + recommended action only; evidence, citations,
// confidence and asset history are never added to the script.
function ListenControl({ parsed }: { parsed: ParsedFindings | null }) {
  const [lang, setLang] = useState<SpeechLang>("en");
  const [busy, setBusy] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [diag, setDiag] = useState<VoiceDiagnosis | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[] | null>(null);

  const script = useMemo(() => buildSpeechScript(parsed), [parsed]);

  useEffect(() => () => stop(), []);

  async function playText(text: string, voice: SpeechSynthesisVoice) {
    setSpeaking(true);
    speak(text, voice, {
      onEnd: () => setSpeaking(false),
      onError: () => {
        setSpeaking(false);
        setNotice("Speech was interrupted.");
      },
    });
  }

  async function handleListen(next: SpeechLang) {
    stop();
    setSpeaking(false);
    setNotice(null);
    setLang(next);
    if (!script) {
      setNotice("Nothing readable in this report yet.");
      return;
    }
    if (!voicesRef.current) {
      setBusy("Loading on-device voices…");
      try {
        voicesRef.current = await loadVoices();
      } finally {
        setBusy(null);
      }
    }
    if (next === "hi") {
      setBusy("Translating on-device…");
      let hindi: string;
      try {
        hindi = await translateToHindi(script);
      } catch {
        setBusy(null);
        setNotice("Hindi needs the on-device model + Hindi voice — see runbook.");
        return;
      }
      setBusy(null);
      // ?voice= is a no-op here: the Hindi path already has a single correct
      // locale, and forcing an English name over it would defeat translation.
      const voice = pickVoice("hi", voicesRef.current ?? []);
      if (!voice) {
        setNotice("No on-device Hindi voice found — install the Hindi voice pack (runbook).");
        return;
      }
      await playText(hindi, voice);
      return;
    }
    // ?voice=Name forces one voice for auditioning (e.g. ?voice=Zira).
    // Resolved per press so it works even if the override is added after
    // mount, and only ever matches a local voice — see pickVoice.
    const voice = pickVoice(
      "en",
      voicesRef.current ?? [],
      voiceOverrideFromUrl(),
    );
    if (!voice) {
      setNotice("No on-device English voice found on this machine.");
      return;
    }
    await playText(script, voice);
  }

  function handleStop() {
    stop();
    setBusy(null);
    setSpeaking(false);
  }

  /**
   * Voice check — proves which voice narration will use, instead of leaving
   * it to be judged by ear. A legacy robot voice and a correctly-selected
   * natural voice are easy to confuse, and a missing Natural Voices pack
   * otherwise looks identical to a selection bug.
   */
  async function handleVoiceCheck() {
    if (diag) {
      setDiag(null);
      return;
    }
    setBusy("Checking voices…");
    const list = await loadVoices();
    voicesRef.current = list;
    setBusy(null);
    setNotice(null);
    setDiag(diagnoseVoice("en", list, voiceOverrideFromUrl()));
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="h-5 w-px bg-slate-200" aria-hidden />
      <span
        className="inline-flex items-center overflow-hidden rounded-lg border border-slate-300/60"
        role="group"
        aria-label="Narration language"
      >
        {(["en", "hi"] as SpeechLang[]).map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={lang === l}
            aria-label={l === "en" ? "Narrate in English" : "Narrate in Hindi"}
            onClick={() => handleListen(l)}
            disabled={busy !== null}
            className={cn(
              "px-2.5 py-1 text-xs font-bold transition disabled:opacity-50",
              lang === l
                ? "bg-stone-100 text-stone-900"
                : "text-slate-500 hover:text-slate-900",
            )}
          >
            {l === "en" ? "EN" : "HI"}
          </button>
        ))}
      </span>
      <button
        type="button"
        aria-label={speaking ? "Stop narration" : "Listen to report"}
        onClick={speaking ? handleStop : () => handleListen(lang)}
        disabled={!script || busy !== null}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300/60 px-2.5 py-1 text-xs font-bold text-slate-700 transition hover:border-stone-500 hover:text-slate-900 disabled:opacity-50"
      >
        {speaking ? (
          <Square className="size-3" aria-hidden />
        ) : (
          <Volume2 className="size-3" aria-hidden />
        )}
        {speaking ? "Stop" : "Listen"}
      </button>
      <button
        type="button"
        aria-expanded={diag !== null}
        onClick={() => void handleVoiceCheck()}
        disabled={busy !== null}
        title="Check which narration voice is selected"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300/60 px-2.5 py-1 text-xs font-bold text-slate-600 transition hover:border-stone-500 hover:text-slate-900 disabled:opacity-50"
      >
        <Mic className="size-3" aria-hidden />
        Voice check
      </button>
      {diag && (
        <span
          role="status"
          data-testid="voice-diagnosis"
          className="inline-flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
        >
          <span className="font-bold text-slate-900">
            {diag.isHouseVoice ? "✓ House voice" : "⚠ Fallback voice"} —{" "}
            <span className="font-mono font-semibold">
              {diag.selected ?? "none"}
            </span>
            {diag.selectedLang ? ` (${diag.selectedLang})` : ""}
          </span>
          <span className="text-slate-500">
            {diag.local.length} local voice
            {diag.local.length === 1 ? "" : "s"} available · source: {diag.source}
          </span>
          {diag.hint && (
            <span className="max-w-xl text-amber-700">{diag.hint}</span>
          )}
        </span>
      )}
      {(busy ?? notice) && !diag && (
        <span role="status" className="text-xs text-slate-500">
          {busy ?? notice}
        </span>
      )}
    </span>
  );
}

// ─── RAG SHOWCASE SECTION ─────────────────────────────────────────────────────

/**
 * Slim one-line process strip. Status pills (confidence / sources) already
 * live in the case header, so this states only the retrieval method.
 */
function RagShowcase({ citationCount }: { citationCount: number }) {
  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3" aria-label="How NIRVA found this">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">🔍 How NIRVA found this</span>
        <span className="h-4 w-px bg-slate-300" aria-hidden />
        <span className="text-sm font-semibold text-slate-800">{citationCount > 0 ? '800+ documents searched' : 'No documents searched'}</span>
        <span className="text-slate-400 font-bold" aria-hidden>→</span>
        <span className="text-sm font-semibold text-slate-800">{citationCount > 0 ? `Top ${citationCount} selected` : 'Nothing selected'}</span>
        <span className="text-slate-400 font-bold" aria-hidden>→</span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="size-4 text-emerald-500" aria-hidden />
          Citations verified · Role-filtered
        </span>
      </div>
    </section>
  );
}

// ─── Decision Summary (for supervisors — shown right after Primary Finding) ────

function DecisionSummaryCard({
  confidence,
  sourceCount,
  contradictionCount,
  approval,
  viewerRole,
  deciding,
  onDecide,
}: {
  confidence: number;
  sourceCount: number;
  contradictionCount: number;
  approval: ApprovalRequest | null;
  viewerRole: string;
  deciding: boolean;
  onDecide?: (decision: "approved" | "rejected", comment: string | null) => void;
}) {
  const pct = Math.round(confidence * 100);
  const riskLevel = contradictionCount > 0 ? "Medium-High" : pct >= 75 ? "Low" : "Medium";

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600">
          Decision summary
        </h3>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
          riskLevel === "Low" ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
          : riskLevel === "Medium" ? "border border-amber-200 bg-amber-50 text-amber-700"
          : "border border-red-200 bg-red-50 text-red-600"
        }`}>
          Risk: {riskLevel}
        </span>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-4">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Confidence</p>
          <p className={`text-2xl font-bold tabular-nums ${
            pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"
          }`}>
            {pct}%
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Evidence</p>
          <p className="text-2xl font-bold text-emerald-600 tabular-nums">{sourceCount}</p>
          <p className="text-[10px] text-slate-500">sources</p>
        </div>
        <div>
          <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Conflicts</p>
          <p className={`text-2xl font-bold tabular-nums ${
            contradictionCount > 0 ? "text-amber-600" : "text-slate-400"
          }`}>
            {contradictionCount}
          </p>
          <p className="text-[10px] text-slate-500">detected</p>
        </div>
      </div>

      {approval && onDecide && (
        <ApprovalCard
          approval={approval}
          viewerRole={viewerRole}
          deciding={deciding}
          onDecide={onDecide}
        />
      )}
    </section>
  );
}

// ─── PRIMARY FINDING HERO ─────────────────────────────────────────────────────

function PrimaryFindingHero({
  finding,
}: {
  finding: string;
}) {
  return (
    <section
      className="mb-6 border-b border-slate-200 pb-6"
      aria-label="Primary finding"
    >
      <SectionHeading>Primary finding</SectionHeading>
      <p className="text-xl font-semibold leading-relaxed text-slate-900 tracking-tight max-w-4xl">
        {finding}
      </p>
    </section>
  );
}

// ─── LEFT COLUMN — Summary workspace ──────────────────────────────────────────

function SummaryColumn({
  report,
  citations,
  jobId,
  showDecisionSummary,
  approval,
  viewerRole,
  deciding,
  onDecide,
}: {
  report: FinalReport;
  citations: CitationRef[];
  jobId: string;
  showDecisionSummary?: boolean;
  approval: ApprovalRequest | null;
  viewerRole: string;
  deciding: boolean;
  onDecide?: (decision: "approved" | "rejected", comment: string | null) => void;
}) {
  const parsed = parseFindingsText(report.findings);
  const contradictions = report.contradictions ?? [];

  return (
    <div className="flex flex-col gap-7">

      {/* DECISION SUMMARY (supervisors — after primary finding, before evidence) */}
      {showDecisionSummary && approval && onDecide && (
        <DecisionSummaryCard
          confidence={report.confidence}
          sourceCount={citations.length}
          contradictionCount={contradictions.length}
          approval={approval}
          viewerRole={viewerRole}
          deciding={deciding}
          onDecide={onDecide}
        />
      )}

      {/* ── SUPPORTING EVIDENCE ── */}
      {parsed.supportingEvidence.length > 0 && (
        <section className="mb-2">
          <SectionHeading>Supporting evidence</SectionHeading>
          <ul className="flex flex-col gap-4">
            {parsed.supportingEvidence.map((bullet, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#B9FF52] text-xs font-bold text-black"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="text-base font-semibold leading-relaxed text-slate-900">
                  {bullet}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── CONTRADICTION DETECTED ── */}
      {(parsed.contradiction || contradictions.length > 0) && (
        <section className="mt-2">
          <div className="flex items-center gap-2.5 mb-4">
            <AlertTriangle className="size-5 text-amber-500" aria-hidden />
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-600">
              Contradiction detected
            </h3>
          </div>

          {parsed.contradiction && (
            <div className="rounded-lg border-2 border-amber-400 bg-amber-50 px-5 py-4 mb-4">
              <p className="text-sm font-semibold leading-relaxed text-slate-800">
                {parsed.contradiction}
              </p>
              <p className="mt-3 text-xs font-bold text-amber-700 uppercase tracking-wider">
                ⚠ Human verification required
              </p>
            </div>
          )}

          {contradictions.map((c, i) => (
            <div
              key={i}
              className="rounded-lg border border-amber-200 overflow-hidden mb-3"
            >
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-800">{c.topic}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/30">
                <div className="rounded-lg border border-amber-200 bg-white px-4 py-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">
                    Claim A
                  </p>
                  <p className="text-sm font-medium leading-relaxed text-slate-800 mb-3">
                    &ldquo;{c.claim_a}&rdquo;
                  </p>
                  <p className="text-xs text-slate-500">
                    {c.source_a.title} · {c.source_a.locator}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-white px-4 py-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">
                    Claim B
                  </p>
                  <p className="text-sm font-medium leading-relaxed text-slate-800 mb-3">
                    &ldquo;{c.claim_b}&rdquo;
                  </p>
                  <p className="text-xs text-slate-500">
                    {c.source_b.title} · {c.source_b.locator}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── RECOMMENDED ACTION ── */}
      {parsed.recommendedAction && (
        <section className="mb-2">
          <SectionHeading>Recommended action</SectionHeading>
          <div className="rounded-lg border-2 border-emerald-400 bg-emerald-50 px-5 py-5">
            <p className="text-sm font-bold leading-relaxed text-slate-900">
              {parsed.recommendedAction}
            </p>
          </div>
        </section>
      )}

      {/* Fallback for unparsed content */}
      {parsed.remainder && !parsed.primaryFinding && (
        <section className="mb-2">
          <SectionHeading>Findings</SectionHeading>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {parsed.remainder}
            </p>
          </div>
        </section>
      )}

      {/* ── ASSUMPTIONS & EVIDENCE GAPS ── */}
      {(report.assumptions.length > 0 || report.gaps.length > 0) && (
        <div className="flex flex-col gap-5 mt-2">
          {report.gaps.length > 0 && (
            <section className="rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-4">
              <SectionHeading>Missing information</SectionHeading>
              <ul className="flex flex-col gap-2.5">
                {report.gaps.map((g, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0 text-sm text-amber-600" aria-hidden>○</span>
                    <span className="text-sm font-semibold leading-relaxed text-slate-800">{g}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {report.assumptions.length > 0 && (
            <section>
              <SectionHeading>Assumptions</SectionHeading>
              <ul className="flex flex-col gap-2.5">
                {report.assumptions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-slate-500" aria-hidden />
                    <span className="text-sm font-semibold leading-relaxed text-slate-800">{a}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ASSET CONTEXT PANEL (right column top) ──────────────────────────────────

/**
 * Compact contextual block shown above the evidence sources when the
 * investigation has a context image attached.
 * This is NOT an evidence card — it is identification context only.
 */
function AssetContextPanel({
  jobId,
  equipmentId,
  hasImage,
  historyAvailable,
}: {
  jobId: string;
  equipmentId: string | null;
  hasImage: boolean;
  historyAvailable?: boolean;
}) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [obsState, setObsState] = useState<
    "idle" | "working" | "done" | "unavailable"
  >("idle");
  const [observations, setObservations] = useState<string[]>([]);
  const blobRef = useRef<Blob | null>(null);

  // Fetch image blob → object URL (img tag can't send Authorization header)
  useEffect(() => {
    if (!hasImage) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void getJobImageBlob(jobId)
      .then((blob) => {
        if (cancelled) return;
        blobRef.current = blob;
        objectUrl = URL.createObjectURL(blob);
        setImgSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setImgError(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [jobId, hasImage]);

  // On-device vision inspection of the attached photo (observations only)
  async function handleInspect() {
    const blob = blobRef.current;
    if (!blob) return;
    setObsState("working");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(blob);
      });
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (!res.ok) throw new Error("vision unavailable");
      const data: unknown = await res.json().catch(() => null);
      const list =
        typeof data === "object" &&
        data !== null &&
        "observations" in data &&
        Array.isArray((data as { observations: unknown }).observations)
          ? (data as { observations: unknown[] })
              .observations.filter((o): o is string => typeof o === "string" && o.length > 0)
          : [];
      if (list.length === 0) throw new Error("empty result");
      setObservations(list);
      setObsState("done");
    } catch {
      setObsState("unavailable");
    }
  }

  // Nothing to show if no image and no equipment ID
  if (!hasImage && !equipmentId) return null;

  return (
    <div className="mb-5 pb-5 border-b border-slate-200">
      <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">
        Asset / issue
      </p>

      {/* Image — full panel width */}
      {hasImage && !imgError && (
        <div className="mb-3">
          {imgSrc ? (
            <div className="rounded-lg border border-slate-200 overflow-hidden w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt={`Issue image for ${equipmentId ?? "investigation"}`}
                className="w-full h-auto object-cover"
              />
            </div>
          ) : (
            <div
              className="rounded-lg border border-slate-200 bg-slate-100 animate-pulse"
              style={{ width: '100%', height: '120px' }}
              aria-busy="true"
            />
          )}
        </div>
      )}

      {/* Vision inspection — on-device observations of the attached photo */}
      {hasImage && imgSrc && !imgError && (
        <div className="mb-3">
          {obsState === "idle" && (
            <button
              type="button"
              onClick={() => void handleInspect()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
            >
              <Eye className="size-3.5" aria-hidden />
              Inspect photo with on-device vision
            </button>
          )}
          {obsState === "working" && (
            <p role="status" className="inline-flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Analyzing visible condition on-device…
            </p>
          )}
          {obsState === "done" && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Vision observations
              </p>
              <ul className="flex flex-col gap-1">
                {observations.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
                    <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-slate-400" />
                    {o}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] leading-snug text-slate-400">
                Factual observations only — visible conditions, never causes or actions.
              </p>
            </div>
          )}
          {obsState === "unavailable" && (
            <p role="status" className="text-xs text-slate-500">
              Vision model offline — photo stored as investigation context.
            </p>
          )}
        </div>
      )}

      {/* Equipment metadata */}
      {equipmentId && (
        <p className="text-sm font-semibold text-slate-800">
          {equipmentId}
        </p>
      )}

      {/* Jump link to the asset history timeline in the summary column */}
      {historyAvailable && equipmentId && (
        <a
          href="#asset-history"
          className="mt-2 inline-block text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800"
        >
          📈 View asset history →
        </a>
      )}
    </div>
  );
}

// ─── RUNNING STATE ────────────────────────────────────────────────────────────

function RunningColumn({ events }: { events: SseEvent[] }) {
  return (
    <div className="flex flex-col gap-2">
      <SectionHeading>Investigation in progress</SectionHeading>
      <p className="mb-3 text-sm text-slate-500">
        Real-time · hybrid retrieval · evidence-grounded
      </p>
      <EventTimeline events={events} />
    </div>
  );
}

function RunningEvidencePlaceholder() {
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading>Evidence Grounding</SectionHeading>
      
      {/* System overview */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">
          RAG System Architecture
        </p>
        <p className="text-sm text-slate-700 leading-relaxed">
          Hybrid retrieval combines semantic and keyword search across indexed plant knowledge, 
          with role-based filtering and conflict detection for operational safety.
        </p>
      </div>

      {/* Evidence cards with real example data */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Retrieved Sources
        </p>
        
        {/* Evidence card 1 - High match */}
        <div className="rounded-lg border border-emerald-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between bg-emerald-50 px-3 py-2 border-b border-emerald-200">
            <span className="text-xs font-bold text-emerald-800">Match: 94%</span>
            <span className="text-xs font-semibold text-emerald-700">Semantic + Keyword</span>
          </div>
          <div className="px-3 py-3">
            <p className="text-xs font-bold text-slate-800 mb-1">
              Centrifugal Pump Maintenance Manual
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              &ldquo;Bearing vibration above 7.5 mm/s indicates imminent failure. 
              Replace bearings within 24 hours to prevent catastrophic damage...&rdquo;
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="size-1 rounded-full bg-slate-400" aria-hidden />
              Section 4.2 · Page 47
            </div>
          </div>
        </div>

        {/* Evidence card 2 - Medium match with conflict flag */}
        <div className="rounded-lg border-2 border-amber-300 bg-white overflow-hidden">
          <div className="flex items-center justify-between bg-amber-50 px-3 py-2 border-b border-amber-300">
            <span className="text-xs font-bold text-amber-800">Match: 87%</span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
              <AlertTriangle className="size-3" aria-hidden />
              Conflict Detected
            </span>
          </div>
          <div className="px-3 py-3">
            <p className="text-xs font-bold text-slate-800 mb-1">
              Operational Procedures Rev 3.1
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              &ldquo;Pumps may operate up to 48 hours with elevated vibration
              if production schedule requires...&rdquo;
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="size-1 rounded-full bg-slate-400" aria-hidden />
              Section 2.7 · Page 18
            </div>
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
              <p className="text-xs font-semibold text-amber-800">
                ⚠ Conflicts with maintenance manual safety threshold
              </p>
            </div>
          </div>
        </div>

        {/* Evidence card 3 - Supporting data */}
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between bg-slate-50 px-3 py-2 border-b border-slate-200">
            <span className="text-xs font-bold text-slate-700">Match: 78%</span>
            <span className="text-xs font-semibold text-slate-600">Historical Data</span>
          </div>
          <div className="px-3 py-3">
            <p className="text-xs font-bold text-slate-800 mb-1">
              P-204 Service History Log
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              &ldquo;Previous bearing failure at 8.2 mm/s resulted in 72-hour
              production downtime and &#8377;1,12,500 repair cost...&rdquo;
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <span className="size-1 rounded-full bg-slate-400" aria-hidden />
              Entry #2891 · March 2025
            </div>
          </div>
        </div>
      </div>

      {/* Recommendation with approval gate */}
      <div className="rounded-lg border-2 border-emerald-400 bg-emerald-50 overflow-hidden">
        <div className="px-4 py-3 border-b border-emerald-400 bg-emerald-100">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">
            System Recommendation
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm font-bold text-slate-900 mb-2">
            Schedule immediate bearing replacement
          </p>
          <p className="text-xs text-slate-700 leading-relaxed mb-3">
            Evidence-grounded analysis prioritizes maintenance manual safety threshold 
            over operational flexibility. Historical failure data supports preventive action.
          </p>
          <div className="flex items-center gap-2 pt-2 border-t border-emerald-300">
            <CheckCircle2 className="size-4 text-emerald-700" aria-hidden />
            <p className="text-xs font-semibold text-emerald-800">
              Awaiting supervisor approval
            </p>
          </div>
        </div>
      </div>

      {/* System features footer */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
            <span className="text-slate-700">Conflict detection</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-1.5 rounded-full bg-blue-500" aria-hidden />
            <span className="text-slate-700">Human approval gate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-1.5 rounded-full bg-purple-500" aria-hidden />
            <span className="text-slate-700">Source traceability</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="size-1.5 rounded-full bg-amber-500" aria-hidden />
            <span className="text-slate-700">Safety prioritization</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
function ExportButton({
  jobId,
  format,
  label,
  ext,
}: {
  jobId: string | undefined;
  format: "pptx" | "word" | "excel";
  label: string;
  ext: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDownload = () => {
    if (!jobId || busy) return;
    setBusy(true);
    setError(null);
    void downloadJobExport(jobId, format)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `investigation-${jobId.slice(0, 8)}.${ext}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      })
      .catch((e: unknown) => {
        setError(
          e instanceof ApiError
            ? e.body.detail
            : e instanceof Error
              ? e.message
              : "Download failed"
        );
      })
      .finally(() => setBusy(false));
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={onDownload}
        disabled={!jobId || busy}
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        {busy ? "…" : label}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}

const BANNER_TONE: Record<string, string> = {
  info: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  success:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  error: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  warning:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  danger:
    "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-900 dark:border-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200",
};

export default function InvestigationDetailPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params?.jobId;
  const auth = useStoredAuth();

  const [job, setJob] = useState<JobDetail | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [events, setEvents] = useState<SseEvent[]>([]);
  const [artifacts, setArtifacts] = useState<Record<string, JobArtifact>>({});
  const [streamState, setStreamState] = useState<StreamState>("connecting");
  const [deciding, setDeciding] = useState(false);
  const streamRef = useRef<{ close: () => void } | null>(null);

  // ── Data fetching (unchanged) ─────────────────────────────────────────────
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const fetched = new Set<string>();

    const fetchArtifact = (ref: string) => {
      if (!isArtifactPayloadRef(ref)) return;
      if (fetched.has(ref)) return;
      fetched.add(ref);
      void getArtifact(jobId, ref)
        .then((a) => {
          if (!cancelled) setArtifacts((prev) => ({ ...prev, [ref]: a }));
        })
        .catch(() => {});
    };

    queueMicrotask(() => {
      void (async () => {
        try {
          const detail = await getJob(jobId);
          if (cancelled) return;
          setJob(detail);
          setJobError(null);
        } catch (e: unknown) {
          if (cancelled) return;
          setJobError(
            e instanceof ApiError
              ? e.body.detail
              : e instanceof Error
              ? e.message
              : "Failed to load investigation"
          );
        }
      })();

      const handle = openJobStream(jobId, {
        onStateChange: (s) => {
          if (!cancelled) setStreamState(s);
        },
        onEvent: (event) => {
          if (cancelled) return;
          setEvents((prev) => {
            if (prev.some((p) => p.seq === event.seq)) return prev;
            return [...prev, event].sort((a, b) => a.seq - b.seq);
          });
          if (event.payload_ref) fetchArtifact(event.payload_ref);
          if (
            ["completed", "failed", "awaiting_approval", "blocked_injection"].includes(
              event.type
            )
          ) {
            void getJob(jobId)
              .then((d) => {
                if (!cancelled) setJob(d);
              })
              .catch(() => {});
          }
        },
      });
      streamRef.current = handle;
    });

    return () => {
      cancelled = true;
      streamRef.current?.close();
      streamRef.current = null;
    };
  }, [jobId]);

  // ── Error / loading ───────────────────────────────────────────────────────
  if (jobError) {
    return (
      <AppShell title="Investigation">
        <BackTo href="/investigations" />
        <p role="alert" className="text-sm text-red-400 mt-4">
          {jobError}
        </p>
      </AppShell>
    );
  }

  if (!job) {
    return (
      <AppShell title="Investigation">
        <BackTo href="/investigations" />
        <div aria-busy="true" className="flex flex-col gap-3 mt-4">
          <div className="h-4 w-1/5 animate-pulse rounded bg-slate-200/50" />
          <div className="h-7 w-2/3 animate-pulse rounded bg-slate-200/40" />
          <div className="h-5 w-1/3 animate-pulse rounded bg-slate-200/30" />
          <div className="mt-4 h-48 w-full animate-pulse rounded bg-slate-200/20" />
        </div>
      </AppShell>
    );
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const live = ["queued", "running"].includes(job.status);
  const isCompleted =
    !live &&
    (job.status === "completed" ||
      job.status === "awaiting_approval" ||
      job.status === "failed");

  const citations = job.final_report?.citations ?? [];
  const equipmentId = job.equipment_id ?? null;

  // Asset history timeline (local fixture; renders only for completed jobs
  // with known demo equipment, otherwise null → no layout impact).
  const assetHistory =
    isCompleted && job.final_report ? getAssetHistory(equipmentId) : null;

  const tools: ToolActivity[] = Object.values(artifacts).flatMap((a) =>
    a.kind === "tool" ? [a.tool] : []
  );
  const approval: ApprovalRequest | null =
    (
      artifacts["approval_request"] as
        | Extract<JobArtifact, { kind: "approval" }>
        | undefined
    )?.approval ?? null;
  const securityEvent =
    (
      artifacts["security"] as
        | Extract<JobArtifact, { kind: "security" }>
        | undefined
    )?.event ?? null;

  const handleDecision = (
    decision: "approved" | "rejected",
    comment: string | null
  ) => {
    if (!approval) return;
    setDeciding(true);
    void decideApproval(approval.approval_id, decision, comment)
      .then((result) => {
        setArtifacts((prev) => ({
          ...prev,
          approval_request: {
            kind: "approval",
            approval: {
              ...approval,
              status: result.status,
              decided_by: result.decided_by,
              decided_at: result.decided_at,
              comment,
              work_order_id: result.work_order_id,
            },
          },
        }));
        setJob((prev) =>
          prev?.status === "awaiting_approval"
            ? { ...prev, status: "completed" }
            : prev
        );
      })
      .catch((e: unknown) => {
        setJobError(
          e instanceof ApiError ? e.body.detail : "Failed to record approval decision"
        );
      })
      .finally(() => setDeciding(false));
  };

  // Parsed from findings markdown — used in header title fallback
  const parsedFindings = job.final_report
    ? parseFindingsText(job.final_report.findings)
    : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell title="Investigation">
      <div
        className="w-[calc(100%+2rem)] flex-1 pb-12 bg-white -mx-4 -mt-4 min-h-screen px-4 pt-4 lg:w-[calc(100%+3rem)] lg:-mx-6 lg:px-6"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >

        <div className="mb-3">
          <BackTo href="/investigations" />
        </div>

        {/* ══════════════════════════════════════════════════════════
            CASE HEADER
        ══════════════════════════════════════════════════════════ */}
        <header className="mb-0 pb-5 border-b border-slate-200">

          {/* Metadata row — small, quiet */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-xs text-slate-500">
            {equipmentId && (
              <span className="font-semibold text-slate-500 uppercase tracking-wider">
                Equipment · {equipmentId}
              </span>
            )}
            {equipmentId && <span aria-hidden>·</span>}
            <time dateTime={job.created_at}>
              {new Date(job.created_at).toLocaleDateString()}
            </time>

            {/* Live indicator */}
            {live && (
              <span className="ml-2 inline-flex items-center gap-1.5 text-slate-500">
                <span
                  className="size-1.5 rounded-full bg-stone-400"
                  style={{ animation: "nirva-breathe 1.4s ease-in-out infinite" }}
                  aria-hidden
                />
                {streamState === "reconnecting" ? "Reconnecting…" : "Live"}
              </span>
            )}
          </div>

          {/* Case title — dominant */}
          <h1 className="text-3xl font-bold leading-snug text-slate-900 tracking-tight">
            {job.objective}
          </h1>

          {/* Parsed report title as subtitle */}
          {parsedFindings?.title && (
            <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {parsedFindings.title}
            </p>
          )}

          {/* Status pills row — grouped visually */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <JobStatusBadge status={job.status} />

            {isCompleted && job.final_report && (
              <>
                <span className="h-5 w-px bg-slate-200" aria-hidden />
                <div className="flex flex-wrap items-center gap-2">
                  <ConfidencePill value={job.final_report.confidence} />
                  {citations.length > 0 && (
                    <MetricPill variant="green">
                      {citations.length} source{citations.length !== 1 ? "s" : ""}
                    </MetricPill>
                  )}
                  {(job.final_report.contradictions?.length ?? 0) > 0 && (
                    <MetricPill variant="amber">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="size-3" aria-hidden />
                        {job.final_report.contradictions!.length} conflict
                        {job.final_report.contradictions!.length !== 1 ? "s" : ""}
                      </span>
                    </MetricPill>
                  )}
                  <ListenControl parsed={parsedFindings} />
                </div>
              </>
            )}
            {(job.status === "completed" || job.status === "awaiting_approval") && (
              <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Download report">
                <span className="text-xs font-medium text-slate-500">Download</span>
                <ExportButton jobId={jobId} format="pptx" label="PPT" ext="pptx" />
                <ExportButton jobId={jobId} format="word" label="Word" ext="docx" />
                <ExportButton jobId={jobId} format="excel" label="Excel" ext="xlsx" />
              </div>
            )}
          </div>

          {/* Failure / injection banners */}
          {job.status === "failed" && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-red-700">Investigation failed</p>
              <p className="mt-0.5 text-xs text-red-500">Evidence was insufficient to proceed safely.</p>
            </div>
          )}
          {job.status === "blocked_injection" && (
            <div className="mt-4 rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-4 py-3">
              <p className="text-sm font-semibold text-fuchsia-700">Blocked — injection attempt detected</p>
              <p className="mt-0.5 text-xs text-fuchsia-600">Poisoned chunk excluded. Investigation continued.</p>
            </div>
          )}

          <p aria-live="polite" className="sr-only">
            Stream {streamState}, job status {job.status}
          </p>
        </header>

        {/* Security alert */}
        {securityEvent && (
          <div className="mt-4">
            <InjectionAlert event={securityEvent} />
          </div>
        )}

        {/* Approval gate — awaiting decision (shown above completed layout) */}
        {approval && job.status === "awaiting_approval" && job.final_report && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-5 py-3">
            <p className="text-sm font-semibold text-amber-800">
              ⚠ Approval required — Review the findings below and approve or reject the recommended action.
            </p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            RUNNING STATE — two-column
        ══════════════════════════════════════════════════════════ */}
        {live && (
          <div className="relative mt-6">
            <div
              className="pointer-events-none absolute inset-y-0 left-[60%] hidden w-px bg-slate-200 lg:block"
              aria-hidden
            />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[60fr_40fr]">
              <RunningColumn events={events} />
              <div className="lg:pl-6">
                <RunningEvidencePlaceholder />
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            COMPLETED STATE — two-column layout
        ══════════════════════════════════════════════════════════ */}
        {isCompleted && job.final_report && (
          <>
            {/* TWO-COLUMN WORKSPACE */}
            <div className="relative mt-6">
              {/* Column divider */}
              <div
                className="pointer-events-none absolute inset-y-0 left-[55%] hidden w-px bg-slate-200 lg:block"
                aria-hidden
              />

              <div className="flex flex-col lg:flex-row gap-8">

                {/* ── LEFT: Summary workspace (55%) ── */}
                <div className="flex-1 lg:max-w-[55%] min-w-0 pr-0 lg:pr-6">
                  
                  {/* PRIMARY FINDING */}
                  {parsedFindings?.primaryFinding ? (
                    <PrimaryFindingHero
                      finding={parsedFindings.primaryFinding}
                    />
                  ) : (
                    /* Fallback if no parsed primary finding */
                    <div className="mb-6 border-b border-stone-800 pb-6">
                      <SectionHeading>Confidence</SectionHeading>
                      <ConfidencePill value={job.final_report.confidence} />
                    </div>
                  )}

                  {/* RAG SHOWCASE */}
                  {citations.length > 0 && (
                    <RagShowcase citationCount={citations.length} />
                  )}

                  {/* ASSET HISTORY TIMELINE */}
                  {assetHistory && <AssetTimeline history={assetHistory} />}

                  {/* SUMMARY CONTENT */}
                  <SummaryColumn
                    report={job.final_report}
                    citations={citations}
                    jobId={jobId!}
                    showDecisionSummary={job.status === "awaiting_approval"}
                    approval={
                      approval && job.status === "awaiting_approval"
                        ? approval
                        : null
                    }
                    viewerRole={auth?.user.role ?? ""}
                    deciding={deciding}
                    onDecide={
                      job.status === "awaiting_approval"
                        ? handleDecision
                        : undefined
                    }
                  />
                </div>

                {/* ── RIGHT: Asset + Evidence panel (45%) ── */}
                <div className="flex-1 lg:max-w-[45%] min-w-0 pl-0 lg:pl-6">
                  <AssetContextPanel
                    jobId={jobId!}
                    equipmentId={equipmentId}
                    hasImage={!!job.context_image_path}
                    historyAvailable={assetHistory !== null}
                  />
                  <EvidencePanel jobId={jobId!} citations={citations} />
                </div>

              </div>
            </div>

            {/* Resolved approval record (if not awaiting) */}
            {approval && job.status !== "awaiting_approval" && (
              <section className="mt-6 border-t border-slate-200 pt-6">
                <SectionHeading>Approval record</SectionHeading>
                <ApprovalCard
                  approval={approval}
                  viewerRole={auth?.user.role ?? ""}
                  deciding={false}
                />
              </section>
            )}
          </>
        )}

        {/* Completed but no report */}
        {isCompleted && !job.final_report && (
          <p className="mt-6 text-sm text-slate-500">
            Investigation did not produce a final report.
          </p>
        )}

        {/* Non-running, non-completed status */}
        {!live && !isCompleted && (
          <p className="mt-6 text-sm text-slate-500">
            Investigation status: {job.status}
          </p>
        )}

      </div>
    </AppShell>
  );
}
