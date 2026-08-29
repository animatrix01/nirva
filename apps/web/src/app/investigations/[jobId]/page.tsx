"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { JobStatusBadge } from "@/components/job-status-badge";
import { EventTimeline } from "@/components/investigation/EventTimeline";
import { CitationLink } from "@/components/investigation/CitationLink";
import { EvidencePanel } from "@/components/investigation/EvidencePanel";
import { ToolActivityList } from "@/components/investigation/ToolActivityList";
import { ApprovalCard } from "@/components/investigation/ApprovalCard";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  Sources,
  SourcesContent,
  SourcesTrigger,
  Source,
} from "@/components/ai-elements/sources";
import { useStoredAuth } from "@/lib/auth-client";
import { bannerForStatus } from "@/components/investigation/timeline";
import { ApiError, getJob, getArtifact, decideApproval } from "@/lib/api";
import { openJobStream } from "@/lib/sse";
import { isArtifactPayloadRef } from "@/lib/artifacts";
import type {
  ApprovalRequest,
  JobArtifact,
  ToolActivity,
} from "@/lib/artifacts";
import type { CitationRef, JobDetail, SseEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

type StreamState = "connecting" | "open" | "reconnecting" | "closed";

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
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [streamState, setStreamState] = useState<StreamState>("connecting");
  const [deciding, setDeciding] = useState(false);

  const streamRef = useRef<{ close: () => void } | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const fetched = new Set<string>();

    const fetchArtifact = (ref: string) => {
      if (!isArtifactPayloadRef(ref)) return;
      if (fetched.has(ref)) return;
      fetched.add(ref);
      void getArtifact(jobId, ref)
        .then((artifact) => {
          if (!cancelled) {
            setArtifacts((prev) => ({ ...prev, [ref]: artifact }));
          }
        })
        .catch(() => {
          // Artifact unavailable: leave the panel showing "no data" state.
        });
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
        onStateChange: (state) => {
          if (!cancelled) setStreamState(state);
        },
        onEvent: (event) => {
          if (cancelled) return;
          setEvents((prev) => {
            if (prev.some((p) => p.seq === event.seq)) return prev;
            return [...prev, event].sort((a, b) => a.seq - b.seq);
          });
          if (event.payload_ref) fetchArtifact(event.payload_ref);
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

  if (jobError) {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader title="Investigation" />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          <p role="alert" className="text-destructive text-sm">
            {jobError}
          </p>
        </main>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader title="Investigation" />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6" aria-busy="true">
          <div className="h-8 w-2/3 animate-pulse rounded bg-muted/50" />
          <div className="mt-4 h-40 animate-pulse rounded bg-muted/50" />
        </main>
      </div>
    );
  }

  const banner = bannerForStatus(job.status);
  const live = ["queued", "running"].includes(job.status);

  const citations: CitationRef[] = job.final_report?.citations ?? [];
  const tools: ToolActivity[] = Object.values(artifacts).flatMap((a) =>
    a.kind === "tool" ? [a.tool] : []
  );
  const approval: ApprovalRequest | null =
    (artifacts["approval_request"] as Extract<JobArtifact, { kind: "approval" }> | undefined)
      ?.approval ?? null;

  const handleDecision = (decision: "approved" | "rejected", comment: string | null) => {
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
          prev && prev.status === "awaiting_approval"
            ? { ...prev, status: "completed" }
            : prev
        );
      })
      .catch((e: unknown) => {
        setJobError(
          e instanceof ApiError
            ? e.body.detail
            : "Failed to record approval decision"
        );
      })
      .finally(() => setDeciding(false));
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="Investigation" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <JobStatusBadge status={job.status} />
            {job.current_node && (
              <span className="text-muted-foreground text-xs">
                node: <span className="font-mono">{job.current_node}</span>
              </span>
            )}
            <time className="text-muted-foreground ml-auto text-xs">
              created {new Date(job.created_at).toLocaleString()}
            </time>
          </div>
          <h1 className="text-lg font-semibold leading-snug">{job.objective}</h1>
          <p className="text-muted-foreground text-xs">
            Started by <span className="font-mono">{job.created_by}</span>
          </p>
          <p aria-live="polite" className="sr-only">
            Stream {streamState}
            {live ? `, job status ${job.status}` : `, job status ${job.status}`}
          </p>
          {streamState === "reconnecting" && live && (
            <p role="status" className="text-amber-700 dark:text-amber-400 text-xs">
              Connection lost — resuming from last received event…
            </p>
          )}
        </header>

        {banner && (
          <div
            role="status"
            className={cn("mt-4 rounded-lg border p-3 text-sm", BANNER_TONE[banner.tone])}
          >
            {banner.text}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[65fr_35fr]">
          <div className="flex min-w-0 flex-col gap-6">
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">
                Plan &amp; timeline
              </h2>
              <EventTimeline events={events} />
            </section>

            {job.final_report && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">
                  Final report
                </h2>
                <div className="text-sm">
                  <Message from="assistant">
                    <MessageContent>
                      {/* MessageResponse renders sanitized markdown — raw HTML disabled */}
                      <MessageResponse>{job.final_report.findings}</MessageResponse>
                    </MessageContent>
                  </Message>
                  <p className="mt-3 text-xs">
                    Confidence: {(job.final_report.confidence * 100).toFixed(0)}%
                  </p>
                  {job.final_report.assumptions.length > 0 && (
                    <div className="mt-3">
                      <h3 className="text-xs font-semibold uppercase">Assumptions</h3>
                      <ul className="text-muted-foreground list-disc pl-4 text-xs">
                        {job.final_report.assumptions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {job.final_report.gaps.length > 0 && (
                    <div className="mt-3">
                      <h3 className="text-xs font-semibold uppercase">Gaps</h3>
                      <ul className="text-muted-foreground list-disc pl-4 text-xs">
                        {job.final_report.gaps.map((g, i) => (
                          <li key={i}>{g}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {citations.length > 0 && (
                    <div className="mt-3">
                      <Sources>
                        <SourcesTrigger count={citations.length} />
                        <SourcesContent>
                          {citations.map((c) => (
                            <Source key={c.chunk_id} href="#" onClick={(e) => e.preventDefault()}>
                              <CitationLink citation={c} jobId={jobId!} />
                            </Source>
                          ))}
                        </SourcesContent>
                      </Sources>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          <aside className="flex min-w-0 flex-col gap-6">
            {approval && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">
                  Approval gate
                </h2>
                <ApprovalCard
                  approval={approval}
                  viewerRole={auth?.user.role ?? ""}
                  deciding={deciding}
                  onDecide={handleDecision}
                />
              </section>
            )}
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">
                Evidence
              </h2>
              <EvidencePanel
                jobId={jobId!}
                citations={citations}
                selectedChunkId={selectedChunkId}
                onSelect={setSelectedChunkId}
              />
            </section>
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">
                Tool activity
              </h2>
              <ToolActivityList tools={tools} />
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
