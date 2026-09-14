"use client";

/**
 * Investigation detail page — redesigned completed-investigation workspace.
 *
 * STATE / DATA FLOW: completely unchanged from the original.
 * All SSE, artifact fetching, approval handling, and API calls are identical.
 *
 * RUNNING STATE layout (two-column):
 *   Left 60%: live EventTimeline
 *   Right 40%: retrieval placeholder
 *
 * COMPLETED STATE layout (three-column):
 *   ┌────────────────────────────────────────────────────────────┐
 *   │  CASE HEADER                                               │
 *   │  Equipment · objective · status metrics                    │
 *   ├──────────────────────────────────────────────────────────  │
 *   │  PRIMARY FINDING HERO (full width, strong visual weight)   │
 *   ├──────────────────────────────────────────────────────────  │
 *   │  LEFT 22%         │  CENTER 48%       │  RIGHT 30%         │
 *   │  Pipeline stages  │  Supporting evid. │  Evidence sources  │
 *   │  Investigation    │  Contradiction    │  Source trace      │
 *   │  activity         │  Rec. action      │  Retrieval info    │
 *   │                   │  Assumptions      │                    │
 *   │                   │  Evidence gaps    │                    │
 *   └────────────────────────────────────────────────────────────┘
 */

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BackTo } from "@/components/back-to";
import { JobStatusBadge } from "@/components/job-status-badge";
import { EventTimeline } from "@/components/investigation/EventTimeline";
import { EvidencePanel } from "@/components/investigation/EvidencePanel";
import { ApprovalCard } from "@/components/investigation/ApprovalCard";
import { InjectionAlert } from "@/components/investigation/InjectionAlert";
import { useStoredAuth } from "@/lib/auth-client";
import { ApiError, getJob, getArtifact, decideApproval, getJobImageBlob } from "@/lib/api";
import { openJobStream } from "@/lib/sse";
import { isArtifactPayloadRef } from "@/lib/artifacts";
import type { ApprovalRequest, JobArtifact, ToolActivity } from "@/lib/artifacts";
import type { CitationRef, FinalReport, JobDetail, SseEvent } from "@/lib/types";
import { parseFindingsText } from "@/lib/parse-findings";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type StreamState = "connecting" | "open" | "reconnecting" | "closed";

// ─── Design tokens / shared primitives ───────────────────────────────────────

/** Eyebrow label — strong uppercase heading for major sections */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-stone-500 select-none">
      {children}
    </h2>
  );
}

/** Thin horizontal rule */
function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-stone-800", className)} aria-hidden />;
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
      ? "border-emerald-800/70 bg-emerald-950/50 text-emerald-300"
      : pct >= 50
      ? "border-amber-800/60  bg-amber-950/40  text-amber-300"
      : "border-red-800/50    bg-red-950/30    text-red-300";
  return (
    <span className={cn("rounded border px-2.5 py-1 text-[12px] font-semibold tabular-nums", cls)}>
      {pct}% confidence
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
    neutral: "border-stone-700/60 bg-stone-900/60 text-stone-400",
    amber:   "border-amber-800/50 bg-amber-950/30 text-amber-300",
    green:   "border-emerald-800/60 bg-emerald-950/40 text-emerald-300",
    red:     "border-red-800/50 bg-red-950/30 text-red-300",
  }[variant];
  return (
    <span className={cn("rounded border px-2.5 py-1 text-[11px] font-medium", cls)}>
      {children}
    </span>
  );
}

// ─── PRIMARY FINDING HERO ─────────────────────────────────────────────────────

