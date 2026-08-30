"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  ClipboardCheck,
  FileSearch,
  FileText,
  GitCompare,
  KeyRound,
  Link2,
  MessageSquarePlus,
  Quote,
  Scale,
  ShieldCheck,
  Stamp,
  UserCog,
  UserShield,
  Wrench,
} from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useStoredAuth } from "@/lib/auth-client";

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

// --- Brand monogram ------------------------------------------------------------

function Monogram() {
  return (
    <span
      aria-hidden
      className="inline-flex size-10 items-center justify-center rounded-lg border-2 border-zinc-800 text-xl font-bold tracking-tight"
    >
      N
    </span>
  );
}

// --- Hero workbench mock -----------------------------------------------------

function WorkbenchMock() {
  return (
    <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-left text-zinc-100 shadow-lg">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <span aria-hidden className="size-2.5 rounded-full bg-zinc-600" />
        <span aria-hidden className="size-2.5 rounded-full bg-zinc-600" />
        <span aria-hidden className="size-2.5 rounded-full bg-zinc-600" />
        <p className="text-muted-foreground ml-2 font-mono text-xs">
          NIRVA — Investigating Pump P-204
        </p>
      </div>
      <div className="space-y-3 p-4 font-mono text-xs">
        <p className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-300">
          <span className="text-zinc-500">objective:</span> “Investigate why
          Pump P-204 has failed repeatedly. Check the manual, the work orders,
          spare-part availability — and propose a safe next action.”
        </p>
        <div className="space-y-1.5" aria-label="Investigation progress preview">
          <p className="flex items-center gap-2">
            <BadgeCheck aria-hidden className="size-3.5 text-emerald-400" />
            Reading maintenance history{" "}
            <span className="text-zinc-500">done</span>
          </p>
          <p className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-3.5 animate-pulse rounded-full border-2 border-zinc-500 border-t-blue-400"
            />
            Checking the OEM manual…
          </p>
          <p className="flex items-center gap-2">
            <span aria-hidden className="size-3.5 rounded-full border-2 border-zinc-600" />
            Comparing work orders
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Citation chips">
          <span className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">
            [OEM Manual, rev C, p41]
          </span>
          <span className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">
            [WO-88712, rev 2, §3.2]
          </span>
        </div>
        <div>
          <div className="flex justify-between text-zinc-400">
            <span>report confidence</span>
            <span>0.87</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-zinc-800">
            <div className="h-1.5 w-[87%] rounded-full bg-emerald-500" />
          </div>
        </div>
        <p className="inline-flex items-center gap-1.5 rounded border border-amber-800 bg-amber-950/60 px-2 py-0.5 text-amber-300">
          <ClipboardCheck aria-hidden className="size-3.5" />
          waiting for a supervisor&apos;s decision
        </p>
      </div>
    </div>
  );
}

// --- Question-to-action flowchart ------------------------------------------------

const JOURNEY = [
  {
    icon: MessageSquarePlus,
    name: "Ask",
    caption:
      "An engineer describes the problem in plain words — no query syntax, no checkboxes.",
    branch: null,
  },
  {
    icon: BookOpen,
    name: "Read",
    caption:
      "NIRVA reads the manuals, work orders and logs — only the documents that person is allowed to see.",
    branch: null,
  },
  {
    icon: Scale,
    name: "Verify",
    caption: "Every record is cross-checked against the others.",
    branch: "conflicting records? → shown side-by-side, never hidden",
  },
  {
    icon: FileText,
    name: "Propose",
    caption:
      "A cited recommendation with confidence, assumptions and gaps.",
    branch: "evidence too thin? → NIRVA abstains honestly",
  },
  {
    icon: Stamp,
    name: "Approve",
    caption:
      "Nothing consequential happens until a supervisor signs off — and everything is logged.",
    branch: null,
  },
];

