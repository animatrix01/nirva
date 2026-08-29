"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/role-badge";
import { HealthIndicator } from "@/components/health-indicator";
import { clearAuth } from "@/lib/api";
import { useStoredAuth } from "@/lib/auth-client";

export function AppHeader({ title }: { title: string }) {
  const router = useRouter();
  const auth = useStoredAuth();

  const authenticated = auth !== null;
  useEffect(() => {
    if (!authenticated) router.replace("/login");
  }, [authenticated, router]);

  if (!auth) return null;

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">NIRVA</span>
          <span className="text-muted-foreground text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <HealthIndicator />
          {auth.user.role === "supervisor" || auth.user.role === "admin" ? (
            <Button variant="ghost" size="sm" asChild>
              <a href="/approvals">Approvals</a>
            </Button>
          ) : null}
          {auth.user.role === "admin" || auth.user.role === "safety_officer" ? (
            <Button variant="ghost" size="sm" asChild>
              <a href="/audit">Audit</a>
            </Button>
          ) : null}
          {auth.user.role === "admin" ? (
            <Button variant="ghost" size="sm" asChild>
              <a href="/admin/system">System</a>
            </Button>
          ) : null}
          <span className="text-sm font-medium">{auth.user.username}</span>
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
        </div>
      </div>
    </header>
  );
}