function PrimaryFindingHero({
  finding,
  report,
  citationCount,
}: {
  finding: string;
  report: FinalReport;
  citationCount: number;
}) {
  const pct = Math.round(report.confidence * 100);
  const contradictionCount = report.contradictions?.length ?? 0;

  return (
    <section
      className="mb-0 border-b border-stone-800 pb-6"
      aria-label="Primary finding"
    >
      <SectionHeading>Primary finding</SectionHeading>

      {/* Main conclusion — visually dominant */}
      <p className="text-[18px] font-semibold leading-[1.45] text-white tracking-tight max-w-3xl">
        {finding}
      </p>

      {/* Metrics row */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <ConfidencePill value={report.confidence} />
        {citationCount > 0 && (
          <MetricPill variant="neutral">
            {citationCount} source{citationCount !== 1 ? "s" : ""} cited
          </MetricPill>
        )}
        {contradictionCount > 0 && (
          <MetricPill variant="amber">
            <span className="flex items-center gap-1">
              <AlertTriangle className="size-3" aria-hidden />
              {contradictionCount} contradiction{contradictionCount !== 1 ? "s" : ""}
            </span>
          </MetricPill>
        )}
        {report.assumptions.length > 0 && (
          <MetricPill variant="neutral">
            {report.assumptions.length} assumption{report.assumptions.length !== 1 ? "s" : ""}
          </MetricPill>
        )}
      </div>
    </section>
  );
}

// ─── PIPELINE — left column ──────────────────────────────────────────────────

const PIPELINE_STEPS = [
  {
    key: "intake",
    label: "Intake",
    desc: "Objective parsed · equipment identified",
  },
  {
    key: "retrieve",
    label: "Retrieve",
    desc: "Hybrid retrieval across plant knowledge",
  },
  {
    key: "correlate",
    label: "Correlate",
    desc: "Evidence linked across sources",
  },
  {
    key: "verify",
    label: "Verify",
    desc: "Contradiction check completed",
  },
  {
    key: "finalize",
    label: "Finalize",
    desc: "Evidence-grounded findings compiled",
  },
];

function PipelineColumn({
  events,
  tools,
  approval,
  viewerRole,
}: {
  events: SseEvent[];
  tools: ToolActivity[];
  approval: ApprovalRequest | null;
  viewerRole: string;
}) {
  const [execOpen, setExecOpen] = useState(false);

  const firedNodes = new Set(events.map((e) => e.node));
  const allDone = events.length === 0; // completed page always treats as done

  const steps = PIPELINE_STEPS.map((s) => ({
    ...s,
    done:
      allDone ||
      (s.key === "intake"    ? firedNodes.has("intake")   :
       s.key === "retrieve"  ? firedNodes.has("answer")   :
       s.key === "correlate" ? firedNodes.has("answer")   :
       s.key === "verify"    ? firedNodes.has("finalize") :
       s.key === "finalize"  ? firedNodes.has("finalize") :
       false),
  }));

  const TOOL_META: Record<string, { label: string; detail: string }> = {
    search_documents:  { label: "Search documents",       detail: "Hybrid retrieval · ACL-filtered plant knowledge" },
    get_asset_history: { label: "Asset history lookup",   detail: "Equipment history · read-only operational tool" },
    check_inventory:   { label: "Inventory check",        detail: "Spare parts availability · read-only tool" },
    recall_memories:   { label: "Episodic memory recall", detail: "Prior approved findings for this equipment" },
  };

  return (
    <div className="flex flex-col gap-6">

      {/* ── PIPELINE STAGES ── */}
      <div>
        <SectionHeading>Investigation pipeline</SectionHeading>
        <ol className="flex flex-col gap-0">
          {steps.map((step, i) => (
            <li key={step.key} className="flex items-stretch gap-3">
              {/* Indicator + connector */}
              <div className="flex flex-col items-center" style={{ width: 18 }}>
                {step.done ? (
                  <CheckCircle2
                    className="size-[18px] shrink-0 text-emerald-600"
                    aria-hidden
                  />
                ) : (
                  <Circle
                    className="size-[18px] shrink-0 text-stone-700"
                    aria-hidden
                  />
                )}
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      "mt-0.5 w-px flex-1 min-h-[20px]",
                      step.done ? "bg-stone-700" : "bg-stone-800"
                    )}
                    aria-hidden
                  />
                )}
              </div>

              {/* Content */}
              <div className={cn("pb-4 flex-1", i === steps.length - 1 && "pb-0")}>
                <p
                  className={cn(
                    "text-[13px] font-semibold leading-tight",
                    step.done ? "text-stone-200" : "text-stone-600"
                  )}
                >
                  {step.label}
                </p>
                {step.done && (
                  <p className="mt-0.5 text-[11px] leading-snug text-stone-600">
                    {step.desc}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Collapsible execution details */}
      {events.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setExecOpen((v) => !v)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-700 transition hover:text-stone-500"
            aria-expanded={execOpen}
          >
            {execOpen
              ? <ChevronDown className="size-3" aria-hidden />
              : <ChevronRight className="size-3" aria-hidden />}
            Execution details
          </button>
          {execOpen && (
            <div className="mt-3">
              <EventTimeline events={events} />
            </div>
          )}
        </div>
      )}

      <Divider />

      {/* ── INVESTIGATION ACTIVITY ── */}
      {tools.length > 0 && (
        <div>
          <SectionHeading>Investigation activity</SectionHeading>
          <ul className="flex flex-col gap-3">
            {tools.map((t, i) => {
              const meta = TOOL_META[t.tool_name] ?? { label: t.tool_name, detail: t.summary };
              return (
                <li key={`${t.tool_name}-${i}`} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        t.ok ? "bg-emerald-600" : "bg-red-500"
                      )}
                      aria-hidden
                    />
                    <span className="text-[12px] font-medium text-stone-300">
                      {meta.label}
                    </span>
                  </div>
                  <p className="pl-3.5 text-[11px] leading-snug text-stone-600">
                    {meta.detail}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Resolved approval record */}
      {approval && (
        <>
          <Divider />
          <div>
            <SectionHeading>Approval record</SectionHeading>
            <ApprovalCard
              approval={approval}
              viewerRole={viewerRole}
              deciding={false}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ─── CENTER COLUMN — findings workspace ──────────────────────────────────────

function FindingsCenter({
  report,
  citations,
  jobId,
}: {
  report: FinalReport;
  citations: CitationRef[];
  jobId: string;
}) {
  const parsed = parseFindingsText(report.findings);
  const contradictions = report.contradictions ?? [];

  return (
    <div className="flex flex-col gap-7">

      {/* ── SUPPORTING EVIDENCE ── */}
      {parsed.supportingEvidence.length > 0 && (
        <section>
          <SectionHeading>Supporting evidence</SectionHeading>
          <ul className="flex flex-col gap-3">
            {parsed.supportingEvidence.map((bullet, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="mt-[6px] size-1.5 shrink-0 rounded-full bg-stone-500"
                  aria-hidden
                />
                <span className="text-[13px] leading-relaxed text-stone-200">
                  {bullet}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── CONTRADICTION DETECTED ── */}
      {(parsed.contradiction || contradictions.length > 0) && (
        <section>
          {/* Section header with warning indicator */}
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4 text-amber-500" aria-hidden />
            <SectionHeading>Contradiction detected</SectionHeading>
          </div>

          {/* Inline parsed contradiction */}
          {parsed.contradiction && (
            <div className="rounded-sm border border-amber-800/50 bg-amber-950/20 px-4 py-4 mb-3">
              <p className="text-[13px] leading-relaxed text-amber-100">
                {parsed.contradiction}
              </p>
              <p className="mt-2 text-[11px] font-medium text-amber-600 uppercase tracking-wider">
                Human verification required
              </p>
            </div>
          )}

          {/* Structured contradictions from final_report.contradictions[] */}
          {contradictions.map((c, i) => (
            <div
              key={i}
              className="rounded-sm border border-amber-800/40 overflow-hidden mb-2"
            >
              <div className="border-b border-amber-800/30 bg-amber-950/25 px-4 py-2.5">
                <p className="text-[12px] font-semibold text-amber-300">{c.topic}</p>
              </div>
              <div className="grid grid-cols-2">
                <div className="border-r border-amber-800/20 bg-amber-950/10 px-4 py-3">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                    Claim A
                  </p>
                  <p className="text-[12px] leading-relaxed text-stone-300">
                    &ldquo;{c.claim_a}&rdquo;
                  </p>
                  <p className="mt-2 text-[10px] text-stone-600">
                    {c.source_a.title} · {c.source_a.locator}
                  </p>
                </div>
                <div className="bg-amber-950/10 px-4 py-3">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                    Claim B
                  </p>
                  <p className="text-[12px] leading-relaxed text-stone-300">
                    &ldquo;{c.claim_b}&rdquo;
                  </p>
                  <p className="mt-2 text-[10px] text-stone-600">
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
        <section>
          <SectionHeading>Recommended action</SectionHeading>
          <div className="border-l-2 border-stone-600 bg-stone-900/40 px-4 py-3 rounded-sm">
            <p className="text-[13px] leading-relaxed text-stone-100">
              {parsed.recommendedAction}
            </p>
          </div>
        </section>
      )}

      {/* Fallback for unparsed content */}
      {parsed.remainder && !parsed.primaryFinding && (
        <section>
          <SectionHeading>Findings</SectionHeading>
          <div className="rounded-sm border border-stone-800 bg-stone-900/30 px-4 py-4">
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-stone-300">
              {parsed.remainder}
            </p>
          </div>
        </section>
      )}

      <Divider />

      {/* ── ASSUMPTIONS & EVIDENCE GAPS ── */}
      {(report.assumptions.length > 0 || report.gaps.length > 0) && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {report.assumptions.length > 0 && (
            <section>
              <SectionHeading>Assumptions</SectionHeading>
              <ul className="flex flex-col gap-2">
                {report.assumptions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span
                      className="mt-[5px] size-1.5 shrink-0 rounded-full bg-stone-600"
                      aria-hidden
                    />
                    <span className="text-[12px] leading-relaxed text-stone-400">
                      {a}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {report.gaps.length > 0 && (
            <section>
              <SectionHeading>Evidence gaps</SectionHeading>
              <ul className="flex flex-col gap-2">
                {report.gaps.map((g, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span
                      className="mt-[3px] shrink-0 text-[12px] text-amber-700"
                      aria-hidden
                    >
                      ○
                    </span>
                    <span className="text-[12px] leading-relaxed text-stone-500">
                      {g}
                    </span>
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
}: {
  jobId: string;
  equipmentId: string | null;
  hasImage: boolean;
}) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  // Fetch image blob → object URL (img tag can't send Authorization header)
  useEffect(() => {
    if (!hasImage) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    void getJobImageBlob(jobId)
      .then((blob) => {
        if (cancelled) return;
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

  // Nothing to show if no image and no equipment ID
  if (!hasImage && !equipmentId) return null;

  return (
    <div className="mb-5 pb-5 border-b border-stone-800">
      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">
        Asset / issue
      </p>

      {/* Image — full panel width */}
      {hasImage && !imgError && (
        <div className="mb-3">
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={`Issue image for ${equipmentId ?? "investigation"}`}
              className="w-full rounded border border-stone-700 object-cover"
              style={{ maxHeight: 220 }}
            />
          ) : (
            <div
              className="w-full rounded border border-stone-800 bg-stone-800/40 animate-pulse"
              style={{ height: 180 }}
              aria-busy="true"
            />
          )}
        </div>
      )}

      {/* Equipment metadata */}
      {equipmentId && (
        <p className="text-[13px] font-semibold text-stone-200">
          {equipmentId}
        </p>
      )}
    </div>
  );
}

// ─── RUNNING STATE ────────────────────────────────────────────────────────────

function RunningColumn({ events }: { events: SseEvent[] }) {
  return (
    <div className="flex flex-col gap-2">
      <SectionHeading>Investigation in progress</SectionHeading>
      <p className="mb-3 text-[11px] text-stone-600">
        Real-time · hybrid retrieval · evidence-grounded
      </p>
      <EventTimeline events={events} />
    </div>
  );
}

function RunningEvidencePlaceholder() {
  return (
    <div className="flex flex-col gap-3">
      <SectionHeading>Evidence</SectionHeading>
      <div className="rounded border border-dashed border-stone-800 px-5 py-5 flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span
            className="inline-block size-1.5 rounded-full bg-stone-600"
            style={{ animation: "nirva-breathe 2s ease-in-out infinite" }}
            aria-hidden
          />
          <p className="text-[12px] text-stone-600">Hybrid retrieval in progress</p>
        </div>
        <p className="text-[11px] text-stone-700 leading-relaxed">
          Evidence sources appear once the investigation completes. NIRVA searches
          indexed plant knowledge using dense semantic and sparse lexical retrieval,
          rank-fused and ACL-filtered.
        </p>
        {[
          "Dense semantic search",
          "Sparse lexical search",
          "Reciprocal-rank fusion",
          "ACL-filtered results",
        ].map((step) => (
          <div
            key={step}
            className="flex items-center gap-2 text-[11px] text-stone-700 pl-0.5"
          >
            <span className="size-1 rounded-full bg-stone-700" aria-hidden />
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

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
          <div className="h-4 w-1/5 animate-pulse rounded bg-stone-800/50" />
          <div className="h-7 w-2/3 animate-pulse rounded bg-stone-800/40" />
          <div className="h-5 w-1/3 animate-pulse rounded bg-stone-800/30" />
          <div className="mt-4 h-48 w-full animate-pulse rounded bg-stone-800/20" />
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
      <div className="w-full flex-1 pb-12">

        <div className="mb-3">
          <BackTo href="/investigations" />
        </div>

        {/* ══════════════════════════════════════════════════════════
            CASE HEADER
        ══════════════════════════════════════════════════════════ */}
        <header className="mb-0 pb-5 border-b border-stone-800">

          {/* Metadata row — small, quiet */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-[11px] text-stone-600">
            {equipmentId && (
              <span className="font-semibold text-stone-400 uppercase tracking-wider text-[11px]">
                Equipment · {equipmentId}
              </span>
            )}
            {equipmentId && <span aria-hidden>·</span>}
            <span>
              Started by{" "}
              <span className="font-mono text-stone-500">{job.created_by}</span>
            </span>
            <span aria-hidden>·</span>
            <time dateTime={job.created_at}>
              {new Date(job.created_at).toLocaleString()}
            </time>
            <span aria-hidden>·</span>
            <span className="font-mono text-stone-700">
              {job.job_id.slice(0, 8)}
            </span>

            {/* Live indicator */}
            {live && (
              <span className="ml-2 inline-flex items-center gap-1.5 text-stone-500">
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
          <h1 className="text-[26px] font-bold leading-snug text-white tracking-tight">
            {job.objective}
          </h1>

          {/* Parsed report title as subtitle */}
          {parsedFindings?.title && (
            <p className="mt-1 text-[12px] font-semibold uppercase tracking-widest text-stone-600">
              {parsedFindings.title}
            </p>
          )}

          {/* Status pills row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <JobStatusBadge status={job.status} />

            {isCompleted && job.final_report && (
              <>
                <ConfidencePill value={job.final_report.confidence} />
                {citations.length > 0 && (
                  <MetricPill variant="neutral">
                    {citations.length} source{citations.length !== 1 ? "s" : ""} cited
                  </MetricPill>
                )}
                {(job.final_report.contradictions?.length ?? 0) > 0 && (
                  <MetricPill variant="amber">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="size-3" aria-hidden />
                      {job.final_report.contradictions!.length} contradiction
                      {job.final_report.contradictions!.length !== 1 ? "s" : ""}
                    </span>
                  </MetricPill>
                )}
              </>
            )}
          </div>

          {/* Failure / injection banners */}
          {job.status === "failed" && (
            <div className="mt-4 rounded-sm border border-red-800/50 bg-red-950/20 px-4 py-2.5">
              <p className="text-[13px] font-semibold text-red-400">
                Investigation failed
              </p>
              <p className="mt-0.5 text-[11px] text-red-500/70">
                Evidence was insufficient to proceed safely.
              </p>
            </div>
          )}
          {job.status === "blocked_injection" && (
            <div className="mt-4 rounded-sm border border-fuchsia-800/50 bg-fuchsia-950/20 px-4 py-2.5">
              <p className="text-[13px] font-semibold text-fuchsia-400">
                Blocked — injection attempt detected
              </p>
              <p className="mt-0.5 text-[11px] text-fuchsia-500/70">
                Poisoned chunk excluded. Investigation continued.
              </p>
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

        {/* Approval gate — awaiting decision */}
        {approval && job.status === "awaiting_approval" && (
          <div className="mt-4 mb-2">
            <SectionHeading>Approval gate</SectionHeading>
            <ApprovalCard
              approval={approval}
              viewerRole={auth?.user.role ?? ""}
              deciding={deciding}
              onDecide={handleDecision}
            />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            RUNNING STATE — two-column
        ══════════════════════════════════════════════════════════ */}
        {live && (
          <div className="relative mt-6">
            <div
              className="pointer-events-none absolute inset-y-0 left-[60%] hidden w-px lg:block"
              style={{ background: "rgba(68,64,60,0.22)" }}
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
            COMPLETED STATE
        ══════════════════════════════════════════════════════════ */}
        {isCompleted && job.final_report && (
          <>
            {/* PRIMARY FINDING HERO — full width */}
            <div className="mt-6">
              {parsedFindings?.primaryFinding ? (
                <PrimaryFindingHero
                  finding={parsedFindings.primaryFinding}
                  report={job.final_report}
                  citationCount={citations.length}
                />
              ) : (
                /* Fallback if no parsed primary finding — still show confidence */
                <div className="mb-0 border-b border-stone-800 pb-6">
                  <SectionHeading>Confidence</SectionHeading>
                  <ConfidencePill value={job.final_report.confidence} />
                </div>
              )}
            </div>

            {/* THREE-COLUMN WORKSPACE */}
            <div className="relative mt-6">
              {/* Column dividers */}
              <div className="pointer-events-none absolute inset-y-0 left-[22%] hidden w-px lg:block" style={{ background: "rgba(68,64,60,0.28)" }} aria-hidden />
              <div className="pointer-events-none absolute inset-y-0 left-[70%] hidden w-px lg:block" style={{ background: "rgba(68,64,60,0.28)" }} aria-hidden />

              <div className="grid grid-cols-1 gap-8 lg:grid-cols-[22fr_48fr_30fr]">

                {/* ── LEFT: pipeline + activity + approval record ── */}
                <div className="flex min-w-0 flex-col">
                  <PipelineColumn
                    events={events}
                    tools={tools}
                    approval={
                      approval && job.status !== "awaiting_approval"
                        ? approval
                        : null
                    }
                    viewerRole={auth?.user.role ?? ""}
                  />
                </div>

                {/* ── CENTER: findings workspace ── */}
                <div className="flex min-w-0 flex-col lg:px-7">
                  <FindingsCenter
                    report={job.final_report}
                    citations={citations}
                    jobId={jobId!}
                  />
                </div>

                {/* ── RIGHT: asset context + evidence panel ── */}
                <div className="flex min-w-0 flex-col lg:pl-1">
                  <AssetContextPanel
                    jobId={jobId!}
                    equipmentId={equipmentId}
                    hasImage={!!job.context_image_path}
                  />
                  <EvidencePanel jobId={jobId!} citations={citations} />
                </div>

              </div>
            </div>
          </>
        )}

        {/* Completed but no report */}
        {isCompleted && !job.final_report && (
          <p className="mt-6 text-[13px] text-stone-600">
            Investigation did not produce a final report.
          </p>
        )}

        {/* Non-running, non-completed status */}
        {!live && !isCompleted && (
          <p className="mt-6 text-[12px] text-stone-600">
            Investigation status: {job.status}
          </p>
        )}

      </div>
    </AppShell>
  );
}
