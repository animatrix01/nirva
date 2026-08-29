"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

// Local/Offline system-status indicator backed by real GET /api/health data.
export function HealthIndicator() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [down, setDown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      void getHealth()
        .then((h) => {
          if (!cancelled) {
            setHealth(h);
            setDown(false);
          }
        })
        .catch(() => {
          if (!cancelled) setDown(true);
        });
    };
    queueMicrotask(poll);
    const timer = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const allUp =
    !down &&
    health !== null &&
    health.status === "ok" &&
    Object.values(health.services).every((s) => s === "up");

  return (
    <span
      role="status"
      title={
        down
          ? "Health endpoint unreachable"
          : health
            ? `postgres:${health.services.postgres} qdrant:${health.services.qdrant} model_gateway:${health.services.model_gateway} storage:${health.services.storage}`
            : "Checking local services…"
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        allUp
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          allUp ? "bg-emerald-600 dark:bg-emerald-400" : "animate-pulse bg-amber-600 dark:bg-amber-400"
        )}
      />
      {allUp ? "Local / Offline" : down ? "Health unreachable" : "Degraded"}
    </span>
  );
}
