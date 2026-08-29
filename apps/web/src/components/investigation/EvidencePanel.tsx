"use client";

import { Badge } from "@/components/ui/badge";
import type { EvidenceReference } from "@/lib/artifacts";
import { cn } from "@/lib/utils";

export function evidenceLocator(e: EvidenceReference): string {
  if (e.page !== null && e.section) return `page ${e.page}, §${e.section}`;
  if (e.page !== null) return `page ${e.page}`;
  return e.section ?? "—";
}

export function EvidencePanel({
  evidence,
  selectedChunkId,
  onSelect,
}: {
  evidence: EvidenceReference[];
  selectedChunkId: string | null;
  onSelect: (chunkId: string) => void;
}) {
  if (evidence.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No evidence retrieved yet. Sources appear here as retrieval events
        stream in.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1">
        {evidence.map((e) => (
          <li key={e.chunk_id}>
            <button
              type="button"
              onClick={() => onSelect(e.chunk_id)}
              className={cn(
                "w-full rounded border px-2 py-1.5 text-left text-xs",
                selectedChunkId === e.chunk_id
                  ? "border-ring bg-muted"
                  : "hover:bg-muted/50"
              )}
            >
              <span className="font-medium">
                [{e.document_title}, {e.revision}, {evidenceLocator(e)}]
              </span>
              <span className="text-muted-foreground ml-2">
                ({e.document_type})
              </span>
            </button>
          </li>
        ))}
      </ul>

      {evidence
        .filter((e) => e.chunk_id === selectedChunkId)
        .map((e) => (
          <div key={e.chunk_id} className="rounded-lg border p-3 text-sm">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{e.confidentiality_level}</Badge>
              <span className="text-muted-foreground text-xs">
                {e.document_title} · {e.revision} · {evidenceLocator(e)}
              </span>
            </div>
            <p className="rounded bg-amber-50 p-2 text-sm leading-relaxed dark:bg-amber-950/40">
              <mark className="bg-transparent text-inherit">
                {e.passage_text}
              </mark>
            </p>
            <dl className="mt-3 space-y-1 text-xs">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 font-medium">Chunk ID</dt>
                <dd className="font-mono break-all">{e.chunk_id}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 font-medium">Content hash</dt>
                <dd className="font-mono break-all">{e.content_hash}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 font-medium">Why retrieved</dt>
                <dd>{e.why_retrieved}</dd>
              </div>
            </dl>
          </div>
        ))}
    </div>
  );
}
