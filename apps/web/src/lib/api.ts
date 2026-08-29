import type {
  AuditResponse,
  CurrentUser,
  DocumentContentResponse,
  HealthResponse,
  JobDetail,
  JobListQuery,
  JobSummary,
  LoginResponse,
} from "@/lib/types";
import type {
  ApprovalRequest,
  EvidenceReference,
  JobArtifact,
} from "@/lib/artifacts";
import { ApiError } from "@/lib/apiErrors";
import type { TypedErrorBody } from "@/lib/types";

// ---------------------------------------------------------------------------
// API CLIENT — real backend only (integration GO 2026-08-29).
// Base URL: NEXT_PUBLIC_API_BASE (default http://127.0.0.1:8000).
// Contracts: COMMON.md §c.1 as ratified in coordination/DECISIONS.md.
// ---------------------------------------------------------------------------

export { ApiError };

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export const AUTH_STORAGE_KEY = "nirva.auth";

export interface StoredAuth {
  token: string;
  user: {
    user_id: string;
    username: string;
    role: LoginResponse["user"]["role"];
  };
}

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

export function getAuthToken(): string | null {
  return loadStoredAuth()?.token ?? null;
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const auth = loadStoredAuth();
  const token = options.auth === false ? null : (auth?.token ?? null);

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
      // non-JSON error body — keep default
    }
    throw new ApiError(response.status, body.detail, body.field);
  }
  return (await response.json()) as T;
}

// --- Endpoints (frozen §c.1 + ratified) -------------------------------------

export function login(username: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("POST", "/api/auth/login", {
    body: { username, password },
    auth: false,
  });
}

export function getMe(): Promise<CurrentUser> {
  return request<CurrentUser>("GET", "/api/auth/me");
}

export function createJob(
  objective: string,
  equipmentId: string | null
): Promise<JobSummary> {
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

export function getEvidence(
  jobId: string,
  chunkId: string
): Promise<EvidenceReference> {
  return request<EvidenceReference>(
    "GET",
    `/api/jobs/${jobId}/evidence/${encodeURIComponent(chunkId)}`
  );
}

export function getDocumentContent(
  documentId: string
): Promise<DocumentContentResponse> {
  return request<DocumentContentResponse>(
    "GET",
    `/api/documents/${encodeURIComponent(documentId)}/content`
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
