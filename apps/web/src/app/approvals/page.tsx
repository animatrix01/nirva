"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useStoredAuth } from "@/lib/auth-client";
import { ApiError, decideApproval, listApprovals } from "@/lib/api";
import type { ApprovalRequest } from "@/lib/artifacts";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Mock data for UI testing
const MOCK_APPROVALS: ApprovalRequest[] = [
  {
    approval_id: "mock-1",
    proposal_id: "prop-1",
    action: "Replace mechanical seal kit with laser coupling alignment",
    equipment_id: "P-204",
    arguments_summary: "Critical wear detected on seal assembly. Laser alignment will reduce vibration by 40% and extend MTBF to 18 months. Historical failure analysis shows 3 similar incidents in Q2.",
    evidence_refs: ["chunk-001", "chunk-002", "chunk-003", "chunk-004", "chunk-005", "chunk-006", "chunk-007", "chunk-008", "chunk-009", "chunk-010", "chunk-011", "chunk-012"],
    risk_level: "high",
    status: "pending",
    requested_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    requested_by: "agent",
    required_role: "supervisor",
  },
  {
    approval_id: "mock-2",
    proposal_id: "prop-2",
    action: "Calibrate vibration sensor for Pump P-204",
    equipment_id: "P-117",
    arguments_summary: "Sensor drift detected in last 3 readings. Calibration required per SOP-2401 schedule.",
    evidence_refs: ["chunk-013", "chunk-014", "chunk-015"],
    risk_level: "medium",
    status: "pending",
    requested_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    requested_by: "agent",
    required_role: "supervisor",
  },
  {
    approval_id: "mock-3",
    proposal_id: "prop-3",
    action: "Inspect pressure relief valve assembly",
    equipment_id: "P-301",
    arguments_summary: "Routine quarterly inspection per maintenance schedule.",
    evidence_refs: ["chunk-016", "chunk-017"],
    risk_level: "low",
    status: "pending",
    requested_at: new Date(Date.now() - 21 * 60 * 1000).toISOString(),
    requested_by: "agent",
    required_role: "supervisor",
  },
  {
    approval_id: "mock-4",
    proposal_id: "prop-4",
    action: "Emergency shutdown of compressor C-102 due to temperature anomaly",
    equipment_id: "C-102",
    arguments_summary: "Temperature reading exceeded 95°C threshold. Immediate shutdown required to prevent catastrophic failure. Three temperature spikes detected in past hour.",
    evidence_refs: ["chunk-018", "chunk-019", "chunk-020", "chunk-021", "chunk-022", "chunk-023", "chunk-024", "chunk-025"],
    risk_level: "high",
    status: "pending",
    requested_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    requested_by: "agent",
    required_role: "supervisor",
  },
  {
    approval_id: "mock-5",
    proposal_id: "prop-5",
    action: "Replace bearing assembly on motor M-405",
    equipment_id: "M-405",
    arguments_summary: "Acoustic signature analysis indicates bearing degradation. Predicted failure in 72 hours. Replacement scheduled during next maintenance window.",
    evidence_refs: ["chunk-026", "chunk-027", "chunk-028", "chunk-029", "chunk-030"],
    risk_level: "medium",
    status: "pending",
    requested_at: new Date(Date.now() - 47 * 60 * 1000).toISOString(),
    requested_by: "agent",
    required_role: "supervisor",
  },
  {
    approval_id: "mock-6",
    proposal_id: "prop-6",
    action: "Lubrication service for conveyor belt CB-208",
    equipment_id: "CB-208",
    arguments_summary: "Scheduled lubrication per PM schedule. Last service completed 90 days ago.",
    evidence_refs: ["chunk-031", "chunk-032"],
    risk_level: "low",
    status: "pending",
    requested_at: new Date(Date.now() - 58 * 60 * 1000).toISOString(),
    requested_by: "agent",
    required_role: "supervisor",
  },
  {
    approval_id: "mock-7",
    proposal_id: "prop-7",
    action: "Replace hydraulic hoses on lift platform LP-12",
    equipment_id: "LP-12",
    arguments_summary: "Visual inspection revealed micro-cracks on pressure side hose. High-pressure hydraulic failure risk. Replacement parts in stock.",
    evidence_refs: ["chunk-033", "chunk-034", "chunk-035", "chunk-036", "chunk-037", "chunk-038"],
    risk_level: "high",
    status: "pending",
    requested_at: new Date(Date.now() - 73 * 60 * 1000).toISOString(),
    requested_by: "agent",
    required_role: "supervisor",
  },
  {
    approval_id: "mock-8",
    proposal_id: "prop-8",
    action: "Update PLC firmware for control panel CP-501",
    equipment_id: "CP-501",
    arguments_summary: "Security patch available for industrial control system. Current firmware version has known vulnerability CVE-2026-4521.",
    evidence_refs: ["chunk-039", "chunk-040", "chunk-041", "chunk-042"],
    risk_level: "medium",
    status: "pending",
    requested_at: new Date(Date.now() - 89 * 60 * 1000).toISOString(),
    requested_by: "agent",
    required_role: "supervisor",
  },
  {
    approval_id: "mock-9",
    proposal_id: "prop-9",
    action: "Clean air filter on HVAC unit HV-305",
    equipment_id: "HV-305",
    arguments_summary: "Airflow reduced by 15%. Filter cleaning scheduled per routine maintenance.",
    evidence_refs: ["chunk-043", "chunk-044"],
    risk_level: "low",
    status: "pending",
    requested_at: new Date(Date.now() - 105 * 60 * 1000).toISOString(),
    requested_by: "agent",
    required_role: "supervisor",
  },
  {
    approval_id: "mock-10",
    proposal_id: "prop-10",
    action: "Recalibrate pressure transmitter PT-607",
    equipment_id: "PT-607",
    arguments_summary: "Drift detected during last calibration check. Instrument reading 2.3% above reference standard. Recalibration required per ISO 9001 procedure.",
    evidence_refs: ["chunk-045", "chunk-046", "chunk-047", "chunk-048"],
    risk_level: "medium",
    status: "pending",
    requested_at: new Date(Date.now() - 127 * 60 * 1000).toISOString(),
    requested_by: "agent",
    required_role: "supervisor",
  },
  {
    approval_id: "mock-11",
    proposal_id: "prop-11",
    action: "Replace corroded piping section on coolant line CL-803",
    equipment_id: "CL-803",
    arguments_summary: "Ultrasonic thickness testing shows wall thinning below minimum spec. Corrosion rate accelerating. Pipe section replacement critical before next thermal cycle.",
    evidence_refs: ["chunk-049", "chunk-050", "chunk-051", "chunk-052", "chunk-053", "chunk-054", "chunk-055"],
    risk_level: "high",
    status: "pending",
    requested_at: new Date(Date.now() - 145 * 60 * 1000).toISOString(),
    requested_by: "agent",
    required_role: "supervisor",
  },
  {
    approval_id: "mock-12",
    proposal_id: "prop-12",
    action: "Inspect electrical cabinet EC-909 for loose connections",
    equipment_id: "EC-909",
    arguments_summary: "Thermal imaging detected hot spot on terminal block. Inspection required to identify loose connection.",
    evidence_refs: ["chunk-056", "chunk-057", "chunk-058"],
    risk_level: "medium",
    status: "pending",
    requested_at: new Date(Date.now() - 168 * 60 * 1000).toISOString(),
    requested_by: "agent",
    required_role: "supervisor",
  },
  {
    approval_id: "mock-13",
    proposal_id: "prop-13",
    action: "Replace light fixtures in Zone B warehouse",
    equipment_id: "LT-B12",
    arguments_summary: "Three fixtures non-operational. Replacement bulbs available in inventory. Standard maintenance activity.",
    evidence_refs: ["chunk-059", "chunk-060"],
    risk_level: "low",
    status: "pending",
    requested_at: new Date(Date.now() - 192 * 60 * 1000).toISOString(),
    requested_by: "agent",
    required_role: "supervisor",
  },
];

