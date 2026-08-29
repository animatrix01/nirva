"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/app-header";
import { useStoredAuth } from "@/lib/auth-client";
import { ApiError, getAudit } from "@/lib/api";
import type { AuditResponse } from "@/lib/types";

const OUTCOME_STYLE: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  blocked:
    "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300",
};

export default function AuditPage() {
  const auth = useStoredAuth();
  const role = auth?.user.role ?? "";
  const canView = role === "admin" || role === "safety_officer";

  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) return;
    const signal = { cancelled: false };
    queueMicrotask(() => {
      void getAudit({ limit: 50 })
        .then((data) => {
          if (!signal.cancelled) setAudit(data);
        })
        .catch((e: unknown) => {
          if (!signal.cancelled) {
            setError(
              e instanceof ApiError ? e.body.detail : "Failed to load audit log"
            );
          }
        });
    });
    return () => {
      signal.cancelled = true;
    };
  }, [canView]);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="Audit log" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {!canView ? (
          <p role="alert" className="text-destructive text-sm">
            Audit access is restricted to admins and safety officers.
          </p>
        ) : error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : !audit ? (
          <div className="h-64 animate-pulse rounded bg-muted/50" aria-busy="true" />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Hash chain:</span>
              {audit.chain_valid ? (
                <Badge
                  variant="secondary"
                  className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                >
                  valid — tamper-evident
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                  BROKEN — possible tampering
                </Badge>
              )}
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Actor</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Summary (redacted)</th>
                    <th className="px-3 py-2">Outcome</th>
                    <th className="px-3 py-2">Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.events.map((e) => (
                    <tr key={e.event_id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(e.ts).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono">{e.actor}</td>
                      <td className="px-3 py-2 font-mono">{e.action}</td>
                      <td className="max-w-64 truncate px-3 py-2">
                        {e.argument_summary}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className={OUTCOME_STYLE[e.outcome]}>
                          {e.outcome}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {e.hash.slice(0, 10)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
