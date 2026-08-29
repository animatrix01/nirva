"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Start an investigation</CardTitle>
            <CardDescription>
              Describe what to investigate. NIRVA will plan the steps, retrieve
              cited evidence, and pause for approval before any consequential
              action.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="objective">Objective</Label>
                <textarea
                  id="objective"
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3"
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
              <div className="flex flex-col gap-2">
                <Label htmlFor="equipment">Asset / equipment ID (optional)</Label>
                <Input
                  id="equipment"
                  placeholder="e.g., P-204"
                  value={equipmentId}
                  onChange={(e) => setEquipmentId(e.target.value)}
                />
              </div>
              {serverError && (
                <p role="alert" className="text-destructive text-sm">
                  {serverError}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Starting…" : "Start investigation"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={submitting}
                  onClick={() => router.push("/investigations")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
