"use client";

import type { SseEvent } from "@/lib/types";
import { getAuthToken } from "@/lib/api";

// ---------------------------------------------------------------------------
// Job SSE stream over fetch (the API authenticates via Authorization header,
// which native EventSource cannot send). Reconnect-and-resync: on reconnect we
// send Last-Event-ID = last received seq; the server replays events with
// seq > that value, so dedupe by seq in the consumer stays correct.
// ---------------------------------------------------------------------------

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

const RECONNECT_BASE_DELAY_MS = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;

export interface JobStreamHandle {
  close: () => void;
}

export function openJobStream(
  jobId: string,
  handlers: {
    onEvent: (event: SseEvent) => void;
    onStateChange?: (state: "connecting" | "open" | "reconnecting") => void;
  }
): JobStreamHandle {
  let lastSeq = -1;
  let closed = false;
  let attempts = 0;
  const controller = new AbortController();

  const delay = () => RECONNECT_BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1);

  const loop = async () => {
    while (!closed && attempts < MAX_RECONNECT_ATTEMPTS) {
      try {
        handlers.onStateChange?.(attempts === 0 ? "connecting" : "reconnecting");
        const token = getAuthToken();
        const response = await fetch(
          `${BASE_URL}/api/jobs/${encodeURIComponent(jobId)}/events`,
          {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              ...(lastSeq >= 0 ? { "Last-Event-ID": String(lastSeq) } : {}),
            },
            signal: controller.signal,
          }
        );
        if (!response.ok || !response.body) {
          throw new Error(`SSE HTTP ${response.status}`);
        }
        attempts = 0;
        handlers.onStateChange?.("open");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            for (const line of frame.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (!data) continue;
              try {
                const event = JSON.parse(data) as SseEvent;
                lastSeq = event.seq;
                handlers.onEvent(event);
              } catch {
                // Malformed frame: ignore; contract guarantees typed JSON.
              }
            }
          }
        }
        // Server closed the stream (terminal state reached) — stop.
        return;
      } catch {
        if (closed || controller.signal.aborted) return;
        attempts += 1;
        if (attempts >= MAX_RECONNECT_ATTEMPTS) return;
        await new Promise((r) => setTimeout(r, delay()));
      }
    }
  };

  void loop();

  return {
    close: () => {
      closed = true;
      controller.abort();
    },
  };
}
