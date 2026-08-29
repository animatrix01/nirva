import type {
  CurrentUser,
  JobDetail,
  JobListQuery,
  JobSummary,
  LoginResponse,
  TypedErrorBody,
} from "@/lib/types";
import {
  MOCK_USERS,
  createMockJob,
  findMockJob,
  findMockUserByToken,
  issueMockToken,
  mockJobs,
  toJobDetail,
  toJobSummary,
} from "@/mocks/db";
import { getArtifact, findApprovalArtifact, listApprovalArtifacts, applyApprovalDecision } from "@/mocks/artifacts";
import { getMockAudit, getMockHealth } from "@/mocks/audit";

// ---------------------------------------------------------------------------
// MOCK ROUTER — dispatches requests exactly as the frozen §c.1 endpoints would.
// DELETE THIS ENTIRE /mocks FOLDER once status-api.md reports the real API live.
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly status: number;
  readonly body: TypedErrorBody;

  constructor(status: number, detail: string, field: string | null = null) {
    super(detail);
    this.status = status;
    this.body = { detail, field };
  }
}

type Handler = (ctx: {
  body?: unknown;
  query: URLSearchParams;
  token: string | null;
  params: string[];
}) => unknown;

function requireAuth(token: string | null): string {
  const user = token ? findMockUserByToken(token) : undefined;
  if (!user) throw new ApiError(401, "Not authenticated");
  return user.username;
}

