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
    <header className="relative border-b bg-background">
      <div className="flex h-16 w-full items-center px-6">

        {/* Left — NIRVA logo + name */}
        <Link href="/workbench" className="flex items-center gap-2.5 shrink-0">
          <img
            src="/nirva_logo_-removebg-preview.png"
            alt="NIRVA"
            className="size-8 object-contain"
          />
          <span className="text-base font-bold tracking-tight text-white">NIRVA</span>
        </Link>

        {/* Center — Nav links (absolutely centered) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/investigations">Investigations</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/documents">Documents</Link>
          </Button>
          {(auth.user.role === "supervisor" || auth.user.role === "admin") && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/approvals">Approvals</Link>
            </Button>
          )}
          {(auth.user.role === "admin" || auth.user.role === "safety_officer") && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/audit">Audit</Link>
            </Button>
          )}
          {auth.user.role === "admin" && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/system">System</Link>
            </Button>
          )}
        </div>

        {/* Right — Sign out · Role badge · Health */}
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:text-white px-4"
            onClick={() => {
              clearAuth();
              router.push("/");
            }}
          >
            Sign out
          </Button>
          <RoleBadge role={auth.user.role} />
          <HealthIndicator />
        </div>

      </div>
    </header>
  );
}
