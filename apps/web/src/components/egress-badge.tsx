"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { resetEgress, useEgress } from "@/lib/egress-watch";
import { cn } from "@/lib/utils";

/**
 * EgressBadge — live air-gap proof in the app topbar.
 *
 * Shows unique external endpoints contacted this page session (normally 0).
 * Click resets the counter — e.g. right before the golden demo run.
 * A red state means something leaked; the tooltip names the host.
 */
export function EgressBadge() {
  const { external, lastHost } = useEgress();
  const clean = external === 0;

  return (
    <button
      type="button"
      onClick={resetEgress}
      title={
        clean
          ? "No external network calls this session — air-gapped. Click to reset."
          : `External contact detected: ${lastHost ?? "unknown"}. Click to reset.`
      }
      aria-label={
        clean
          ? "Air-gapped: zero external network calls this session"
          : `${external} external network endpoints contacted this session`
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition",
        clean
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
          : "border-red-200 bg-red-50 text-red-700 hover:border-red-300",
      )}
    >
      {clean ? (
        <ShieldCheck className="size-3.5" aria-hidden />
      ) : (
        <ShieldAlert className="size-3.5" aria-hidden />
      )}
      {clean ? "0 external" : `${external} external`}
    </button>
  );
}
