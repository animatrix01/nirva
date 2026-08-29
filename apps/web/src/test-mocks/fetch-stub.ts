import { ApiError, handleMockRequest } from "@/test-mocks/router";

// Test-only fetch stub: routes api.ts requests through the contract doubles in
// src/test-mocks. Production code never imports this module.

export function installFetchStub(): () => void {
  const original = globalThis.fetch;
  const stubbed = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const pathWithQuery = url.replace(/^https?:\/\/[^/]+/, "");
    let body: unknown;
    if (init?.body) {
      try {
        body = JSON.parse(String(init.body));
      } catch {
        body = undefined;
      }
    }
    const headers = new Headers(init?.headers);
    const authHeader = headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer /, "") ?? null;
    try {
      const data = handleMockRequest(method, pathWithQuery, { body, token });
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: unknown) {
      const status = e instanceof ApiError ? e.status : 500;
      const errorBody =
        e instanceof ApiError ? e.body : { detail: "Internal error", field: null };
      return new Response(JSON.stringify(errorBody), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }
  }) as typeof fetch;
  globalThis.fetch = stubbed;
  return () => {
    globalThis.fetch = original;
  };
}
