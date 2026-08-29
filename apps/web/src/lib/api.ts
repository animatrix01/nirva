import type {
  CurrentUser,
  JobDetail,
  JobListQuery,
  JobStatus,
  JobSummary,
  LoginResponse,
  TypedErrorBody,
} from "@/lib/types";
import type { JobArtifact } from "@/lib/artifacts";
import type { ApprovalRequest } from "@/lib/artifacts";
import type { AuditResponse, HealthResponse } from "@/lib/types";
import { ApiError } from "@/mocks/router";
import { handleMockRequest } from "@/mocks/router";

// ---------------------------------------------------------------------------
// API CLIENT — speaks the frozen contracts from COMMON.md §c.1.
// While NEXT_PUBLIC_MOCK !== "0", requests are served by src/mocks (API lane
// not live yet). Flip to "0" to hit the real backend at NEXT_PUBLIC_API_BASE.
// ---------------------------------------------------------------------------

export { ApiError };

const MOCK_ENABLED =
  process.env.NEXT_PUBLIC_MOCK !== "0" &&
  process.env.NODE_ENV !== "production";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE ?? "";

export const AUTH_STORAGE_KEY = "nirva.auth";

export interface StoredAuth {
  token: string;
  user: {
    user_id: string;
    username: string;
    role: JobRoleString;
  };
}

type JobRoleString = LoginResponse["user"]["role"];

export function loadStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function storeAuth(auth: StoredAuth): void {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export function clearAuth(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const auth = loadStoredAuth();
  const token = options.auth === false ? null : (auth?.token ?? null);

  let data: unknown;
  if (MOCK_ENABLED) {
    data = handleMockRequest(method, path, { body: options.body, token });
  } else {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
      let body: TypedErrorBody = { detail: response.statusText, field: null };
      try {
        body = (await response.json()) as TypedErrorBody;
      } catch {
        // keep default body
      }
      throw new ApiError(response.status, body.detail, body.field);
    }
    data = await response.json();
  }
  return data as T;
}

// --- Endpoints (frozen §c.1) ------------------------------------------------

export function login(username: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("POST", "/api/auth/login", {
    body: { username, password },
    auth: false,
  });
}

export function getMe(): Promise<CurrentUser> {
  return request<CurrentUser>("GET", "/api/auth/me");
}

export function createJob(objective: string, equipmentId: string | null): Promise<JobSummary> {
  return request<JobSummary>("POST", "/api/jobs", {
    body: { objective, equipment_id: equipmentId },
  });
}

export function listJobs(query: JobListQuery = {}): Promise<JobSummary[]> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.equipment_id) params.set("equipment_id", query.equipment_id);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  const qs = params.toString();
  return request<JobSummary[]>("GET", `/api/jobs${qs ? `?${qs}` : ""}`);
}

export function getJob(jobId: string): Promise<JobDetail> {
  return request<JobDetail>("GET", `/api/jobs/${jobId}`);
}

export function getArtifact(
  jobId: string,
  payloadRef: string
): Promise<JobArtifact> {
  return request<JobArtifact>(
    "GET",
    `/api/jobs/${jobId}/artifacts/${encodeURIComponent(payloadRef)}`
  );
}

export function listApprovals(): Promise<ApprovalRequest[]> {
  return request<ApprovalRequest[]>("GET", "/api/approvals");
}

export function decideApproval(
  approvalId: string,
  decision: "approved" | "rejected",
  comment: string | null
): Promise<{
  approval_id: string;
  status: "approved" | "rejected";
  decided_by: string;
  decided_at: string;
  work_order_id: string | null;
}> {
  return request("POST", `/api/approvals/${approvalId}/decision`, {
    body: { decision, comment },
  });
}

export function getAudit(
  query: { job_id?: string; limit?: number } = {}
): Promise<AuditResponse> {
  const params = new URLSearchParams();
  if (query.job_id) params.set("job_id", query.job_id);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  const qs = params.toString();
  return request("GET", `/api/audit${qs ? `?${qs}` : ""}`);
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("GET", "/api/health", { auth: false });
}

export function getAdminModels(): Promise<
  Array<{
    model_name: string;
    purpose: string;
    quantization: string;
    checksum_sha256: string;
    profile: string;
    loaded: boolean;
  }>
> {
  return request("GET", "/api/admin/models");
}

export type { JobStatus };
