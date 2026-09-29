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
} from "@/test-mocks/db";
import {
  getArtifact,
  findApprovalArtifact,
  listApprovalArtifacts,
  applyApprovalDecision,
  getEvidenceChunk,
  getDocumentContent,
} from "@/test-mocks/artifacts";
import { getMockAudit, getMockHealth } from "@/test-mocks/audit";

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
    pattern: /^\/api\/evals$/,
    handler: ({ token }) => {
      const username = requireAuth(token);
      const caller = MOCK_USERS.find((u) => u.username === username)!;
      if (caller.role !== "admin" && caller.role !== "safety_officer") {
        throw new ApiError(403, "Admin or safety_officer role required");
      }
      return {
        dataset_version: "6ba15d6892c5",
        executed_at: "2026-09-05T10:50:44.875170+00:00",
        summary: {
          cases_executed: 105,
          recall_at_5: 1.0,
          citation_validity: 1.0,
          grounded_answer_rate: 1.0,
          correct_abstention_rate: 1.0,
          unauthorized_retrieval_count: 0,
          injection_block_rate: 1.0,
          cite_cases: 75,
        },
        gates: {
          recall_at_5_min: 0.8,
          citation_validity_min: 1.0,
          unauthorized_max: 0,
          recall_pass: true,
          citation_pass: true,
          unauthorized_pass: true,
        },
        cases: [
          {
            case_id: "factual-000",
            category: "factual",
            role: "engineer",
            question: "What is the mechanical seal replacement interval for pump P-204?",
            recall_at_5: 1.0,
            citation_validity: 1.0,
            abstained: false,
            unauthorized: false,
            blocked: null,
          },
          {
            case_id: "approval-flow-001",
            category: "approval_flow",
            role: "supervisor",
            question: "Approve the seal replacement work order draft.",
            recall_at_5: null,
            citation_validity: null,
            abstained: false,
            unauthorized: false,
            blocked: null,
          },
        ],
      };
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
      // Decision resumes the interrupted graph thread (test double: job completes).
      const job = findMockJob(found.artifact.approval.job_id ?? "");
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
    pattern: /^\/api\/documents$/,
    handler: ({ token }) => {
      const username = requireAuth(token);
      const caller = MOCK_USERS.find((u) => u.username === username)!;
      // Mirrors the demo corpus seeded by scripts/seed-p204-documents.py so the
      // fixture and the running app show the same evidence library.
      const all = [
        {
          document_id: "doc-seed-1",
          title: "Centrifugal Pump CP-300 Series — Maintenance Manual",
          document_type: "manual",
          revision: "7",
          effective_date: "2023-03-14",
          department: "Mechanical",
          equipment_id: "PUMP-204",
          confidentiality_level: "internal",
          content_hash: "a".repeat(64),
          status: "indexed",
          uploaded_at: "2026-08-01T00:00:00Z",
        },
        {
          document_id: "doc-seed-2",
          title: "SOP-217 — Mechanical Seal Replacement, Cooling Water Pumps",
          document_type: "sop",
          revision: "C",
          effective_date: "2024-08-01",
          department: "Maintenance",
          equipment_id: "PUMP-204",
          confidentiality_level: "internal",
          content_hash: "b".repeat(64),
          status: "indexed",
          uploaded_at: "2026-08-02T00:00:00Z",
        },
        {
          document_id: "doc-seed-3",
          title: "WO-8821 — PUMP-204 Mechanical Seal Replacement",
          document_type: "work_order",
          revision: "2",
          effective_date: "2026-06-18",
          department: "Maintenance",
          equipment_id: "PUMP-204",
          confidentiality_level: "internal",
          content_hash: "c".repeat(64),
          status: "indexed",
          uploaded_at: "2026-08-03T00:00:00Z",
        },
        {
          document_id: "doc-seed-4",
          title: "IR-0331 — Cooling Water Loss of Flow Near-Miss, Unit 2",
          document_type: "incident",
          revision: "Final",
          effective_date: "2026-07-30",
          department: "Reliability",
          equipment_id: "PUMP-204",
          confidentiality_level: "restricted",
          content_hash: "d".repeat(64),
          status: "indexed",
          uploaded_at: "2026-08-04T00:00:00Z",
        },
        {
          document_id: "doc-seed-5",
          title: "PUMP-204 Vibration and Seal Leakage Trend — 18 Months",
          document_type: "data",
          revision: "1",
          effective_date: "2026-08-25",
          department: "Reliability",
          equipment_id: "PUMP-204",
          confidentiality_level: "internal",
          content_hash: "e".repeat(64),
          status: "indexed",
          uploaded_at: "2026-08-05T00:00:00Z",
        },
      ];
      // ACL-filtered list: restricted sources never reach engineer callers.
      const allowed =
        caller.role === "supervisor" || caller.role === "safety_officer"
          ? all.filter((d) => d.confidentiality_level === "internal")
          : all;
      return allowed;
    },
  },
  {
    method: "POST",
    pattern: /^\/api\/documents\/upload$/,
    handler: ({ token }) => {
      const username = requireAuth(token);
      const caller = MOCK_USERS.find((u) => u.username === username)!;
      if (caller.role !== "engineer" && caller.role !== "admin") {
        throw new ApiError(
          403,
          "Document upload requires engineer or admin role"
        );
      }
      return {
        document_id: "doc-new-1",
        status: "indexed",
        content_hash: "c".repeat(64),
        duplicate: false,
        chunks: 3,
      };
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
      // Ratified refs: approval_request | search_documents | report | security
      if (
        ref !== "approval_request" &&
        ref !== "search_documents" &&
        ref !== "report" &&
        ref !== "security"
      ) {
        throw new ApiError(404, "Unknown artifact", "payload_ref");
      }
      const artifact = getArtifact(ref);
      if (!artifact) throw new ApiError(404, "Unknown artifact", "payload_ref");
      return artifact;
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/jobs\/([^/]+)\/evidence\/([^/]+)$/,
    handler: ({ params, token }) => {
      requireAuth(token);
      const [, encodedChunk] = params;
      const chunkId = decodeURIComponent(encodedChunk);
      const chunk = getEvidenceChunk(chunkId);
      if (!chunk) throw new ApiError(404, "Chunk not found", "chunk_id");
      return chunk;
    },
  },
  {
    method: "GET",
    pattern: /^\/api\/documents\/([^/]+)\/content$/,
    handler: ({ params, token }) => {
      requireAuth(token);
      return getDocumentContent(decodeURIComponent(params[0]));
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
