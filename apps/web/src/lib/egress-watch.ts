"use client";

/**
 * egress-watch — session-scoped external-network observer.
 *
 * Counts unique external (cross-origin) http(s) endpoints contacted by this
 * page. Same-origin API calls, ws(s) streams, data:/blob: URLs are never
 * counted. Used by <EgressBadge/> to prove air-gapped operation live.
 *
 * Honest labeling: the count is per page session (reset on reload, or via
 * resetEgress()). It observes browser traffic only — it is a demo
 * instrument, not a security boundary.
 */

import { useEffect, useSyncExternalStore } from "react";

export type UrlClass = "external" | "local" | "ignore";

/**
 * Pure classifier (unit-tested). Only http(s) URLs with a foreign origin
 * count as external.
 */
export function classifyUrl(raw: string, origin: string): UrlClass {
  let parsed: URL;
  try {
    parsed = new URL(raw, origin);
  } catch {
    return "ignore";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "ignore";
  }
  let base: URL;
  try {
    base = new URL(origin);
  } catch {
    return "ignore";
  }
  // Demo-machine / dev loopback services (api :8000, qdrant :6333, …) live
  // on the same host as the page. Port differences must not count as
  // external — only genuinely foreign hosts do.
  const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (LOOPBACK.has(parsed.hostname) && LOOPBACK.has(base.hostname)) {
    return "local";
  }
  return parsed.origin === base.origin ? "local" : "external";
}

export interface EgressSnapshot {
  external: number;
  lastHost: string | null;
}

let snapshot: EgressSnapshot = { external: 0, lastHost: null };
const listeners = new Set<() => void>();
const seen = new Set<string>();
let installed = false;

function emit(): void {
  listeners.forEach((l) => l());
}

function record(raw: string): void {
  if (typeof window === "undefined") return;
  if (seen.has(raw)) return;
  if (classifyUrl(raw, window.location.origin) !== "external") return;
  let host = raw;
  try {
    host = new URL(raw, window.location.origin).hostname;
  } catch {
    /* keep raw */
  }
  seen.add(raw);
  snapshot = { external: snapshot.external + 1, lastHost: host };
  emit();
}

function install(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Past + future resource loads (img/script/link/fetch/css).
  try {
    const scan = (list: PerformanceEntryList) => {
      for (const entry of list) {
        const name = (entry as PerformanceResourceTiming).name;
        if (typeof name === "string" && name) record(name);
      }
    };
    scan(performance.getEntriesByType("resource"));
    const observer = new PerformanceObserver((list) => scan(list.getEntries()));
    observer.observe({ entryTypes: ["resource"] });
  } catch {
    /* PerformanceObserver unavailable — fetch/XHR hooks still apply */
  }

  // Direct fetch calls.
  try {
    const originalFetch = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      record(url);
      return originalFetch(input, init);
    }) as typeof window.fetch;
  } catch {
    /* non-configurable fetch — ignore */
  }

  // XHR fallback (rare; kept for completeness).
  try {
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest,
      ...args: [string, string | URL, ...unknown[]]
    ): void {
      const url = args[1];
      record(typeof url === "string" ? url : url.href);
      return (originalOpen as (...a: unknown[]) => void).apply(this, args);
    };
  } catch {
    /* ignore */
  }
}

/** Reset the session counter (e.g. right before the golden demo run). */
export function resetEgress(): void {
  seen.clear();
  snapshot = { external: 0, lastHost: null };
  emit();
}

const subscribe = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Live external-call snapshot; installs the observer on first use. */
export function useEgress(): EgressSnapshot {
  useEffect(() => {
    install();
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => ({ external: 0, lastHost: null }),
  );
}
