"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

// Simple system-status indicator (Online / Degraded)
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

  const coreUp =
    !down &&
    health !== null &&
    health.services.postgres === "up" &&
    health.services.storage === "up";

  const label = coreUp ? "Online" : "Degraded";
  const isHealthy = coreUp;

  return (
    <span
      role="status"
      title={
        down
          ? "Health endpoint unreachable"
          : health
            ? `postgres:${health.services.postgres} qdrant:${health.services.qdrant} model_gateway:${health.services.model_gateway} storage:${health.services.storage}`
            : "Checking services…"
      }
      className="inline-flex items-center gap-2 text-sm"
    >
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          isHealthy ? "bg-[#B9FF52]" : "animate-pulse bg-amber-500"
        )}
      />
      <span className={isHealthy ? "text-slate-600" : "text-amber-600"}>
        {label}
      </span>
    </span>
  );
}
