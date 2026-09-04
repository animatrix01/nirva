"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ClipboardCheck,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Menu,
  ScrollText,
  Settings,
  X,
} from "lucide-react";
import { RoleBadge } from "@/components/role-badge";
import { HealthIndicator } from "@/components/health-indicator";
import { clearAuth } from "@/lib/api";
import { useStoredAuth } from "@/lib/auth-client";
import type { Role } from "@/lib/types";

const subscribeNever = () => () => {};

interface NavItem {
  href: string;
  label: string;
  icon: typeof FileText;
  roles: Role[] | null; // null = all roles
  match: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/workbench",
    label: "Workbench",
    icon: LayoutDashboard,
    roles: null,
    match: (p) => p === "/workbench",
  },
  {
    href: "/investigations",
    label: "Investigations",
    icon: FileText,
    roles: null,
    match: (p) => p.startsWith("/investigations"),
  },
  {
    href: "/documents",
    label: "Documents",
    icon: FolderOpen,
    roles: null,
    match: (p) => p.startsWith("/documents"),
  },
  {
    href: "/approvals",
    label: "Approvals",
    icon: ClipboardCheck,
    roles: ["supervisor", "admin"],
    match: (p) => p.startsWith("/approvals"),
  },
  {
    href: "/audit",
    label: "Audit",
    icon: ScrollText,
    roles: ["admin", "safety_officer"],
    match: (p) => p.startsWith("/audit"),
  },
  {
    href: "/admin/system",
    label: "System",
    icon: Settings,
    roles: ["admin"],
    match: (p) => p.startsWith("/admin"),
  },
];

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const auth = useStoredAuth();
  const role = auth?.user.role;
  const effectivePath = pathname === "" ? "/workbench" : pathname;

  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5 px-3 py-2">
      {NAV_ITEMS.map((item) => {
        if (item.roles && (!role || !item.roles.includes(role))) return null;
        const active = item.match(effectivePath);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 border-l-2 px-3 py-2 text-sm transition-colors ${
              active
                ? "border-[#C4F135] bg-neutral-800/60 font-medium text-white"
                : "border-transparent text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200"
            }`}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const auth = useStoredAuth();
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    useCallback(() => false, [])
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (mounted && auth === null) router.replace("/login");
  }, [mounted, auth, router]);

  if (!auth) {
    return (
      <div className="min-h-screen bg-background" aria-busy="true">
        <div className="flex items-center gap-2 p-6 text-sm text-neutral-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-neutral-800 bg-neutral-900 lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-neutral-800 px-5">
          <img
            src="/nirva_logo_-removebg-preview.png"
            alt="NIRVA"
            className="size-8 object-contain"
          />
          <span className="text-base font-bold tracking-tight text-white">NIRVA</span>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav pathname={pathname} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-60 flex-col border-r border-neutral-800 bg-neutral-900">
            <div className="flex h-16 items-center justify-between border-b border-neutral-800 px-4">
              <span className="text-base font-bold tracking-tight text-white">NIRVA</span>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setDrawerOpen(false)}
                className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <SidebarNav pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Content column */}
      <div className="lg:pl-60">
        {/* Slim topbar */}
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
              className="rounded-md p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <p className="text-sm font-semibold text-neutral-200">{title}</p>
            <div className="ml-auto flex items-center gap-3">
              <HealthIndicator />
              <RoleBadge role={auth.user.role} />
              <button
                type="button"
                onClick={() => {
                  clearAuth();
                  router.push("/login");
                }}
                className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 transition hover:bg-neutral-800 hover:text-white"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
