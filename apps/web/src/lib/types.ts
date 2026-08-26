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
  created_by: string;
  created_at: string;
}

export interface JobListQuery {
  status?: JobStatus;
  equipment_id?: string;
  limit?: number;
}

export interface FinalReport {
  findings: string;
  confidence: number;
  assumptions: string[];
  gaps: string[];
  citations: string[];
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
