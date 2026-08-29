"use client";

import type { SecurityEvent } from "@/lib/artifacts";

export function InjectionAlert({ event }: { event: SecurityEvent }) {
  return (
    <div
      role="alert"
      aria-label="Injection attempt blocked"
      className="rounded-lg border border-fuchsia-300 bg-fuchsia-50 p-3 text-sm text-fuchsia-900 dark:border-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-200"
    >
      <p className="font-semibold">
        Blocked: retrieved content attempted to inject instructions
      </p>
      <dl className="mt-2 space-y-1 text-xs">
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 font-medium">Document</dt>
          <dd>{event.document_title}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 font-medium">Pattern</dt>
          <dd className="font-mono break-all">{event.pattern}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 font-medium">Chunk</dt>
          <dd className="font-mono break-all">{event.chunk_id}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 font-medium">Action taken</dt>
          <dd>
            Excluded from evidence, investigation continued
            {event.action ? ` (${event.action})` : ""}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs">
        Retrieved content is evidence, not instructions — the poisoned chunk was
        zoned as data and never shown to the model as a command.
      </p>
    </div>
  );
}
