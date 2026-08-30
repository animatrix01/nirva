"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/app-header";
import { ApiError, createJob } from "@/lib/api";

const MIN_OBJECTIVE = 8;

export function validateObjective(objective: string): string | null {
  if (objective.trim().length < MIN_OBJECTIVE) {
    return `Objective must be at least ${MIN_OBJECTIVE} characters.`;
  }
  return null;
}

export default function NewInvestigationPage() {
  const router = useRouter();
  const [objective, setObjective] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Case ID is generated client-side only (after mount) — Math.random() during
  // SSR prerender would mismatch hydration and force a full client re-render.
  const caseIdRef = useRef<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!mounted) {
      caseIdRef.current = `INV-2026-${Math.random()
        .toString(16)
        .slice(2, 6)
        .toUpperCase()}`;
      setMounted(true);
    }
  }, [mounted]);
  const caseId = mounted ? (caseIdRef.current as string) : "INV-2026-…";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const invalid = validateObjective(objective);
    setClientError(invalid);
    if (invalid) return;

    setSubmitting(true);
    try {
      const job = await createJob(
        objective.trim(),
        equipmentId.trim() ? equipmentId.trim() : null
      );
      router.push(`/investigations/${job.job_id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setServerError(
          err.body.field
            ? `${err.body.field}: ${err.body.detail}`
            : err.body.detail
        );
      } else if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError("Failed to create investigation");
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="New investigation" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-card">
          {/* Header row */}
          <div className="flex items-start justify-between gap-6 px-6 pt-6">
            <div>
              <h1 className="text-sm font-semibold uppercase tracking-wide text-white">
                New investigation
              </h1>
              <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-neutral-400">
                Describe what to investigate. NIRVA will plan the steps,
                retrieve cited evidence, and pause for approval before any
                consequential action.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">
                Case ID
              </p>
              <p className="mt-1 font-mono text-sm text-neutral-300">{caseId}</p>
            </div>
          </div>

          <div className="mt-5 border-t border-neutral-800" />

          <form onSubmit={handleSubmit}>
            {/* 01 · Objective */}
            <div className="flex gap-5 px-6 py-6">
              <span className="shrink-0 font-mono text-xs text-sky-400">01</span>
              <div className="min-w-0 flex-1 space-y-2.5">
                <Label
                  htmlFor="objective"
                  className="text-xs font-semibold uppercase tracking-wide text-neutral-200"
                >
                  Objective
                </Label>
                <p className="text-xs text-neutral-500">
                  What are you investigating?
                </p>
                <textarea
                  id="objective"
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-28 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none focus-visible:ring-3"
                  placeholder="e.g., Investigate why Pump P-204 has failed repeatedly. Compare maintenance history with the OEM manual and safety SOP."
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  required
                />
                {clientError && (
                  <p role="alert" className="text-destructive text-sm">
                    {clientError}
                  </p>
                )}
              </div>
            </div>

            {/* 02 · Equipment */}
            <div className="flex gap-5 border-t border-neutral-800/60 px-6 py-6">
              <span className="shrink-0 font-mono text-xs text-sky-400">02</span>
              <div className="min-w-0 flex-1 space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-200">
                  Equipment
                </p>
                <Label
                  htmlFor="equipment"
                  className="block text-xs text-neutral-500"
                >
                  Asset / equipment ID (optional)
                </Label>
                <Input
                  id="equipment"
                  placeholder="e.g., P-204"
                  value={equipmentId}
                  onChange={(e) => setEquipmentId(e.target.value)}
                />
                <p className="text-xs text-neutral-600">
                  Providing an asset ID helps NIRVA focus evidence retrieval for
                  that asset.
                </p>
              </div>
            </div>

            {serverError && (
              <p role="alert" className="px-6 pb-2 text-destructive text-sm">
                {serverError}
              </p>
            )}

            {/* Footer action bar */}
            <div className="flex items-center justify-between gap-4 border-t border-neutral-800 bg-neutral-900/40 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <Shield className="size-4 shrink-0 text-neutral-500" />
                <div className="text-[11px] leading-snug text-neutral-500">
                  <p>Investigation will run locally.</p>
                  <p>Evidence retrieval follows your access permissions.</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={submitting}
                  onClick={() => router.push("/investigations")}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Starting…" : "Start investigation"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
