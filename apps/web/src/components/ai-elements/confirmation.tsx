"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Hand-rolled Confirmation primitive (AI Elements CLI could not be used for
// this name due to a terminal command deny-rule; equivalent API per
// docs/demo-ready-plan.md Appendix). Purely presentational — decision state
// and handlers come from the composition layer.

function Confirmation({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="confirmation"
      className={cn("rounded-lg border p-4 text-sm", className)}
      {...props}
    />
  );
}

function ConfirmationTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="confirmation-title"
      className={cn("font-semibold", className)}
      {...props}
    />
  );
}

function ConfirmationDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="confirmation-description"
      className={cn("text-muted-foreground mt-1 text-xs", className)}
      {...props}
    />
  );
}

function ConfirmationActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="confirmation-actions"
      className={cn("mt-3 flex gap-2", className)}
      {...props}
    />
  );
}

interface ConfirmationDecisionProps {
  decision: "approved" | "rejected";
  actor?: string | null;
  comment?: string | null;
  timestamp?: string | null;
  children?: React.ReactNode;
}

function ConfirmationDecision({ decision, actor, comment, timestamp, children }: ConfirmationDecisionProps) {
  return (
    <div
      data-slot="confirmation-decision"
      className="mt-3 rounded border p-2 text-xs"
    >
      <p className={cn(
        "font-semibold",
        decision === "approved"
          ? "text-emerald-700 dark:text-emerald-400"
          : "text-red-700 dark:text-red-400"
      )}>
        {decision}
      </p>
      {actor && <p className="font-mono">{actor}</p>}
      {timestamp && <p>{new Date(timestamp).toLocaleString()}</p>}
      {comment && <p>{comment}</p>}
      {children}
    </div>
  );
}

function ConfirmationApprove({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="confirmation-approve"
      size="sm"
      className={className}
      {...props}
    />
  );
}

function ConfirmationReject({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="confirmation-reject"
      size="sm"
      variant="destructive"
      className={className}
      {...props}
    />
  );
}

export {
  Confirmation,
  ConfirmationTitle,
  ConfirmationDescription,
  ConfirmationActions,
  ConfirmationDecision,
  ConfirmationApprove,
  ConfirmationReject,
};
