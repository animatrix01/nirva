"use client";

import { useEffect, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/role-badge";
import { HealthIndicator } from "@/components/health-indicator";
import { clearAuth } from "@/lib/api";
import { useStoredAuth } from "@/lib/auth-client";

const subscribeNever = () => () => {};

export function AppHeader({ title }: { title: string }) {
  const router = useRouter();
  const auth = useStoredAuth();
  // Hydration-safe: `mounted` is false in the server/SSR snapshot and true on
  // the client after hydration, so the login redirect only fires once
  // localStorage has actually been read — never against the null hydration
  // snapshot (which bounced Approvals/Audit/System deep-links to /login).
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    useCallback(() => false, [])
  );

  useEffect(() => {
    if (mounted && auth === null) router.replace("/login");
  }, [mounted, auth, router]);

  if (!auth) return null;

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">NIRVA</span>
          <span className="text-muted-foreground text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/documents">Documents</Link>
          </Button>
          {auth.user.role === "supervisor" || auth.user.role === "admin" ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/approvals">Approvals</Link>
            </Button>
          ) : null}
          {auth.user.role === "admin" || auth.user.role === "safety_officer" ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/audit">Audit</Link>
            </Button>
          ) : null}
          {auth.user.role === "admin" ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/system">System</Link>
            </Button>
          ) : null}
          <RoleBadge role={auth.user.role} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearAuth();
              router.push("/login");
            }}
          >
            Sign out
          </Button>
          <HealthIndicator />
        </div>
      </div>
    </header>
  );
}
