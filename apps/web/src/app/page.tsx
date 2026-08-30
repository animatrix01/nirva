"use client";

import Link from "next/link";
import {
  ArrowRight,
  Cpu,
  Database,
  GitCompare,
  KeyRound,
  Link2,
  Monitor,
  Quote,
  Server,
  ShieldCheck,
  Wrench,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStoredAuth } from "@/lib/auth-client";
import { useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

// Hydration-safe mounted flag: server snapshot false, client snapshot true —
// the post-hydration render is the first that may read localStorage.
function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}

const FEATURES = [
  {
    icon: Quote,
    title: "Grounded citations",
    description:
      "Every claim links to the exact source passage — title, revision, page.",
  },
  {
    icon: Wrench,
    title: "Read-only tools",
    description:
      "Asset history and inventory via least-privilege, parameterized queries.",
  },
  {
    icon: GitCompare,
    title: "Contradiction surfacing",
    description:
      "Conflicting records are shown side-by-side, never silently resolved.",
  },
  {
    icon: ShieldCheck,
    title: "Human approval gate",
    description:
      "Consequential actions wait for a supervisor's explicit decision.",
  },
  {
    icon: Link2,
    title: "Tamper-evident audit",
    description: "Hash-chained events, re-verified on every read.",
  },
  {
    icon: KeyRound,
    title: "Role-based access",
    description:
      "Four roles, enforced server-side — zero trust in the client.",
  },
];

const PIPELINE = [
  {
    icon: Monitor,
    name: "Console",
    caption: "Investigator submits a bounded objective",
  },
  {
    icon: Server,
    name: "API",
    caption: "Auth, ACLs, SSE streaming, approvals",
  },
  {
    icon: Workflow,
    name: "Agent graph",
    caption: "Plan, retrieve, answer, propose — checkpointed",
  },
  {
    icon: Database,
    name: "Ollama · Qdrant · Tools",
    caption: "Local models, local vectors, read-only tools",
  },
];

const METRICS = [
  { value: "100%", label: "offline-verified" },
  { value: "≥ 0.85", label: "Recall@5 (target)" },
  { value: "0", label: "unauthorized chunks" },
  { value: "0", label: "approval bypasses" },
];

export default function LandingPage() {
  const mounted = useMounted();
  const auth = useStoredAuth();
  const authed = mounted && auth !== null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold tracking-tight">NIRVA</span>
          <nav aria-label="Main">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4">
        {/* Hero */}
        <section className="flex flex-col items-center gap-4 py-16 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            NIRVA
          </h1>
          <p className="max-w-2xl text-xl font-medium sm:text-2xl">
            The offline industrial investigation workbench
          </p>
          <p className="text-muted-foreground max-w-2xl text-sm sm:text-base">
            Sovereign evidence-to-action for confidential refinery work — every
            answer cited, every action approved, every byte local.
          </p>
          <Button size="lg" asChild>
            <Link href={authed ? "/investigations" : "/login"}>
              {authed ? "Open workbench" : "Try it now"}
              <ArrowRight aria-hidden className="ml-2 size-4" />
            </Link>
          </Button>
          <p className="text-muted-foreground text-xs">
            SIH26117 · MRPL · demo build
          </p>
        </section>

        {/* Features */}
        <section aria-labelledby="features-heading" className="py-10">
          <h2 id="features-heading" className="sr-only">
            What makes NIRVA different
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-lg border p-4">
                <f.icon aria-hidden className="mb-2 size-5" />
                <h3 className="text-sm font-semibold">{f.title}</h3>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="how-heading" className="py-10">
          <h2
            id="how-heading"
            className="mb-4 text-sm font-semibold uppercase tracking-wide"
          >
            How it works
          </h2>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            {PIPELINE.map((step, i) => (
              <div key={step.name} className="flex flex-1 items-center gap-3">
                <div className="flex-1 rounded-lg border p-3 text-center">
                  <step.icon aria-hidden className="mx-auto mb-1 size-5" />
                  <p className="text-xs font-semibold">{step.name}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {step.caption}
                  </p>
                </div>
                {i < PIPELINE.length - 1 && (
                  <>
                    <ArrowRight
                      aria-hidden
                      className="text-muted-foreground hidden size-4 shrink-0 sm:block"
                    />
                    <ArrowRight
                      aria-hidden
                      className="text-muted-foreground mx-auto size-4 shrink-0 rotate-90 sm:hidden"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-center">
            <span
              className={`
                inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold
                border-emerald-300 bg-emerald-50 text-emerald-800
                dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300
              `}
            >
              <Cpu aria-hidden className="size-3.5" />
              100% LOCAL
            </span>
          </div>
        </section>

        {/* Differentiator band */}
        <section
          aria-labelledby="local-heading"
          className="rounded-lg border bg-muted/40 px-4 py-6"
        >
          <h2
            id="local-heading"
            className="text-sm font-semibold uppercase tracking-wide"
          >
            Runs inside your walls
          </h2>
          <ul className="mt-3 flex flex-col gap-1 text-sm sm:flex-row sm:gap-6">
            <li>· no cloud LLM</li>
            <li>· no data egress</li>
            <li>· verified with the internet disconnected</li>
          </ul>
        </section>

        {/* Metrics strip */}
        <section aria-label="Key metrics" className="py-10">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {METRICS.map((m) => (
              <div
                key={m.label}
                className="rounded-lg border p-4 text-center"
              >
                <p className="text-2xl font-semibold">{m.value}</p>
                <p className="text-muted-foreground mt-1 text-xs">{m.label}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 text-xs">
          <p>NIRVA — SIH26117 · All demo data is synthetic</p>
          <Link href="/login" className="underline underline-offset-2">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
