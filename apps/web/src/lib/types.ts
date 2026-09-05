export type Role =
  | "engineer"
  | "safety_officer"
  | "supervisor"
  | "admin";

export const ROLES: Role[] = [
  "engineer",
  "safety_officer",
  "supervisor",
  "admin",
];

export type JobStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "blocked_injection";

export interface AuthUser {
  user_id: string;
  username: string;
  role: Role;
}

export interface LoginResponse {
  access_token: string;
  token_type: "bearer";
  user: AuthUser;
}

export interface CurrentUser {
  user_id: string;
  username: string;
  display_name: string;
  role: Role;
}

export interface JobSummary {
  job_id: string;
  objective_summary: string;
  status: JobStatus;
  equipment_id: string | null;
  sources: number;
  confidence: number | null;
  created_by: string;
  created_at: string;
}

export interface JobListQuery {
  status?: JobStatus;
  equipment_id?: string;
  limit?: number;
}

export interface CitationRef {
  title: string;
  revision: string;
  locator: string;
  chunk_id: string;
}

export interface FinalReport {
  findings: string;
  confidence: number;
  assumptions: string[];
  gaps: string[];
  citations: CitationRef[];
}

export interface DocumentOut {
  document_id: string;
  title: string;
  document_type: "manual" | "sop" | "work_order" | "incident" | "data";
  revision: string;
  effective_date: string;
  department: string;
  equipment_id: string | null;
  confidentiality_level: string;
  content_hash: string;
  status: "indexed" | "quarantined";
  uploaded_at: string;
}

export interface DocumentChunk {
  chunk_id: string;
  page: number | null;
  section: string | null;
  text: string;
}

export interface DocumentContentResponse {
  document: DocumentOut;
  chunks: DocumentChunk[];
}

export type DocumentType =
  | "manual"
  | "sop"
  | "work_order"
  | "incident"
  | "data";

export interface DocumentUploadResponse {
  document_id: string;
  status: "indexed" | "quarantined";
  content_hash: string;
  duplicate: boolean;
  chunks: number;
}

// ─── Evaluations (GET /api/evals, admin + safety_officer) ────────────────────

export interface EvalsSummary {
  cases_executed: number;
  recall_at_5: number;
  citation_validity: number;
  grounded_answer_rate: number;
  correct_abstention_rate: number;
  unauthorized_retrieval_count: number;
  injection_block_rate: number;
  cite_cases: number;
}

export interface EvalsGates {
  recall_at_5_min: number;
  citation_validity_min: number;
  unauthorized_max: number;
  recall_pass: boolean;
  citation_pass: boolean;
  unauthorized_pass: boolean;
}

export interface EvalsCase {
  case_id: string;
  category: string;
  role: string;
  question: string;
  // Nullable for non-retrieval cases (approval-flow, resume categories).
  recall_at_5: number | null;
  citation_validity: number | null;
  abstained: boolean;
  unauthorized: boolean;
  // Nullable for non-injection cases.
  blocked: boolean | null;
}

export interface EvalsResponse {
  dataset_version: string;
  executed_at: string;
  summary: EvalsSummary;
  gates: EvalsGates;
  cases: EvalsCase[];
}

export interface JobDetail {
  job_id: string;
  objective: string;
  status: JobStatus;
  current_node: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  final_report: FinalReport | null;
}

export const SSE_EVENT_TYPES = [
  "node_started",
  "node_finished",
  "tool_called",
  "evidence_added",
  "contradiction_found",
  "awaiting_approval",
  "completed",
  "failed",
  "blocked_injection",
] as const;

export type SseEventType = (typeof SSE_EVENT_TYPES)[number];

export interface SseEvent {
  job_id: string;
  seq: number;
  type: SseEventType;
  node: string;
  payload_ref: string | null;
  ts: string;
}

export interface TypedErrorBody {
  detail: string;
  field: string | null;
}

export interface AuditEvent {
  event_id: string;
  job_id: string;
  actor: string;
  actor_role: string;
  action: string;
  argument_summary: string;
  outcome: "ok" | "error" | "blocked";
  prev_hash: string;
  hash: string;
  ts: string;
}

export interface AuditResponse {
  chain_valid: boolean;
  events: AuditEvent[];
}

export interface HealthResponse {
  status: "ok" | "degraded";
  services: {
    postgres: "up" | "down";
    qdrant: "up" | "down";
    model_gateway: "up" | "down";
    storage: "up" | "down";
  };
  version: string;
}