const routes: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
  {
    method: "POST",
    pattern: /^\/api\/auth\/login$/,
    handler: ({ body }) => {
      const { username, password } = (body ?? {}) as {
        username?: unknown;
        password?: unknown;
      };
      if (typeof username !== "string" || typeof password !== "string") {
        throw new ApiError(422, "username and password are required", "username");
      }
      const user = MOCK_USERS.find((u) => u.username === username);
      if (!user || user.password !== password) {
        throw new ApiError(401, "Invalid credentials");
      }
      const response: LoginResponse = {
        access_token: issueMockToken(user),
        token_type: "bearer",
        user: { user_id: user.user_id, username: user.username, role: user.role },
      };
      return response;
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/auth\/me$/,
    handler: ({ token }) => {
      const username = requireAuth(token);
      const user = MOCK_USERS.find((u) => u.username === username)!;
      const me: CurrentUser = {
        user_id: user.user_id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
      };
      return me;
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/jobs$/,
    handler: ({ body, token }) => {
      const username = requireAuth(token);
      const user = MOCK_USERS.find((u) => u.username === username)!;
      const { objective, equipment_id } = (body ?? {}) as {
        objective?: unknown;
        equipment_id?: unknown;
      };
      if (typeof objective !== "string" || objective.trim().length < 8) {
        throw new ApiError(422, "objective must be at least 8 characters", "objective");
      }
      if (
        equipment_id !== null &&
        equipment_id !== undefined &&
        typeof equipment_id !== "string"
      ) {
        throw new ApiError(422, "equipment_id must be a string or null", "equipment_id");
      }
      return createMockJob(
        objective.trim(),
        equipment_id ?? null,
        user.user_id
      );
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/jobs$/,
    handler: ({ query, token }) => {
      const username = requireAuth(token);
      const caller = MOCK_USERS.find((u) => u.username === username)!;
      const seesAll = caller.role === "supervisor" || caller.role === "admin";
      const status = query.get("status");
      const limit = Number(query.get("limit") ?? 50);
      const filtered = mockJobs
        .filter((j) => (seesAll ? true : j.created_by === caller.user_id))
        .filter((j) => (status ? j.status === status : true))
        .slice(0, Number.isFinite(limit) ? limit : 50);
      const summaries: JobSummary[] = filtered.map(toJobSummary);
      return summaries;
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/admin\/models$/,
    handler: ({ token }) => {
      const username = requireAuth(token);
      const caller = MOCK_USERS.find((u) => u.username === username)!;
      if (caller.role !== "admin") {
        throw new ApiError(403, "Admin role required");
      }
      return [
        {
          model_name: "nirva-generator-8b",
          purpose: "generation",
          quantization: "q4_k_m",
          checksum_sha256: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
          profile: "dev",
          loaded: true,
        },
        {
          model_name: "nirva-embedder-400m",
          purpose: "embedding",
          quantization: "f16",
          checksum_sha256: "0f9e8d7c6b5a49382716059483726150f9e8d7c6b5a4938271605948372615",
          profile: "dev",
          loaded: true,
        },
        {
          model_name: "nirva-reranker-200m",
          purpose: "reranker",
          quantization: "q8_0",
          checksum_sha256: "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff",
          profile: "dev",
          loaded: false,
        },
      ];
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/audit$/,
    handler: ({ query, token }) => {
      const username = requireAuth(token);
      const caller = MOCK_USERS.find((u) => u.username === username)!;
      if (caller.role !== "admin" && caller.role !== "safety_officer") {
        throw new ApiError(403, "Admin or safety_officer role required");
      }
      const jobId = query.get("job_id");
      const limit = query.get("limit");
      return getMockAudit({
        job_id: jobId,
        limit: limit ? Number(limit) : undefined,
      });
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/health$/,
    handler: () => getMockHealth(),
  },
  {
    method: "GET",
    pattern: /^\/api\/approvals$/,
    handler: ({ token }) => {
      const username = requireAuth(token);
      const caller = MOCK_USERS.find((u) => u.username === username)!;
      if (caller.role !== "supervisor" && caller.role !== "admin") {
        throw new ApiError(403, "Supervisor or admin role required");
      }
      return listApprovalArtifacts();
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/approvals\/([^/]+)\/decision$/,
    handler: ({ params, body, token }) => {
      const username = requireAuth(token);
      const caller = MOCK_USERS.find((u) => u.username === username)!;
      if (caller.role !== "supervisor") {
        throw new ApiError(403, "Only a supervisor may decide approvals");
      }
      const approvalId = params[0];
      const { decision, comment } = (body ?? {}) as {
        decision?: unknown;
        comment?: unknown;
      };
      if (decision !== "approved" && decision !== "rejected") {
        throw new ApiError(422, 'decision must be "approved" or "rejected"', "decision");
      }
      const found = findApprovalArtifact(approvalId);
      if (!found) throw new ApiError(404, "Unknown approval id", "approval_id");
      if (found.artifact.approval.status !== "pending") {
        throw new ApiError(409, "Approval already decided (first decision wins)");
      }
      const result = applyApprovalDecision(approvalId, decision, username);
      // Decision resumes the interrupted graph thread (mock: job completes).
      const job = findMockJob(found.artifact.approval.job_id);
      if (job && job.status === "awaiting_approval") {
        job.status = "completed";
        job.current_node = null;
        job.updated_at = new Date().toISOString();
      }
      void comment;
      return result;
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/jobs\/([^/]+)\/artifacts\/([^/]+)$/,
    handler: ({ params, token }) => {
      requireAuth(token);
      const [jobId, encodedRef] = params;
      const job = findMockJob(jobId);
      if (!job) throw new ApiError(404, "Unknown job id", "job_id");
      const ref = decodeURIComponent(encodedRef);
      const artifact = getArtifact(ref);
      // Artifact refs are keyed kind:job_id:n — ensure it belongs to this job.
      if (!artifact || !ref.includes(`:${jobId}:`)) {
        throw new ApiError(404, "Unknown artifact reference", "payload_ref");
      }
      return artifact;
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/jobs\/([^/]+)$/,
    handler: ({ params, token }) => {
      const username = requireAuth(token);
      const jobId = params[0];
      const job = findMockJob(jobId);
      if (!job) throw new ApiError(404, "Unknown job id", "job_id");
      const caller = MOCK_USERS.find((u) => u.username === username)!;
      const seesAll = caller.role === "supervisor" || caller.role === "admin";
      if (!seesAll && job.created_by !== caller.user_id) {
        throw new ApiError(404, "Unknown job id", "job_id");
      }
      const detail: JobDetail = toJobDetail(job);
      return detail;
    },
  },
];

export function handleMockRequest(
  method: string,
  pathWithQuery: string,
  options: { body?: unknown; token?: string | null } = {}
): unknown {
  const [path, queryString = ""] = pathWithQuery.split("?");
  const query = new URLSearchParams(queryString);
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = path.match(route.pattern);
    if (match) {
      return route.handler({
        body: options.body,
        query,
        token: options.token ?? null,
        params: match.slice(1),
      });
    }
  }
  throw new ApiError(404, `No mock handler for ${method} ${path}`);
}

export type { JobListQuery };
