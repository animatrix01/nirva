"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { ApprovalCard } from "@/components/investigation/ApprovalCard";
import { useStoredAuth } from "@/lib/auth-client";
import { ApiError, decideApproval, listApprovals } from "@/lib/api";
import type { ApprovalRequest } from "@/lib/artifacts";

export default function ApprovalsPage() {
  const auth = useStoredAuth();
  const role = auth?.user.role ?? "";
  const canView = role === "supervisor" || role === "admin";

  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  useEffect(() => {
    if (!canView) return;
    const signal = { cancelled: false };
    queueMicrotask(() => {
      void listApprovals()
        .then((data) => {
          if (!signal.cancelled) {
            setApprovals(data);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (!signal.cancelled) {
            setError(
              e instanceof ApiError ? e.body.detail : "Failed to load approvals"
            );
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
    comment: string | null
  ) => {
    setDecidingId(approvalId);
    void decideApproval(approvalId, decision, comment)
      .then((result) => {
        setApprovals((prev) =>
          prev.map((a) =>
            a.approval_id === approvalId
              ? {
                  ...a,
                  status: result.status,
                  decided_by: result.decided_by,
                  decided_at: result.decided_at,
                  comment,
                  work_order_id: result.work_order_id,
                }
              : a
          )
        );
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

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="Approvals" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {!canView ? (
          <p role="alert" className="text-destructive text-sm">
            Approvals are restricted to supervisors and admins.
          </p>
        ) : loading ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded bg-muted/50" />
            ))}
          </div>
        ) : error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : approvals.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No approval requests. Work orders awaiting human decision will
            appear here.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">
                Pending ({pending.length})
              </h2>
              {pending.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nothing pending.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {pending.map((a) => (
                    <ApprovalCard
                      key={a.approval_id}
                      approval={a}
                      viewerRole={role}
                      deciding={decidingId === a.approval_id}
                      onDecide={handleDecision(a.approval_id)}
                    />
                  ))}
                </div>
              )}
            </section>
            {decided.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">
                  Decided ({decided.length})
                </h2>
                <div className="flex flex-col gap-3">
                  {decided.map((a) => (
                    <ApprovalCard key={a.approval_id} approval={a} viewerRole={role} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
