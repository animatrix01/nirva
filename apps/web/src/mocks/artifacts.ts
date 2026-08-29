import type { JobArtifact } from "@/lib/artifacts";
import type { SseEvent } from "@/lib/types";

// ---------------------------------------------------------------------------
// MOCK ARTIFACT STORE — heavier payloads behind payload_ref keys, served by
// GET /api/jobs/{job_id}/artifacts/{payload_ref} in the mock router.
// DELETE THIS ENTIRE /mocks FOLDER once the real artifacts endpoint is live.
// ---------------------------------------------------------------------------

const artifacts = new Map<string, JobArtifact>();

export function putArtifact(ref: string, artifact: JobArtifact): void {
  artifacts.set(ref, artifact);
}

export function getArtifact(ref: string): JobArtifact | undefined {
  return artifacts.get(ref);
}

function seedEvidenceArtifacts(jobId: string, evidenceSeqs: number[]): void {
  const [seq0, seq1] = evidenceSeqs;
  putArtifact(`ev:${jobId}:${seq0}`, {
    kind: "evidence",
    evidence: [
      {
        chunk_id: "chunk_oem_p41",
        document_id: "doc-oem-pumps",
        document_title: "OEM Manual Centrifugal Pumps",
        document_type: "manual",
        revision: "rev C",
        page: 41,
        section: "4.3 Restart Procedure",
        confidentiality_level: "internal",
        content_hash:
          "9f2c1a7e5b0d3f8a6c4e2b9d7f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a",
        passage_text:
          "Never restart the pump without verified positive suction pressure. Dry running damages the mechanical seal within seconds and is the leading cause of repeat seal failures.",
        why_retrieved:
          "Matched objective terms: repeat failure, seal, restart; equipment_id filter P-204; current revision only.",
      },
    ],
  });
  putArtifact(`ev:${jobId}:${seq1}`, {
    kind: "evidence",
    evidence: [
      {
        chunk_id: "chunk_wo88712_s32",
        document_id: "doc-wo-88712",
        document_title: "Work Order WO-88712",
        document_type: "work_order",
        revision: "rev 2",
        page: 2,
        section: "3.2 Seal Replacement",
        confidentiality_level: "internal",
        content_hash:
          "3a5c7e9b1d3f5a7c9e1b3d5f7a9f2c1a7e5b0d3f8a6c4e2b9d7f1a3c5e7b9d1",
        passage_text:
          "Seal kit SK-204 installed; flush line reconnected and pressure test passed at 3.2 bar before return to service.",
        why_retrieved:
          "Asset history link to P-204; work-order closure cited in objective; superseded rev 1 filtered out.",
      },
    ],
  });
}

function seedToolArtifact(jobId: string): void {
  putArtifact(`tool:${jobId}:0`, {
    kind: "tool",
    tool: {
      tool_name: "get_asset_history",
      arguments_summary: '{ "equipment_id": "P-204", "window": "180d" }',
      status: "completed",
      output_summary:
        "3 failure events in 180d, all seal-related; last work order WO-88712 closed on time.",
      error: null,
    },
  });
}

function seedContradictionArtifact(jobId: string): void {
  putArtifact(`contr:${jobId}:0`, {
    kind: "contradiction",
    contradiction: {
      topic: "Seal flush line state at restart",
      source_a: {
        citation:
          "[Work Order WO-88712, rev 2, section 3.2, chunk_wo88712_s32]",
        passage_text:
          "Flush line reconnected and pressure test passed at 3.2 bar before return to service.",
      },
      source_b: {
        citation:
          "[Incident Report IR-0044, rev 1, page 3, chunk_ir0044_p3]",
        passage_text:
          "On return to service the seal flush line was found isolated; valve PSV-11 was still closed.",
      },
      note: "Work-order closure contradicts the incident report on flush-line state. Verification required before recommending restart.",
    },
  });
}

function seedApprovalArtifact(jobId: string): void {
  putArtifact(`appr:${jobId}:0`, {
    kind: "approval",
    approval: {
      approval_id: `appr-${jobId}`,
      job_id: jobId,
      proposal_id: `prop-${jobId}`,
      action: "approve_work_order",
      equipment_id: "P-204",
      arguments_summary:
        "Create work order: replace mechanical seal kit SK-204 on P-204; verify suction pressure and flush-line valve state before restart.",
      evidence_refs: ["chunk_oem_p41", "chunk_wo88712_s32"],
      risk_level: "medium",
      requested_by: "agent:answer",
      required_role: "supervisor",
      status: "pending",
      decided_by: null,
      decided_at: null,
      comment: null,
      work_order_id: null,
    },
  });
}

export function seedArtifactsForJob(
  jobId: string,
  kind: string,
  evidenceSeqs: number[]
): void {
  if (kind === "failed") seedContradictionArtifact(jobId);
  if (kind === "awaiting_approval") {
    seedEvidenceArtifacts(jobId, evidenceSeqs);
    seedApprovalArtifact(jobId);
  } else {
    seedEvidenceArtifacts(jobId, evidenceSeqs);
    seedToolArtifact(jobId);
  }
}

export function attachPayloadRefs(
  steps: Array<SseEvent & { delayMs: number }>,
  jobId: string
): void {
  for (const step of steps) {
    if (step.type === "evidence_added") {
      const n = step.seq;
      step.payload_ref = `ev:${jobId}:${n}`;
    } else if (step.type === "tool_called") {
      step.payload_ref = `tool:${jobId}:0`;
    } else if (step.type === "contradiction_found") {
      step.payload_ref = `contr:${jobId}:0`;
    } else if (step.type === "awaiting_approval") {
      step.payload_ref = `appr:${jobId}:0`;
    }
  }
}
