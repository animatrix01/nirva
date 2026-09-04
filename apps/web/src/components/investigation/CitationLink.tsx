"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ApiError, getDocumentContent, getEvidence } from "@/lib/api";
import type { CitationRef } from "@/lib/types";
import type { EvidenceReference } from "@/lib/artifacts";
import { cn } from "@/lib/utils";

interface CitationLinkProps {
  citation: CitationRef;
  jobId: string;
}

function MetaRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 py-2.5 border-b border-border/50 last:border-0">
      <dt className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground self-start pt-0.5">{label}</dt>
      <dd className={cn("text-sm text-foreground leading-relaxed", mono && "font-mono text-xs break-all bg-muted/40 rounded px-2.5 py-1.5")}>{value}</dd>
    </div>
  );
}

export function CitationLink({ citation, jobId }: CitationLinkProps) {
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceReference | null>(null);
  const [docChunks, setDocChunks] = useState<
    Array<{ chunk_id: string; page: number | null; section: string | null; text: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [docUnavailable, setDocUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);

  const isToolSource =
    citation.chunk_id.startsWith("tool-") ||
    citation.title.toLowerCase().includes("(read-only tool)");

  async function handleOpen() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setDocUnavailable(false);
    setEvidence(null);
    try {
      const chunk = await getEvidence(jobId, citation.chunk_id);
      setEvidence(chunk);
      try {
        const doc = await getDocumentContent(chunk.document_id);
        setDocChunks(doc.chunks);
      } catch {
        setDocUnavailable(true);
      }
    } catch (e: unknown) {
      setError(
        e instanceof ApiError ? e.body.detail : "Failed to load source passage"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 font-mono text-xs underline underline-offset-2"
        onClick={() => void handleOpen()}
      >
        [{citation.title}, {citation.revision}, {citation.locator}]
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="p-0 overflow-hidden flex flex-col !max-w-none"
          style={{ width: "min(95vw, 860px)", maxHeight: "88vh" }}
        >
          {/* Header */}
          <DialogHeader className="px-8 pt-6 pb-4 border-b border-border shrink-0">
            <DialogTitle className="text-base font-semibold">{citation.title}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Source inspector — revision {citation.revision}
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-6">

            {loading && (
              <div className="h-32 animate-pulse rounded bg-muted/50" aria-busy="true" />
            )}
            {error && (
              <p role="alert" className="text-destructive text-sm">{error}</p>
            )}

            {evidence && (
              <>
                {/* ── Source Passage ── */}
                <section>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Source Passage
                  </p>
                  <div className="rounded-lg border border-amber-700/30 bg-amber-950/20 px-5 py-4">
                    <p className="text-sm leading-relaxed text-amber-100/90 whitespace-pre-wrap">
                      {evidence.passage_text}
                    </p>
                  </div>
                </section>

                <Separator />

                {/* ── Metadata table ── */}
                <section>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    Chunk Metadata
                  </p>
                  <dl className="flex flex-col">
                    <MetaRow label="Source" value={isToolSource ? "tool (read-only result)" : "retrieval"} />
                    <MetaRow
                      label="Page / Section"
                      value={
                        <>
                          {evidence.page !== null ? `Page ${evidence.page}` : "—"}
                          {evidence.section ? ` · §${evidence.section}` : ""}
                        </>
                      }
                    />
                    <MetaRow label="Classification" value={<span className="capitalize">{evidence.confidentiality_level}</span>} />
                    <MetaRow
                      label="Why Retrieved"
                      value={
                        <>
                          {evidence.why_retrieved}
                          {typeof evidence.score === "number" && (
                            <span className="text-muted-foreground text-xs block mt-1">
                              Score {evidence.score.toFixed(2)} · hybrid dense+sparse · rank-fused
                            </span>
                          )}
                        </>
                      }
                    />
                    <MetaRow label="Chunk ID" value={evidence.chunk_id} mono />
                    <MetaRow label="Content Hash" value={evidence.content_hash} mono />
                  </dl>
                </section>

                {/* ── Document context chunks ── */}
                {(docChunks.length > 0 || docUnavailable) && (
                  <>
                    <Separator />
                    <section>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                        {docUnavailable
                          ? "Document Context"
                          : `Document Context (${docChunks.length} chunks)`}
                      </p>
                      {docUnavailable ? (
                        <p className="text-muted-foreground text-sm">
                          Full document view is not available for this source — tool results are shown as passage only.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {docChunks.map((c) => (
                            <div
                              key={c.chunk_id}
                              className={cn(
                                "rounded-lg border px-4 py-3 text-sm leading-relaxed",
                                c.chunk_id === evidence.chunk_id
                                  ? "border-amber-600/50 bg-amber-950/30"
                                  : "border-border bg-muted/20"
                              )}
                            >
                              <span className="text-[10px] font-mono text-muted-foreground block mb-1">
                                p.{c.page ?? "?"}{c.section ? ` · §${c.section}` : ""}
                              </span>
                              {c.text}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
