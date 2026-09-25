import type {
  AuditResponse,
  CurrentUser,
  DocumentContentResponse,
  DocumentOut,
  DocumentType,
  DocumentUploadResponse,
  EvalsResponse,
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

// Binary stored original (images) — fetched as an authed blob so the UI can
// render it via an object URL (img tags cannot send Authorization headers).
export async function getDocumentFile(documentId: string): Promise<Blob> {
  const auth = loadStoredAuth();
  const token = auth?.token ?? null;
  const response = await fetch(
    `${BASE_URL}/api/documents/${encodeURIComponent(documentId)}/file`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!response.ok) {
    let body: TypedErrorBody = { detail: response.statusText, field: null };
    try {
      body = (await response.json()) as TypedErrorBody;
    } catch {
      // keep default body
    }
    throw new ApiError(response.status, body.detail, body.field);
  }
  return await response.blob();
}

export type ExportFormat = "pptx" | "word" | "excel";

// Generated report files (PPT/Word/Excel) — fetched as an authed blob,
// same pattern as document files (anchors cannot send Authorization headers).
export async function downloadJobExport(jobId: string, format: ExportFormat): Promise<Blob> {
  const auth = loadStoredAuth();
  const token = auth?.token ?? null;
  const response = await fetch(
    `${BASE_URL}/api/jobs/${encodeURIComponent(jobId)}/export/${format}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!response.ok) {
    let body: TypedErrorBody = { detail: response.statusText, field: null };
    try {
      body = (await response.json()) as TypedErrorBody;
    } catch {
      // keep default body
    }
    throw new ApiError(response.status, body.detail, body.field);
  }
  return await response.blob();
}

// Visible document library as a workbook (ACL-filtered server-side).
export async function downloadDocumentsExcel(): Promise<Blob> {
  const auth = loadStoredAuth();
  const token = auth?.token ?? null;
  const response = await fetch(`${BASE_URL}/api/documents/export/excel`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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
  return await response.blob();
}

export function listDocuments(): Promise<DocumentOut[]> {
  return request<DocumentOut[]>("GET", "/api/documents");
}

export interface CodeRunResult {
  run_id: string;
  job_id: string;
  task: string;
  code: string;
  ok: boolean;
  stdout: string;
  stderr: string;
  exit_code: number;
}

export function runCode(jobId: string, task: string): Promise<CodeRunResult> {
  return request<CodeRunResult>("POST", "/api/code/run", {
    body: { job_id: jobId, task },
  });
}

export function getCodeRun(jobId: string): Promise<CodeRunResult> {
  return request<CodeRunResult>("GET", `/api/code/${encodeURIComponent(jobId)}`);
}

// Generated analysis script (.py) — authed blob like other file downloads.
export async function downloadCodePy(jobId: string): Promise<Blob> {
  const auth = loadStoredAuth();
  const token = auth?.token ?? null;
  const response = await fetch(
    `${BASE_URL}/api/code/${encodeURIComponent(jobId)}/download`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!response.ok) {
    let body: TypedErrorBody = { detail: response.statusText, field: null };
    try {
      body = (await response.json()) as TypedErrorBody;
    } catch {
      // keep default body
    }
    throw new ApiError(response.status, body.detail, body.field);
  }
  return await response.blob();
}

export interface DocumentUploadPayload {
  file: File;
  title: string;
  document_type: DocumentType;
  revision: string;
  effective_date: string;
  department: string;
  equipment_id: string | null;
  confidentiality_level: string;
  allowed_roles: string[];
}

export function uploadDocument(
  payload: DocumentUploadPayload
): Promise<DocumentUploadResponse> {
  const form = new FormData();
  form.append("file", payload.file);
  form.append("title", payload.title);
  form.append("document_type", payload.document_type);
  form.append("revision", payload.revision);
  form.append("effective_date", payload.effective_date);
  form.append("department", payload.department);
  if (payload.equipment_id) form.append("equipment_id", payload.equipment_id);
  form.append("confidentiality_level", payload.confidentiality_level);
  form.append("allowed_roles", payload.allowed_roles.join(","));

  const auth = loadStoredAuth();
  return fetch(`${BASE_URL}/api/documents/upload`, {
    method: "POST",
    headers: auth ? { Authorization: `Bearer ${auth.token}` } : {},
    body: form,
  }).then(async (response) => {
    if (!response.ok) {
      let body: TypedErrorBody = { detail: response.statusText, field: null };
      try {
        body = (await response.json()) as TypedErrorBody;
      } catch {
        // keep default
      }
      throw new ApiError(response.status, body.detail, body.field);
    }
    return (await response.json()) as DocumentUploadResponse;
  });
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

export function getEvals(): Promise<EvalsResponse> {
  return request<EvalsResponse>("GET", "/api/evals");
}