function JourneyFlowchart() {
  return (
    <div className="relative mx-auto flex max-w-2xl flex-col items-center">
      {/* vertical connector behind the nodes */}
      <span
        aria-hidden
        className="absolute top-4 bottom-4 left-1/2 w-px -translate-x-1/2 bg-border"
      />
      {/* Start pill */}
      <div className="relative z-10 rounded-full border bg-background px-5 py-2 text-sm font-medium shadow-sm">
        An engineer asks a question
      </div>
      <ArrowDown aria-hidden className="z-10 my-1 size-4 text-zinc-400" />

      {JOURNEY.map((s) => (
        <div key={s.name} className="relative z-10 flex w-full justify-center">
          <div className="w-full max-w-md rounded-xl border bg-background p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <s.icon aria-hidden className="size-5" />
              <h3 className="text-sm font-semibold">{s.name}</h3>
            </div>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              {s.caption}
            </p>
            {s.branch && (
              <p className="mt-2 flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground">
                <GitCompare aria-hidden className="size-3 shrink-0" />
                {s.branch}
              </p>
            )}
          </div>
        </div>
      ))}

      <ArrowDown aria-hidden className="z-10 my-1 size-4 text-zinc-400" />
      {/* Stop pill */}
      <div className="relative z-10 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-50 px-5 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        <ShieldCheck aria-hidden className="size-4" />
        Signed-off action — full audit trail
      </div>
    </div>
  );
}

// --- Roles -----------------------------------------------------------------------

const ROLES_LIST = [
  { icon: FileSearch, role: "Engineer", line: "Submits investigations, uploads and cites evidence." },
  { icon: ClipboardCheck, role: "Supervisor", line: "The only role that can approve consequential actions." },
  { icon: UserShield, role: "Safety Officer", line: "Reads the full tamper-evident audit trail." },
  { icon: UserCog, role: "Admin", line: "Publishes documents and manages the local model registry." },
];

// --- Page ------------------------------------------------------------------------

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

const METRICS = [
  {
    value: "0",
    label: "cloud calls",
    line: "Every model, embedding and log stays on-premise — verified with the internet disconnected.",
  },
  {
    value: "100%",
    label: "cited answers",
    line: "Every claim links to its exact source passage, or is labeled an assumption.",
  },
  {
    value: "0",
    label: "unauthorized reads",
    line: "Documents past a user's clearance are filtered during retrieval, never after.",
  },
  {
    value: "0",
    label: "approval bypasses",
    line: "No consequential action executes without a supervisor's signature.",
  },
];

export default function LandingPage() {
  const mounted = useMounted();
  const auth = useStoredAuth();
  const authed = mounted && auth !== null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2">
            <Monogram />
            <span className="text-lg font-semibold tracking-tight">NIRVA</span>
          </span>
          <nav aria-label="Main">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        {/* Hero — centered */}
        <section className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="flex items-center gap-2">
            <Monogram />
            <span className="text-2xl font-bold tracking-tight">NIRVA</span>
          </p>
          <p className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
            From evidence to action — inside your walls
          </p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            The offline industrial investigation workbench
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm sm:text-base">
            Sovereign evidence-to-action for confidential refinery work —
            every answer cited, every action approved, every byte local.
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

        {/* Workbench mock with the golden question as objective */}
        <section aria-label="Product preview" className="pb-16">
          <WorkbenchMock />
        </section>

        {/* Flowchart journey */}
        <section aria-labelledby="journey-heading" className="py-10">
          <h2
            id="journey-heading"
            className="mb-8 text-center text-sm font-semibold uppercase tracking-wide"
          >
            From question to signed-off action
          </h2>
          <JourneyFlowchart />
        </section>

        {/* Features */}
        <section aria-labelledby="features-heading" className="py-10">
          <h2
            id="features-heading"
            className="mb-4 text-center text-sm font-semibold uppercase tracking-wide"
          >
            Built for the refinery floor
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

        {/* Roles */}
        <section aria-labelledby="roles-heading" className="py-10">
          <h2
            id="roles-heading"
            className="mb-4 text-center text-sm font-semibold uppercase tracking-wide"
          >
            Four roles, least privilege
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES_LIST.map((r) => (
              <div key={r.role} className="rounded-lg border p-4">
                <r.icon aria-hidden className="mb-2 size-5" />
                <h3 className="text-sm font-semibold">{r.role}</h3>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {r.line}
                </p>
              </div>
            ))}
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

        {/* Metrics — plain language */}
        <section aria-labelledby="metrics-heading" className="py-10">
          <h2
            id="metrics-heading"
            className="mb-4 text-center text-sm font-semibold uppercase tracking-wide"
          >
            The numbers that matter
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {METRICS.map((m) => (
              <div key={m.label} className="rounded-lg border p-4">
                <p className="text-3xl font-semibold">{m.value}</p>
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {m.line}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 text-xs">
          <p>NIRVA — SIH26117 · All demo data is synthetic</p>
          <Link href="/login" className="underline underline-offset-2">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
