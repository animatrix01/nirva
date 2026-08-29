import type { JobArtifact, EvidenceReference } from "@/lib/artifacts";
import type { DocumentContentResponse } from "@/lib/types";

// ---------------------------------------------------------------------------
// TEST-ONLY DOUBLES — seeded artifacts + evidence + document content shaped
// exactly per the ratified contracts (DECISIONS.md 2026-08-29). Used only by
// vitest; never imported by production code.
// ---------------------------------------------------------------------------

const artifacts = new Map<string, JobArtifact>();

export function clearArtifacts(): void {
  artifacts.clear();
}

export function putArtifact(ref: string, artifact: JobArtifact): void {
  artifacts.set(ref, artifact);
}

export function getArtifact(ref: string): JobArtifact | undefined {
  return artifacts.get(ref);
}

export function findApprovalArtifact(
  approvalId: string
): { ref: string; artifact: Extract<JobArtifact, { kind: "approval" }> } | undefined {
  for (const [ref, artifact] of artifacts) {
    if (artifact.kind === "approval" && artifact.approval.approval_id === approvalId) {
      return { ref, artifact };
    }
  }
  return undefined;
}

export function listApprovalArtifacts(): Array<
  Extract<JobArtifact, { kind: "approval" }>["approval"]
> {
  const out: Array<Extract<JobArtifact, { kind: "approval" }>["approval"]> = [];
  for (const artifact of artifacts.values()) {
    if (artifact.kind === "approval") out.push(artifact.approval);
  }
  return out;
}

let workOrderSeq = 1000;

export function applyApprovalDecision(
  approvalId: string,
  decision: "approved" | "rejected",
  decidedBy: string
): {
  approval_id: string;
  status: "approved" | "rejected";
  decided_by: string;
  decided_at: string;
  work_order_id: string | null;
} {
  const found = findApprovalArtifact(approvalId);
  if (!found) throw new Error("unknown approval");
  const approval = found.artifact.approval;
  const decidedAt = new Date().toISOString();
  const workOrderId = decision === "approved" ? `wo-${workOrderSeq++}` : null;
  approval.status = decision;
  approval.decided_by = decidedBy;
  approval.decided_at = decidedAt;
  approval.work_order_id = workOrderId;
  return {
    approval_id: approvalId,
    status: decision,
    decided_by: decidedBy,
    decided_at: decidedAt,
    work_order_id: workOrderId,
  };
}

// --- Evidence chunk double (GET /api/jobs/{job_id}/evidence/{chunk_id}) -----

export const EVIDENCE_CHUNKS: Record<string, EvidenceReference> = {
  chunk_oem_p41: {
    chunk_id: "chunk_oem_p41",
    document_id: "doc-oem-pumps",
    document_title: "OEM Manual Centrifugal Pumps",
    document_type: "manual",
    revision: "rev C",
    page: 41,
    section: "4.3 Restart Procedure",
    equipment_id: "P-204",
    confidentiality_level: "internal",
    content_hash:
      "9f2c1a7e5b0d3f8a6c4e2b9d7f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a",
    passage_text:
      "Never restart the pump without verified positive suction pressure. Dry running damages the mechanical seal within seconds and is the leading cause of repeat seal failures.",
    why_retrieved:
      "Authorized chunk returned by the investigation's ACL-filtered hybrid retrieval.",
  },
  chunk_wo88712_s32: {
    chunk_id: "chunk_wo88712_s32",
    document_id: "doc-wo-88712",
    document_title: "Work Order WO-88712",
    document_type: "work_order",
    revision: "rev 2",
    page: 2,
    section: "3.2 Seal Replacement",
    equipment_id: "P-204",
    confidentiality_level: "internal",
    content_hash:
      "3a5c7e9b1d3f5a7c9e1b3d5f7a9f2c1a7e5b0d3f8a6c4e2b9d7f1a3c5e7b9d1",
    passage_text:
      "Seal kit SK-204 installed; flush line reconnected and pressure test passed at 3.2 bar before return to service.",
    why_retrieved:
      "Asset history link to P-204; work-order closure cited in objective.",
  },
};

export function getEvidenceChunk(chunkId: string): EvidenceReference | undefined {
  return EVIDENCE_CHUNKS[chunkId];
}

// --- Document content double (GET /api/documents/{id}/content) --------------

export function getDocumentContent(documentId: string): DocumentContentResponse {
  const chunks = Object.values(EVIDENCE_CHUNKS).filter(
    (c) => c.document_id === documentId
  );
  const first = chunks[0];
  return {
    document: {
      document_id: documentId,
      title: first?.document_title ?? documentId,
      document_type: first?.document_type ?? "manual",
      revision: first?.revision ?? "rev 1",
      effective_date: "2026-01-01",
      department: "Maintenance",
      equipment_id: "P-204",
      confidentiality_level: first?.confidentiality_level ?? "internal",
      content_hash: first?.content_hash ?? "0".repeat(64),
      status: "indexed",
      uploaded_at: "2026-08-01T00:00:00Z",
    },
    chunks:
      chunks.length > 0
        ? chunks.map((c) => ({
            chunk_id: c.chunk_id,
            page: c.page,
            section: c.section,
            text: c.passage_text,
          }))
        : [
            {
              chunk_id: "chunk_other_1",
              page: 1,
              section: "1.0 Overview",
              text: "General pump maintenance guidance.",
            },
          ],
  };
}

// --- Artifact seeds ---------------------------------------------------------

export function seedArtifactsForJob(jobId: string, kind: string): void {
  if (kind === "awaiting_approval") {
    putArtifact("approval_request", {
      kind: "approval",
      approval: {
        approval_id: `appr-${jobId}`,
        job_id: jobId,
        proposal_id: `prop-${jobId}`,
        action: "approve_work_order",
        arguments_summary:
          "Create work order: replace mechanical seal kit SK-204 on P-204; verify suction pressure and flush-line valve state before restart.",
        evidence_refs: ["chunk_oem_p41", "chunk_wo88712_s32"],
        risk_level: "medium",
        status: "pending",
        requested_at: new Date().toISOString(),
      },
    });
  }
  putArtifact("search_documents", {
    kind: "tool",
    tool: {
      tool_name: "search_documents",
      ok: true,
      summary:
        "Authorized hybrid retrieval over the local Qdrant index (ACL-filtered)",
    },
  });
  putArtifact("report", {
    kind: "report",
    report: {
      findings: "Seeded report findings for tests.",
      confidence: 0.8,
      assumptions: [],
      gaps: [],
      citations: [
        {
          title: "OEM Manual Centrifugal Pumps",
          revision: "rev C",
          locator: "page 41",
          chunk_id: "chunk_oem_p41",
        },
      ],
    },
  });
}
