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
import { parseCitation } from "@/lib/citation";

interface CitationLinkProps {
  citation: string;
  seq?: number;
}

export function CitationLink({ citation, seq }: CitationLinkProps) {
  const [open, setOpen] = useState(false);
  const parsed = parseCitation(citation);

  if (!parsed) {
    return <span className="font-mono text-xs">{citation}</span>;
  }

  return (
    <>
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 font-mono text-xs underline underline-offset-2"
        onClick={() => setOpen(true)}
      >
        [{parsed.title}, {parsed.revision}, {parsed.locator}]
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{parsed.title}</DialogTitle>
            <DialogDescription>
              Source inspector — revision {parsed.revision}
            </DialogDescription>
          </DialogHeader>
          <dl className="text-sm">
            <div className="flex gap-2 py-1">
              <dt className="w-36 shrink-0 font-medium">Revision</dt>
              <dd>{parsed.revision}</dd>
            </div>
            <div className="flex gap-2 py-1">
              <dt className="w-36 shrink-0 font-medium">Page/section</dt>
              <dd>{parsed.locator}</dd>
            </div>
            <div className="flex gap-2 py-1">
              <dt className="w-36 shrink-0 font-medium">Chunk ID</dt>
              <dd className="font-mono break-all">{parsed.chunkId}</dd>
            </div>
            {seq !== undefined && (
              <div className="flex gap-2 py-1">
                <dt className="w-36 shrink-0 font-medium">Streamed at</dt>
                <dd className="font-mono">event #{seq}</dd>
              </div>
            )}
          </dl>
          <Separator />
          <p className="text-muted-foreground text-xs">
            Passage content, document classification/content-hash, and
            why-retrieved context are not yet served by a frozen contract
            endpoint (see DECISIONS.md [PROPOSAL] 2026-08-29 web). This
            inspector shows exactly what the citation reference carries today.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