// Mock decided approvals for historical table
const MOCK_DECIDED_APPROVALS: ApprovalRequest[] = [
  {
    approval_id: "decided-1",
    proposal_id: "prop-101",
    action: "Emergency bearing replacement on P-105",
    equipment_id: "P-105",
    arguments_summary: "Critical bearing failure imminent.",
    evidence_refs: ["chunk-201"],
    risk_level: "high",
    status: "approved",
    requested_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    requested_by: "agent",
    decided_by: "sarah.chen",
    decided_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString(),
    required_role: "supervisor",
  },
  {
    approval_id: "decided-2",
    proposal_id: "prop-102",
    action: "Replace filter on tank T-301",
    equipment_id: "T-301",
    arguments_summary: "Filter clogged, routine maintenance.",
    evidence_refs: ["chunk-202"],
    risk_level: "low",
    status: "approved",
    requested_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    requested_by: "agent",
    decided_by: "michael.rodriguez",
    decided_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 8 * 60 * 1000).toISOString(),
    required_role: "supervisor",
  },
  {
    approval_id: "decided-3",
    proposal_id: "prop-103",
    action: "Shutdown reactor R-202 for inspection",
    equipment_id: "R-202",
    arguments_summary: "Pressure anomaly detected.",
    evidence_refs: ["chunk-203"],
    risk_level: "high",
    status: "rejected",
    requested_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    requested_by: "agent",
    decided_by: "sarah.chen",
    decided_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
    comment: "Anomaly within acceptable range per Process Engineer review",
    required_role: "supervisor",
  },
  {
    approval_id: "decided-4",
    proposal_id: "prop-104",
    action: "Calibrate flow meter FM-408",
    equipment_id: "FM-408",
    arguments_summary: "Annual calibration due.",
    evidence_refs: ["chunk-204"],
    risk_level: "medium",
    status: "approved",
    requested_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    requested_by: "agent",
    decided_by: "michael.rodriguez",
    decided_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 12 * 60 * 1000).toISOString(),
    required_role: "supervisor",
  },
  {
    approval_id: "decided-5",
    proposal_id: "prop-105",
    action: "Replace gasket on valve V-701",
    equipment_id: "V-701",
    arguments_summary: "Minor leak detected during rounds.",
    evidence_refs: ["chunk-205"],
    risk_level: "medium",
    status: "approved",
    requested_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    requested_by: "agent",
    decided_by: "sarah.chen",
    decided_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000).toISOString(),
    required_role: "supervisor",
  },
  {
    approval_id: "decided-6",
    proposal_id: "prop-106",
    action: "Update SCADA configuration for Zone 3",
    equipment_id: "SCADA-Z3",
    arguments_summary: "Configuration drift detected.",
    evidence_refs: ["chunk-206"],
    risk_level: "high",
    status: "rejected",
    requested_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    requested_by: "agent",
    decided_by: "michael.rodriguez",
    decided_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 1000).toISOString(),
    comment: "Requires additional security review before implementation",
    required_role: "supervisor",
  },
  {
    approval_id: "decided-7",
    proposal_id: "prop-107",
    action: "Clean heat exchanger HX-502",
    equipment_id: "HX-502",
    arguments_summary: "Efficiency dropped 8%.",
    evidence_refs: ["chunk-207"],
    risk_level: "low",
    status: "approved",
    requested_at: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
    requested_by: "agent",
    decided_by: "sarah.chen",
    decided_at: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
    required_role: "supervisor",
  },
  {
    approval_id: "decided-8",
    proposal_id: "prop-108",
    action: "Replace motor brushes on M-606",
    equipment_id: "M-606",
    arguments_summary: "Brush wear at 75% threshold.",
    evidence_refs: ["chunk-208"],
    risk_level: "medium",
    status: "approved",
    requested_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    requested_by: "agent",
    decided_by: "michael.rodriguez",
    decided_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000 + 6 * 60 * 1000).toISOString(),
    required_role: "supervisor",
  },
  {
    approval_id: "decided-9",
    proposal_id: "prop-109",
    action: "Inspect welds on pressure vessel PV-101",
    equipment_id: "PV-101",
    arguments_summary: "5-year inspection due per ASME code.",
    evidence_refs: ["chunk-209"],
    risk_level: "high",
    status: "approved",
    requested_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    requested_by: "agent",
    decided_by: "sarah.chen",
    decided_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000 + 25 * 60 * 1000).toISOString(),
    required_role: "supervisor",
  },
  {
    approval_id: "decided-10",
    proposal_id: "prop-110",
    action: "Replace sensor cable on TS-205",
    equipment_id: "TS-205",
    arguments_summary: "Intermittent signal loss.",
    evidence_refs: ["chunk-210"],
    risk_level: "low",
    status: "approved",
    requested_at: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
    requested_by: "agent",
    decided_by: "michael.rodriguez",
    decided_at: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000 + 4 * 60 * 1000).toISOString(),
    required_role: "supervisor",
  },
  {
    approval_id: "decided-11",
    proposal_id: "prop-111",
    action: "Overhaul pump impeller P-903",
    equipment_id: "P-903",
    arguments_summary: "Cavitation damage observed.",
    evidence_refs: ["chunk-211"],
    risk_level: "medium",
    status: "approved",
    requested_at: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000).toISOString(),
    requested_by: "agent",
    decided_by: "sarah.chen",
    decided_at: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000 + 18 * 60 * 1000).toISOString(),
    required_role: "supervisor",
  },
  {
    approval_id: "decided-12",
    proposal_id: "prop-112",
    action: "Test emergency shutdown system",
    equipment_id: "ESD-01",
    arguments_summary: "Quarterly functional test.",
    evidence_refs: ["chunk-212"],
    risk_level: "high",
    status: "approved",
    requested_at: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000).toISOString(),
    requested_by: "agent",
    decided_by: "michael.rodriguez",
    decided_at: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
    required_role: "supervisor",
  },
  {
    approval_id: "decided-13",
    proposal_id: "prop-113",
    action: "Lubricate gearbox on conveyor C-405",
    equipment_id: "C-405",
    arguments_summary: "Monthly PM activity.",
    evidence_refs: ["chunk-213"],
    risk_level: "low",
    status: "approved",
    requested_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    requested_by: "agent",
    decided_by: "sarah.chen",
    decided_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000 + 7 * 60 * 1000).toISOString(),
    required_role: "supervisor",
  },
  {
    approval_id: "decided-14",
    proposal_id: "prop-114",
    action: "Replace air compressor filters",
    equipment_id: "AC-201",
    arguments_summary: "Pressure drop indicates filter loading.",
    evidence_refs: ["chunk-214"],
    risk_level: "medium",
    status: "approved",
    requested_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    requested_by: "agent",
    decided_by: "michael.rodriguez",
    decided_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 + 11 * 60 * 1000).toISOString(),
    required_role: "supervisor",
  },
  {
    approval_id: "decided-15",
    proposal_id: "prop-115",
    action: "Tighten loose coupling on M-807",
    equipment_id: "M-807",
    arguments_summary: "Vibration analysis shows misalignment.",
    evidence_refs: ["chunk-215"],
    risk_level: "low",
    status: "approved",
    requested_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
    requested_by: "agent",
    decided_by: "sarah.chen",
    decided_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
    required_role: "supervisor",
  },
  {
    approval_id: "decided-16",
    proposal_id: "prop-116",
    action: "Inspect safety relief valve SRV-304",
    equipment_id: "SRV-304",
    arguments_summary: "Annual inspection per regulatory requirement.",
    evidence_refs: ["chunk-216"],
    risk_level: "high",
    status: "approved",
    requested_at: new Date(Date.now() - 34 * 24 * 60 * 60 * 1000).toISOString(),
    requested_by: "agent",
    decided_by: "michael.rodriguez",
    decided_at: new Date(Date.now() - 34 * 24 * 60 * 60 * 1000 + 22 * 60 * 1000).toISOString(),
    required_role: "supervisor",
  },
  {
    approval_id: "decided-17",
    proposal_id: "prop-117",
    action: "Replace UV lamp in disinfection unit",
    equipment_id: "UV-102",
    arguments_summary: "Lamp hours exceeded manufacturer recommendation.",
    evidence_refs: ["chunk-217"],
    risk_level: "medium",
    status: "approved",
    requested_at: new Date(Date.now() - 36 * 24 * 60 * 60 * 1000).toISOString(),
    requested_by: "agent",
    decided_by: "sarah.chen",
    decided_at: new Date(Date.now() - 36 * 24 * 60 * 60 * 1000 + 9 * 60 * 1000).toISOString(),
    required_role: "supervisor",
  },
];

