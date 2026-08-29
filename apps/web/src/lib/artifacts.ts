import type { CitationRef, FinalReport, Role } from "@/lib/types";

// Artifact payloads per the ratified contract (DECISIONS.md 2026-08-29):
// GET /api/jobs/{job_id}/artifacts/{payload_ref}, payload_ref in
// {approval_request, search_documents, report} ->
// {kind: "approval"|"tool"|"report", ...}

// GET /api/jobs/{job_id}/evidence/{chunk_id} response (ratified).
export interface EvidenceReference {
  chunk_id: string;
  document_id: string;
  document_title: string;
  document_type: "manual" | "sop" | "work_order" | "incident" | "data";
  revision: string;
  page: number | null;
  section: string | null;
  equipment_id: string | null;
  confidentiality_level: string;
  content_hash: string;
  passage_text: string;
  why_retrieved: string;
  score?: number;
}

// {kind:"tool", tool:{...}} per real artifacts router (tool_name, ok, summary).
export interface ToolActivity {
  tool_name: string;
  ok: boolean;
  summary: string;
}

// Approval shape from GET /api/approvals + approval_request artifact.
// Decision fields (§c.1 decision response) are merged client-side after
// POST /api/approvals/{id}/decision.
export interface ApprovalRequest {
  approval_id: string;
  job_id?: string;
  proposal_id: string;
  action: string;
  equipment_id?: string | null;
  arguments_summary: string;
  evidence_refs: string[];
  risk_level: "low" | "medium" | "high";
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  requested_by?: string;
  required_role?: Role;
  decided_by?: string | null;
  decided_at?: string | null;
  comment?: string | null;
  work_order_id?: string | null;
}

export type JobArtifact =
  | { kind: "approval"; approval: ApprovalRequest }
  | { kind: "tool"; tool: ToolActivity }
  | { kind: "report"; report: FinalReport }
  | { kind: "security"; event: SecurityEvent };

// GET /api/jobs/{job_id}/artifacts/security (TIER 2, 2026-08-30):
// emitted for blocked_injection events — the poisoned chunk is excluded from
// evidence and the investigation continues.
export interface SecurityEvent {
  pattern: string;
  document_title: string;
  chunk_id: string;
  action: string;
}

export type ArtifactPayloadRef =
  | "approval_request"
  | "search_documents"
  | "report"
  | "security";

export function isArtifactPayloadRef(value: string): value is ArtifactPayloadRef {
  return (
    value === "approval_request" ||
    value === "search_documents" ||
    value === "report" ||
    value === "security"
  );
}

export function isJobArtifact(value: unknown): value is JobArtifact {
  if (typeof value !== "object" || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  return (
    kind === "approval" ||
    kind === "tool" ||
    kind === "report" ||
    kind === "security"
  );
}

export type { CitationRef, FinalReport };
