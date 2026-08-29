import type {
  JobDetail,
  JobStatus,
  JobSummary,
  Role,
  SseEvent,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// MOCK DATA STORE — implements the frozen contracts in COMMON.md §c.1/§c.2.
// DELETE THIS ENTIRE /mocks FOLDER once status-api.md reports the real API live.
// ---------------------------------------------------------------------------

import { attachPayloadRefs, seedArtifactsForJob } from "@/mocks/artifacts";

export interface MockUserRecord {
  user_id: string;
  username: string;
  display_name: string;
  role: Role;
  password: string;
}

export const MOCK_USERS: MockUserRecord[] = [
  { user_id: "u-eng-0001", username: "engineer", display_name: "Asha Rao", role: "engineer", password: "nirva" },
  { user_id: "u-saf-0002", username: "safety", display_name: "Vikram Shetty", role: "safety_officer", password: "nirva" },
  { user_id: "u-sup-0003", username: "supervisor", display_name: "Meera Iyer", role: "supervisor", password: "nirva" },
  { user_id: "u-adm-0004", username: "admin", display_name: "System Admin", role: "admin", password: "nirva" },
];

let seqCounter = 1000;

function isoNow(offsetMinutes = 0): string {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

export interface MockJobRecord {
  job_id: string;
  objective: string;
  equipment_id: string | null;
  status: JobStatus;
  current_node: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const seededJobs: MockJobRecord[] = [
  {
    job_id: "job-seed-0001",
    objective:
      "Investigate why Pump P-204 has failed repeatedly. Compare its maintenance history with the OEM manual and safety SOP.",
    equipment_id: "P-204",
    status: "completed",
    current_node: null,
    created_by: "u-eng-0001",
    created_at: isoNow(-240),
    updated_at: isoNow(-230),
  },
  {
    job_id: "job-seed-0002",
    objective:
      "Check whether heat exchanger E-110 fouling correlates with the latest work orders and sensor readings.",
    equipment_id: "E-110",
    status: "awaiting_approval",
    current_node: "approval_executor",
    created_by: "u-sup-0003",
    created_at: isoNow(-90),
    updated_at: isoNow(-60),
  },
];

export const mockJobs: MockJobRecord[] = seededJobs;

export function createMockJob(
  objective: string,
  equipment_id: string | null,
  userId: string
): JobSummary {
  const job: MockJobRecord = {
    job_id: `job-${(seqCounter++).toString().padStart(4, "0")}`,
    objective,
    equipment_id,
    status: "queued",
    current_node: null,
    created_by: userId,
    created_at: isoNow(),
    updated_at: isoNow(),
  };
  mockJobs.unshift(job);
  return toJobSummary(job);
}

export function toJobSummary(job: MockJobRecord): JobSummary {
  return {
    job_id: job.job_id,
    objective_summary: job.objective.slice(0, 120),
    status: job.status,
    created_by: job.created_by,
    created_at: job.created_at,
  };
}

export function toJobDetail(job: MockJobRecord): JobDetail {
  return {
    job_id: job.job_id,
    objective: job.objective,
    status: job.status,
    current_node: job.current_node,
    created_by: job.created_by,
    created_at: job.created_at,
    updated_at: job.updated_at,
    final_report:
      job.status === "completed"
        ? {
            findings:
              "Pump P-204 failures trace to repeated dry-running after seal replacement; OEM manual forbids restart without verified suction pressure [OEM Manual Centrifugal Pumps, rev C, page 41, chunk_oem_p41].",
            confidence: 0.82,
            assumptions: [
              "Assumption: seal flush line was restored as per the last work order notes.",
            ],
            gaps: ["No vibration sensor data available for the 48h before the second failure."],
            citations: [
              "[OEM Manual Centrifugal Pumps, rev C, page 41, chunk_oem_p41]",
              "[Work Order WO-88712, rev 2, section 3.2, chunk_wo88712_s32]",
            ],
          }
        : null,
  };
}

// --- SSE scenario scripting -------------------------------------------------

type ScenarioKind = "completed" | "failed" | "blocked_injection" | "awaiting_approval";

export function scenarioKindForObjective(objective: string): ScenarioKind {
  const o = objective.toLowerCase();
  if (o.includes("inject") || o.includes("ignore instructions")) return "blocked_injection";
  if (o.includes("missing") || o.includes("insufficient")) return "failed";
  if (o.includes("work order") || o.includes("approve")) return "awaiting_approval";
  return "completed";
}

interface ScriptStep {
  type: SseEvent["type"];
  node: string;
  delayMs: number;
}

const NODE_SCRIPTS: Record<ScenarioKind, ScriptStep[]> = {
  completed: [
    { type: "node_started", node: "intake", delayMs: 200 },
    { type: "node_finished", node: "intake", delayMs: 300 },
    { type: "node_started", node: "answer", delayMs: 200 },
    { type: "evidence_added", node: "answer", delayMs: 400 },
    { type: "evidence_added", node: "answer", delayMs: 400 },
    { type: "tool_called", node: "answer", delayMs: 400 },
    { type: "node_finished", node: "answer", delayMs: 300 },
    { type: "node_started", node: "finalize", delayMs: 200 },
    { type: "node_finished", node: "finalize", delayMs: 300 },
    { type: "completed", node: "finalize", delayMs: 200 },
  ],
  awaiting_approval: [
    { type: "node_started", node: "intake", delayMs: 200 },
    { type: "node_finished", node: "intake", delayMs: 300 },
    { type: "node_started", node: "answer", delayMs: 200 },
    { type: "evidence_added", node: "answer", delayMs: 400 },
    { type: "node_finished", node: "answer", delayMs: 300 },
    { type: "awaiting_approval", node: "approval_executor", delayMs: 300 },
  ],
  failed: [
    { type: "node_started", node: "intake", delayMs: 200 },
    { type: "node_finished", node: "intake", delayMs: 300 },
    { type: "node_started", node: "answer", delayMs: 200 },
    { type: "contradiction_found", node: "answer", delayMs: 400 },
    { type: "failed", node: "answer", delayMs: 300 },
  ],
  blocked_injection: [
    { type: "node_started", node: "intake", delayMs: 200 },
    { type: "blocked_injection", node: "intake", delayMs: 400 },
  ],
};

export function buildScript(
  jobId: string,
  kind: ScenarioKind
): Array<SseEvent & { delayMs: number }> {
  const script = NODE_SCRIPTS[kind];
  let seq = 0;
  const steps = script.map((step) => ({
    job_id: jobId,
    seq: seq++,
    type: step.type,
    node: step.node,
    payload_ref: null,
    ts: new Date().toISOString(),
    delayMs: step.delayMs,
  }));
  const evidenceSeqs = steps
    .filter((s) => s.type === "evidence_added")
    .map((s) => s.seq);
  seedArtifactsForJob(jobId, kind, evidenceSeqs);
  attachPayloadRefs(steps, jobId);
  return steps;
}

export function findMockJob(jobId: string): MockJobRecord | undefined {
  return mockJobs.find((j) => j.job_id === jobId);
}

export function findMockUserByToken(token: string): MockUserRecord | undefined {
  const encoded = token.replace(/^mock-token-/, "");
  return MOCK_USERS.find((u) => u.username === encoded);
}

export function issueMockToken(user: MockUserRecord): string {
  return `mock-token-${user.username}`;
}