function formatTimeAgo(isoString: string): string {
  const minutes = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1m ago";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1h ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1d ago" : `${days}d ago`;
}

const RISK_STYLES = {
  high:   "bg-red-100 text-red-800 border-red-300",
  medium: "bg-amber-100 text-amber-800 border-amber-300",
  low:    "bg-emerald-100 text-emerald-800 border-emerald-300",
};

const RISK_LABELS = {
  high: "HIGH RISK",
  medium: "MEDIUM RISK",
  low: "LOW RISK",
};

export default function ApprovalsPage() {
  const auth = useStoredAuth();
  const role = auth?.user.role ?? "";
  const canView = role === "supervisor" || role === "admin";

  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!canView) return;
    const signal = { cancelled: false };
    queueMicrotask(() => {
      void listApprovals()
        .then((data) => {
          if (!signal.cancelled) {
            // Combine mock data: pending + decided for UI testing
            const allMockData = [...MOCK_APPROVALS, ...MOCK_DECIDED_APPROVALS];
            setApprovals(allMockData);
            // Auto-select first pending item
            const firstPending = allMockData.find((a) => a.status === "pending");
            if (firstPending) setSelectedId(firstPending.approval_id);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (!signal.cancelled) {
            // Even on error, show mock data for UI testing
            const allMockData = [...MOCK_APPROVALS, ...MOCK_DECIDED_APPROVALS];
            setApprovals(allMockData);
            const firstPending = allMockData.find((a) => a.status === "pending");
            if (firstPending) setSelectedId(firstPending.approval_id);
            setError(null);
          }
        })
        .finally(() => {
          if (!signal.cancelled) setLoading(false);
        });
    });
    return () => {
      signal.cancelled = true;
    };
  }, [canView]);

  const handleDecision = (approvalId: string) => (
    decision: "approved" | "rejected",
    commentText: string | null
  ) => {
    setDecidingId(approvalId);
    void decideApproval(approvalId, decision, commentText)
      .then((result) => {
        setApprovals((prev) =>
          prev.map((a) =>
            a.approval_id === approvalId
              ? {
                  ...a,
                  status: result.status,
                  decided_by: result.decided_by,
                  decided_at: result.decided_at,
                  comment: commentText,
                  work_order_id: result.work_order_id,
                }
              : a
          )
        );
        setComment("");
      })
      .catch((e: unknown) =>
        setError(
          e instanceof ApiError ? e.body.detail : "Failed to record decision"
        )
      )
      .finally(() => setDecidingId(null));
  };

  const pending = approvals.filter((a) => a.status === "pending");
  const decided = approvals.filter((a) => a.status !== "pending");
  const selected = approvals.find((a) => a.approval_id === selectedId);
  const isSupervisor = role === "supervisor";

  return (
    <AppShell title="">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-100">Approvals</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Review proposed actions before they can execute.
          </p>
        </div>

        {!canView ? (
          <p role="alert" className="text-sm text-red-400">
            Approvals are restricted to supervisors and admins.
          </p>
        ) : loading ? (
          <div className="h-[600px] grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="h-full animate-pulse rounded bg-neutral-800" />
            </div>
            <div className="lg:col-span-8">
              <div className="h-full animate-pulse rounded bg-neutral-800" />
            </div>
          </div>
        ) : error ? (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No approval requests. Work orders awaiting human decision will appear here.
          </p>
        ) : (
          <>
            {/* Master-Detail Grid - Fixed Height */}
            <div className="h-[650px] grid grid-cols-1 gap-6 lg:grid-cols-12 mb-8">
              {/* Left Column: Queue */}
              <div className="lg:col-span-4 h-full overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                <div className="mb-4 sticky top-0 bg-[#f1f5f9] pb-2">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-100">
                    Pending Approvals <span className="ml-1 rounded-full bg-neutral-700 px-2 py-0.5 text-xs font-bold text-neutral-300">{pending.length}</span>
                  </h2>
                </div>
                <div className="space-y-3 pr-2">
                  {pending.map((approval) => {
                    const isActive = selectedId === approval.approval_id;
                    return (
                      <button
                        key={approval.approval_id}
                        onClick={() => setSelectedId(approval.approval_id)}
                        className={cn(
                          "w-full rounded-lg p-3 text-left transition-all",
                          isActive
                            ? "bg-neutral-900 border border-neutral-700 border-l-4 border-l-[#c8f135] shadow-sm"
                            : "border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 hover:border-neutral-700"
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "inline-block rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide truncate",
                              RISK_STYLES[approval.risk_level]
                            )}
                          >
                            {RISK_LABELS[approval.risk_level]}
                          </span>
                          <span className="font-mono text-xs text-neutral-500 flex-shrink-0">
                            {formatTimeAgo(approval.requested_at)}
                          </span>
                        </div>
                        <div className="mb-1 font-mono text-sm font-semibold text-neutral-200 truncate">
                          {approval.equipment_id || "N/A"}
                        </div>
                        <p className="text-sm text-neutral-400 truncate">
                          {approval.action}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Detail View */}
              <div className="lg:col-span-8 h-full overflow-y-auto">
                {selected ? (
                  <div className="flex flex-col gap-6 rounded-lg border border-neutral-800 bg-neutral-900 p-6 shadow-sm">
                    {/* Top Section */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h2 className="text-2xl font-semibold text-neutral-100">
                          {selected.action}
                        </h2>
                        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                          <div>
                            <span className="text-neutral-500">Asset:</span>{" "}
                            <span className="font-mono text-neutral-400">
                              {selected.equipment_id || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Requested by:</span>{" "}
                            <span className="font-mono text-neutral-400">
                              {selected.requested_by || "agent"}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Requested at:</span>{" "}
                            <span className="text-neutral-400">
                              {new Date(selected.requested_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "ml-4 inline-block rounded border px-3 py-1 text-xs font-bold uppercase tracking-wide flex-shrink-0",
                          RISK_STYLES[selected.risk_level]
                        )}
                      >
                        {RISK_LABELS[selected.risk_level]}
                      </span>
                    </div>

                    {/* Middle Section: Grid */}
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      {/* Left: Rationale */}
                      <div>
                        <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-100">
                          Why this action
                        </h3>
                        <p className="text-sm font-medium leading-relaxed text-neutral-200">
                          {selected.arguments_summary}
                        </p>
                      </div>

                      {/* Right: Evidence */}
                      <div>
                        <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-100">
                          Evidence summary
                        </h3>
                        <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-3">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-2xl font-bold text-emerald-700">
                              {selected.evidence_refs.length}
                            </span>
                            <span className="font-semibold text-emerald-800">sources</span>
                          </div>
                          <p className="mt-1 text-xs font-medium text-neutral-400">
                            Maintenance history of {selected.equipment_id || "asset"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Additional Details: AI Trace Context */}
                    <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4">
                      <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-neutral-100">
                        AI Trace Context
                      </h3>
                      <div className="space-y-2 text-xs text-neutral-300">
                        <div>
                          <span className="font-semibold text-neutral-500">Proposed action ID:</span>{" "}
                          <span className="font-mono font-semibold text-neutral-200">{selected.proposal_id}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-neutral-500">Tool used:</span>{" "}
                          <span className="font-mono font-semibold text-neutral-200">workbench.analysis.v1</span>
                        </div>
                        <div>
                          <span className="font-semibold text-neutral-500">Investigation ID:</span>{" "}
                          <span className="font-mono font-semibold text-neutral-200">{selected.job_id || "N/A"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Footer - Natural Flow */}
                    <div className="border-t border-neutral-800 pt-6">
                      {selected.status === "pending" && isSupervisor ? (
                        <>
                          <div className="mb-4">
                            <label
                              htmlFor="decision-comment"
                              className="mb-2 block text-sm font-medium text-neutral-400"
                            >
                              Decision rationale (optional)
                            </label>
                            <textarea
                              id="decision-comment"
                              value={comment}
                              onChange={(e) => setComment(e.target.value)}
                              placeholder="Enter your decision rationale..."
                              rows={3}
                              className="w-full resize-none rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-[#c8f135]"
                            />
                          </div>
                          <div className="flex justify-end gap-3">
                            <Button
                              variant="outline"
                              disabled={decidingId === selected.approval_id}
                              onClick={() =>
                                handleDecision(selected.approval_id)(
                                  "rejected",
                                  comment.trim() || null
                                )
                              }
                              className="border-2 border-red-300 text-red-700 bg-red-50 hover:bg-red-100 hover:text-red-800"
                            >
                              Reject
                            </Button>
                            <Button
                              disabled={decidingId === selected.approval_id}
                              onClick={() =>
                                handleDecision(selected.approval_id)(
                                  "approved",
                                  comment.trim() || null
                                )
                              }
                              className="bg-[#c8f135] text-black hover:bg-[#b4e125]"
                            >
                              Approve
                            </Button>
                          </div>
                        </>
                      ) : selected.status === "pending" ? (
                        <p className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                          Waiting for supervisor approval. Only a supervisor can decide this
                          action — engineers cannot self-approve.
                        </p>
                      ) : (
                        <div className="rounded-lg border border-neutral-800 bg-neutral-800 p-4">
                          <div className="space-y-2 text-sm">
                            <div className="flex gap-4">
                              <span className="w-32 font-semibold text-neutral-400">Decision:</span>
                              <span className={cn("font-bold", selected.status === "approved" ? "text-emerald-700" : "text-red-700")}>
                                {selected.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex gap-4">
                              <span className="w-32 font-semibold text-neutral-400">Decided by:</span>
                              <span className="font-mono font-semibold text-neutral-200">{selected.decided_by || "N/A"}</span>
                            </div>
                            {selected.decided_at && (
                              <div className="flex gap-4">
                                <span className="w-32 font-semibold text-neutral-400">Decided at:</span>
                                <span className="text-neutral-200">{new Date(selected.decided_at).toLocaleString()}</span>
                              </div>
                            )}
                            {selected.comment && (
                              <div className="flex gap-4">
                                <span className="w-32 font-semibold text-neutral-400">Comment:</span>
                                <span className="text-neutral-200">{selected.comment}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-md border border-neutral-800 bg-neutral-900/40">
                    <p className="text-neutral-500">Select an approval to view details</p>
                  </div>
                )}
              </div>
            </div>

            {/* Historical Decided Table */}
            {decided.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-neutral-100">
                  Decided <span className="ml-1 rounded-full bg-neutral-700 px-2 py-0.5 text-xs font-bold text-neutral-300">{decided.length}</span>
                </h2>
                <div className="overflow-x-auto rounded-lg border border-neutral-800 shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-800">
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-400">Decision</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-400">Asset</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-400">Action</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-400">Risk</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-400">Decided by</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-400">Decided at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {decided.map((approval) => (
                        <tr key={approval.approval_id} className="border-b border-neutral-800 bg-neutral-900 hover:bg-neutral-800 last:border-0">
                          <td className="px-4 py-3">
                            <span className={cn("font-bold", approval.status === "approved" ? "text-emerald-700" : "text-red-700")}>
                              {approval.status === "approved" ? "Approved" : "Rejected"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-neutral-200">
                            {approval.equipment_id || "N/A"}
                          </td>
                          <td className="px-4 py-3 font-medium text-neutral-200 max-w-md truncate">
                            {approval.action}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-block rounded border px-2 py-0.5 text-xs font-bold uppercase", RISK_STYLES[approval.risk_level])}>
                              {approval.risk_level}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-sm text-neutral-300">
                            {approval.decided_by || "N/A"}
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-300">
                            {approval.decided_at ? new Date(approval.decided_at).toLocaleString() : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
    </AppShell>
  );
}
