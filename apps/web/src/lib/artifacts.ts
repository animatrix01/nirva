import type { FinalReport, JobStatus, Role } from "@/lib/types";

// Artifact payload shapes per docs/demo-ready-plan.md Appendix
// ("SSE event to component mapping"). payload_ref is the opaque key from the
// frozen §c.2 SSE envelope; heavier content is fetched from
// GET /api/jobs/{job_id}/artifacts/{payload_ref} (artifact endpoint pending on
// Terminal A; mocked until live).

export interface EvidenceReference {
  chunk_id: string;
  document_id: string;
  document_title: string;
  document_type: "manual" | "sop" | "work_order" | "incident" | "data";
  revision: string;
  page: number | null;
  section: string | null;
  confidentiality_level: string;
  content_hash: string;
  passage_text: string;
  why_retrieved: string;
}

export interface ToolActivity {
  tool_name: string;
  arguments_summary: string;
  status: "running" | "completed" | "error" | "denied";
  output_summary: string | null;
  error: string | null;
}

export interface ContradictionSide {
  citation: string;
  passage_text: string;
}

export interface Contradiction {
  topic: string;
  source_a: ContradictionSide;
  source_b: ContradictionSide;
  note: string;
}

export interface ApprovalRequest {
  approval_id: string;
  job_id: string;
  proposal_id: string;
  action: string;
  equipment_id: string | null;
  arguments_summary: string;
  evidence_refs: string[];
  risk_level: "low" | "medium" | "high";
  requested_by: string;
  required_role: Role;
  status: "pending" | "approved" | "rejected";
  decided_by: string | null;
  decided_at: string | null;
  comment: string | null;
  work_order_id: string | null;
}

export interface SecurityEvent {
  event_type: "blocked_injection";
  description: string;
  source_citation: string | null;
}

export type JobArtifact =
  | { kind: "evidence"; evidence: EvidenceReference[] }
  | { kind: "tool"; tool: ToolActivity }
  | { kind: "contradiction"; contradiction: Contradiction }
  | { kind: "approval"; approval: ApprovalRequest }
  | { kind: "report"; report: FinalReport }
  | { kind: "security"; event: SecurityEvent };

export function isJobArtifact(value: unknown): value is JobArtifact {
  if (typeof value !== "object" || value === null) return false;
  const kind = (value as { kind?: unknown }).kind;
  return (
    kind === "evidence" ||
    kind === "tool" ||
    kind === "contradiction" ||
    kind === "approval" ||
    kind === "report" ||
    kind === "security"
  );
}

// Job statuses for reference by UI layers that map artifacts to states.
export type ArtifactJobStatus = JobStatus;
