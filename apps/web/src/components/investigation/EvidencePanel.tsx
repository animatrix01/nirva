"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ApiError, getEvidence } from "@/lib/api";
import type { CitationRef } from "@/lib/types";
import type { EvidenceReference } from "@/lib/artifacts";
import { cn } from "@/lib/utils";

export function citationLabel(c: CitationRef): string {
  return `[${c.title}, ${c.revision}, ${c.locator}]`;
}

export function EvidencePanel({
  jobId,
  citations,
  selectedChunkId,
  onSelect,
}: {
  jobId: string;
  citations: CitationRef[];
  selectedChunkId: string | null;
  onSelect: (chunkId: string) => void;
}) {
  const [detail, setDetail] = useState<EvidenceReference | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedChunkId) return;
    const signal = { cancelled: false };
    queueMicrotask(() => {
      void getEvidence(jobId, selectedChunkId)
        .then((e) => {
          if (!signal.cancelled) {
            setDetail(e);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (!signal.cancelled) {
            setError(
              e instanceof ApiError
                ? e.body.detail
                : "Failed to load evidence chunk"
            );
            setDetail(null);
          }
        });
    });
    return () => {
      signal.cancelled = true;
    };
  }, [jobId, selectedChunkId]);

  if (citations.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No cited evidence yet. Sources appear here once the final report lands.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1">
        {citations.map((c) => (
          <li key={c.chunk_id}>
            <button
              type="button"
              onClick={() => onSelect(c.chunk_id)}
              className={cn(
                "w-full rounded border px-2 py-1.5 text-left text-xs",
                selectedChunkId === c.chunk_id
                  ? "border-ring bg-muted"
                  : "hover:bg-muted/50"
              )}
            >
              <span className="font-medium">{citationLabel(c)}</span>
            </button>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}

      {selectedChunkId && !detail && !error && (
        <div className="h-20 animate-pulse rounded bg-muted/50" aria-busy="true" />
      )}

      {detail && (
        <div className="rounded-lg border p-3 text-sm">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{detail.confidentiality_level}</Badge>
            <span className="text-muted-foreground text-xs">
              {detail.document_title} · {detail.revision} ·{" "}
              {detail.page !== null ? `page ${detail.page}` : ""}
              {detail.section ? ` §${detail.section}` : ""}
            </span>
          </div>
          <p className="rounded bg-amber-50 p-2 text-sm leading-relaxed dark:bg-amber-950/40">
            <mark className="bg-transparent text-inherit">
              {detail.passage_text}
            </mark>
          </p>
          <dl className="mt-3 space-y-1 text-xs">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium">Chunk ID</dt>
              <dd className="font-mono break-all">{detail.chunk_id}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium">Equipment</dt>
              <dd>{detail.equipment_id ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium">Content hash</dt>
              <dd className="font-mono break-all">{detail.content_hash}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium">Why retrieved</dt>
              <dd>
                {detail.why_retrieved}
                {typeof detail.score === "number" && (
                  <span className="text-muted-foreground">
                    {" "}
                    — score {detail.score.toFixed(2)}, hybrid dense+sparse,
                    rank-fused
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
