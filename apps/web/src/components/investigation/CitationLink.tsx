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

export function CitationLink({ citation, jobId }: CitationLinkProps) {
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceReference | null>(null);
  const [docChunks, setDocChunks] = useState<
    Array<{ chunk_id: string; page: number | null; section: string | null; text: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setEvidence(null);
    try {
      const chunk = await getEvidence(jobId, citation.chunk_id);
      setEvidence(chunk);
      const doc = await getDocumentContent(chunk.document_id);
      setDocChunks(doc.chunks);
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
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base">{citation.title}</DialogTitle>
            <DialogDescription>
              Source inspector — revision {citation.revision}
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="h-24 animate-pulse rounded bg-muted/50" aria-busy="true" />
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          {evidence && (
            <>
              <p className="rounded bg-amber-50 p-2 text-sm leading-relaxed dark:bg-amber-950/40">
                <mark className="bg-transparent text-inherit">
                  {evidence.passage_text}
                </mark>
              </p>
              <dl className="text-xs">
                <div className="flex gap-2 py-0.5">
                  <dt className="w-32 shrink-0 font-medium">Chunk ID</dt>
                  <dd className="font-mono break-all">{evidence.chunk_id}</dd>
                </div>
                <div className="flex gap-2 py-0.5">
                  <dt className="w-32 shrink-0 font-medium">Page/section</dt>
                  <dd>
                    {evidence.page !== null ? `page ${evidence.page}` : ""}
                    {evidence.section ? ` §${evidence.section}` : ""}
                  </dd>
                </div>
                <div className="flex gap-2 py-0.5">
                  <dt className="w-32 shrink-0 font-medium">Classification</dt>
                  <dd>{evidence.confidentiality_level}</dd>
                </div>
                <div className="flex gap-2 py-0.5">
                  <dt className="w-32 shrink-0 font-medium">Content hash</dt>
                  <dd className="font-mono break-all">{evidence.content_hash}</dd>
                </div>
                <div className="flex gap-2 py-0.5">
                  <dt className="w-32 shrink-0 font-medium">Why retrieved</dt>
                  <dd>{evidence.why_retrieved}</dd>
                </div>
              </dl>
              <Separator />
              {docChunks.length > 0 && (
                <div className="max-h-40 overflow-y-auto">
                  <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
                    Document context ({docChunks.length} chunks)
                  </p>
                  <ul className="flex flex-col gap-1">
                    {docChunks.map((c) => (
                      <li
                        key={c.chunk_id}
                        className={cn(
                          "rounded border p-1.5 text-xs",
                          c.chunk_id === evidence.chunk_id &&
                            "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"
                        )}
                      >
                        <span className="text-muted-foreground font-mono">
                          p.{c.page ?? "?"} {c.section ?? ""}
                        </span>{" "}
                        {c.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
