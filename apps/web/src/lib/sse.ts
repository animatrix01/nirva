"use client";

import type { SseEvent } from "@/lib/types";

// ---------------------------------------------------------------------------
// Job SSE stream with reconnect-and-resync-from-job-state.
// Live mode uses native EventSource on GET /api/jobs/{id}/events; the browser
// automatically sends Last-Event-ID on reconnect, and the server replays from
// that seq (COMMON.md §c.1). Mock mode delegates to src/mocks/sse.ts.
// ---------------------------------------------------------------------------

const MOCK_STREAM =
  process.env.NEXT_PUBLIC_MOCK !== "0" &&
  process.env.NODE_ENV !== "production";

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
  let timer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closed) return;
    handlers.onStateChange?.(attempts === 0 ? "connecting" : "reconnecting");

    if (MOCK_STREAM) {
      // Dynamic import keeps mocks out of the production bundle path.
      void import("@/mocks/sse").then(({ openMockJobStream }) =>
        openMockJobStream(
          jobId,
          lastSeq + 1,
          (event) => {
            lastSeq = event.seq;
            attempts = 0;
            handlers.onEvent(event);
          },
          () => scheduleReconnect()
        )
      );
      return;
    }

    const source = new EventSource(`/api/jobs/${jobId}/events`);
    source.onopen = () => {
      attempts = 0;
      handlers.onStateChange?.("open");
    };
    source.onmessage = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as SseEvent;
        lastSeq = event.seq;
        handlers.onEvent(event);
      } catch {
        // Malformed frame: ignore, contract guarantees typed JSON.
      }
    };
    source.onerror = () => {
      source.close();
      scheduleReconnect();
    };
  };

  const scheduleReconnect = () => {
    if (closed) return;
    if (attempts >= MAX_RECONNECT_ATTEMPTS) return;
    attempts += 1;
    const delay = RECONNECT_BASE_DELAY_MS * 2 ** (attempts - 1);
    timer = setTimeout(connect, delay);
  };

  connect();

  return {
    close: () => {
      closed = true;
      if (timer !== null) clearTimeout(timer);
    },
  };
}
