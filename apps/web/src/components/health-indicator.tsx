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

  const allUp =
    !down &&
    health !== null &&
    health.status === "ok" &&
    Object.values(health.services).every((s) => s === "up");

  const coreUp =
    !down &&
    health !== null &&
    health.services.postgres === "up" &&
    health.services.storage === "up";

  const label = allUp || coreUp ? "Online" : "Degraded";
  const isHealthy = allUp || coreUp;

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
      className="inline-flex items-center gap-1.5 text-xs"
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          isHealthy ? "bg-[#c8f135]" : "animate-pulse bg-amber-500"
        )}
      />
      <span className={isHealthy ? "text-neutral-500" : "text-amber-500"}>
        {label}
      </span>
    </span>
  );
}
