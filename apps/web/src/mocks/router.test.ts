import { describe, expect, it } from "vitest";
import { ApiError, handleMockRequest } from "@/mocks/router";
import { MOCK_USERS } from "@/mocks/db";

const engToken = "mock-token-engineer";
const supToken = "mock-token-supervisor";

describe("mock router: auth", () => {
  it("logs in a seeded user and returns the frozen LoginResponse shape", () => {
    const data = handleMockRequest("POST", "/api/auth/login", {
      body: { username: "engineer", password: "nirva" },
    }) as { access_token: string; token_type: string; user: { role: string } };
    expect(data.token_type).toBe("bearer");
    expect(data.user.role).toBe("engineer");
    expect(data.access_token).toBeTruthy();
  });

  it("rejects bad credentials with 401", () => {
    expect(() =>
      handleMockRequest("POST", "/api/auth/login", {
        body: { username: "engineer", password: "wrong" },
      })
    ).toThrowError(ApiError);
    try {
      handleMockRequest("POST", "/api/auth/login", {
        body: { username: "engineer", password: "wrong" },
      });
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(401);
    }
  });

  it("returns current user via /api/auth/me with bearer token", () => {
    const me = handleMockRequest("GET", "/api/auth/me", { token: engToken }) as {
      user_id: string;
      display_name: string;
    };
    expect(me.user_id).toBe(MOCK_USERS[0].user_id);
    expect(me.display_name).toBeTruthy();
  });

  it("401 without token on protected route", () => {
    expect(() => handleMockRequest("GET", "/api/auth/me", {})).toThrowError(ApiError);
  });
});

describe("mock router: jobs", () => {
  it("creates a job and returns queued summary", () => {
    const job = handleMockRequest("POST", "/api/jobs", {
      token: engToken,
      body: { objective: "Investigate pump P-204 repeated failures", equipment_id: "P-204" },
    }) as { job_id: string; status: string };
    expect(job.status).toBe("queued");
    expect(job.job_id).toMatch(/^job-/);
  });

  it("validates objective length with typed 422", () => {
    try {
      handleMockRequest("POST", "/api/jobs", {
        token: engToken,
        body: { objective: "hi", equipment_id: null },
      });
      throw new Error("should have thrown");
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(422);
      expect(apiErr.body.field).toBe("objective");
    }
  });

  it("filters list by status and hides other users' jobs from engineers", () => {
    const running = handleMockRequest("GET", "/api/jobs?status=awaiting_approval", {
      token: supToken,
    }) as Array<{ status: string }>;
    expect(running.length).toBeGreaterThan(0);
    running.forEach((j) => expect(j.status).toBe("awaiting_approval"));

    const mine = handleMockRequest("GET", "/api/jobs", { token: engToken }) as Array<{
      created_by: string;
    }>;
    mine.forEach((j) => expect(j.created_by).toBe(MOCK_USERS[0].user_id));
  });

  it("returns 404 for unknown job id", () => {
    try {
      handleMockRequest("GET", "/api/jobs/nope", { token: supToken });
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as ApiError).status).toBe(404);
    }
  });

  it("completed seeded job carries final_report", () => {
    const detail = handleMockRequest("GET", "/api/jobs/job-seed-0001", {
      token: engToken,
    }) as { final_report: { confidence: number; citations: string[] } | null };
    expect(detail.final_report).not.toBeNull();
    expect(detail.final_report!.citations.length).toBeGreaterThan(0);
  });
});
