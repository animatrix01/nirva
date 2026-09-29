"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApprovalRequest } from "@/lib/artifacts";
import { cn } from "@/lib/utils";

const RISK_STYLE: Record<ApprovalRequest["risk_level"], string> = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function ApprovalCard({
  approval,
  viewerRole,
  deciding,
  onDecide,
}: {
  approval: ApprovalRequest;
  viewerRole: string;
  deciding?: boolean;
  onDecide?: (decision: "approved" | "rejected", comment: string | null) => void;
}) {
  const [comment, setComment] = useState("");
  const isSupervisor = viewerRole === "supervisor";
  const canDecide = isSupervisor && approval.status === "pending" && !!onDecide;

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        approval.status === "pending" && "border-amber-300 dark:border-amber-800"
      )}
      aria-label="Approval request"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">
          Proposed action: {approval.action}
        </span>
        <Badge variant="secondary" className={cn(RISK_STYLE[approval.risk_level])}>
          risk: {approval.risk_level}
        </Badge>
        {approval.equipment_id && (
          <Badge variant="secondary">{approval.equipment_id}</Badge>
        )}
      </div>

      <p className="mt-2 text-sm">{approval.arguments_summary}</p>

      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex gap-2">
          <dt className="w-40 shrink-0 font-medium">Requested by</dt>
          <dd className="font-mono">{approval.requested_by ?? "agent"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-40 shrink-0 font-medium">Decision by</dt>
          <dd>
            {approval.required_role ?? "supervisor"} (human approval gate — no
            bypass)
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-40 shrink-0 font-medium">Evidence refs</dt>
          <dd className="font-mono break-all">
            {approval.evidence_refs.join(", ")}
          </dd>
        </div>
      </dl>

      {approval.status === "pending" ? (
        canDecide ? (
          <div className="mt-4 flex flex-col gap-2">
            <Label htmlFor="approval-comment">Comment (optional)</Label>
            <Input
              id="approval-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Decision rationale"
              className="text-slate-800 placeholder:text-slate-400"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={deciding}
                onClick={() => onDecide?.("approved", comment.trim() || null)}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={deciding}
                onClick={() => onDecide?.("rejected", comment.trim() || null)}
              >
                Reject
              </Button>
            </div>
          </div>
        ) : (
          <p
            role="status"
            className="mt-4 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            Waiting for supervisor approval. Only a supervisor can decide this
            action — engineers cannot self-approve.
          </p>
        )
      ) : (
        <dl className="mt-4 space-y-1 rounded border p-2 text-xs">
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 font-medium">Decision</dt>
            <dd className={approval.status === "approved" ? "font-semibold text-emerald-700 dark:text-emerald-400" : "font-semibold text-red-700 dark:text-red-400"}>
              {approval.status}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 shrink-0 font-medium">Decided by</dt>
            <dd className="font-mono">{approval.decided_by}</dd>
          </div>
          {approval.decided_at && (
            <div className="flex gap-2">
              <dt className="w-40 shrink-0 font-medium">Decided at</dt>
              <dd>{new Date(approval.decided_at).toLocaleString()}</dd>
            </div>
          )}
          {approval.comment && (
            <div className="flex gap-2">
              <dt className="w-40 shrink-0 font-medium">Comment</dt>
              <dd>{approval.comment}</dd>
            </div>
          )}
          {approval.work_order_id && (
            <div className="flex gap-2">
              <dt className="w-40 shrink-0 font-medium">Work order</dt>
              <dd className="font-mono">{approval.work_order_id}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
