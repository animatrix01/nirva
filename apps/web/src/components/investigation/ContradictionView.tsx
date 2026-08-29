"use client";

import type { Contradiction } from "@/lib/artifacts";

function ContradictionCard({
  label,
  citation,
  passage,
}: {
  label: string;
  citation: string;
  passage: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
        {label}
      </p>
      <p className="font-mono text-xs">{citation}</p>
      <p className="mt-2 text-sm leading-relaxed">“{passage}”</p>
    </div>
  );
}

export function ContradictionView({ contradiction }: { contradiction: Contradiction }) {
  return (
    <div className="rounded-lg border border-amber-300 p-3 dark:border-amber-800">
      <p className="text-sm font-semibold">
        Contradiction: {contradiction.topic}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ContradictionCard
          label="Source A"
          citation={contradiction.source_a.citation}
          passage={contradiction.source_a.passage_text}
        />
        <ContradictionCard
          label="Source B"
          citation={contradiction.source_b.citation}
          passage={contradiction.source_b.passage_text}
        />
      </div>
      <p className="text-muted-foreground mt-3 text-xs">{contradiction.note}</p>
    </div>
  );
}
