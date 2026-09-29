"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
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
import { EgressBadge } from "@/components/egress-badge";
import { HealthIndicator } from "@/components/health-indicator";
import { clearAuth } from "@/lib/api";
import { useStoredAuth } from "@/lib/auth-client";
import type { Role } from "@/lib/types";

// Subscription function for useSyncExternalStore that never triggers updates
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
    href: "/evaluations",
    label: "Evals",
    icon: BarChart3,
    roles: ["admin"],
    match: (p) => p.startsWith("/evaluations"),
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

  // Group navigation items by section
  const coreItems = NAV_ITEMS.filter(item => 
    ["Workbench", "Investigations", "Documents"].includes(item.label)
  );
  const adminItems = NAV_ITEMS.filter(item => 
    !["Workbench", "Investigations", "Documents"].includes(item.label)
  );

  const renderNavItem = (item: NavItem) => {
    if (item.roles && (!role || !item.roles.includes(role))) return null;
    const active = item.match(effectivePath);
    return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 border-l-2 px-3 py-2 text-sm font-semibold transition-colors ${
              active
                ? "border-[#B9FF52] bg-[#f0fdf4] text-slate-900"
                : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
    );
  };

  const hasAdminItems = adminItems.some(item => 
    !item.roles || (role && item.roles.includes(role))
  );

  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5 px-3 py-3">
      {coreItems.map(renderNavItem)}
      
      {hasAdminItems && (
        <>
          <div className="px-3 pt-4 pb-2">
            <p className="text-[10px] uppercase tracking-widest text-slate-400">
              {role === "safety_officer" ? "Compliance" : "Administration"}
            </p>
          </div>
          {adminItems.map(renderNavItem)}
        </>
      )}
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

  // Reduce grid opacity on all internal app pages
  useEffect(() => {
    document.body.classList.add("nirva-app");
    return () => document.body.classList.remove("nirva-app");
  }, []);

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
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-5">
          <img
            src="/nirva_logo_-removebg-preview.png"
            alt="NIRVA"
            className="size-12 object-contain"
          />
          <span className="text-lg font-bold tracking-tight text-foreground">NIRVA</span>
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
          <div className="absolute inset-y-0 left-0 flex w-60 flex-col border-r border-border bg-card">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <span className="text-base font-bold tracking-tight text-foreground">NIRVA</span>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setDrawerOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
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
      <div className="flex min-h-screen flex-col lg:pl-60 bg-background">
        {/* Slim topbar */}
        <header className="sticky top-0 z-30 border-b border-border bg-card backdrop-blur">
          <div className="flex h-14 items-center gap-4 px-4 lg:px-6">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <p className="text-base font-semibold text-foreground">{title}</p>
            <div className="ml-auto flex items-center gap-3">
              <EgressBadge />
              <HealthIndicator />
              <RoleBadge role={auth.user.role} />
              <button
                type="button"
                onClick={() => {
                  clearAuth();
                  router.push("/");
                }}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                Sign out
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h6M6 3l3 3-3 3"/>
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main className="w-full flex-1 px-4 py-4 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
