"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Cpu,
  Database,
  FileSearch,
  GitCompare,
  KeyRound,
  Link2,
  Monitor,
  Quote,
  Server,
  ShieldCheck,
  UserCog,
  UserShield,
  Wrench,
  Workflow,
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

// --- Hero workbench mock -----------------------------------------------------

function WorkbenchMock() {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-lg">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <span aria-hidden className="size-2.5 rounded-full bg-zinc-600" />
        <span aria-hidden className="size-2.5 rounded-full bg-zinc-600" />
        <span aria-hidden className="size-2.5 rounded-full bg-zinc-600" />
        <p className="text-muted-foreground ml-2 font-mono text-xs">
          NIRVA — Investigation P-204
        </p>
      </div>
      <div className="space-y-3 p-4 font-mono text-xs">
        <div className="space-y-1.5" aria-label="Node timeline preview">
          <p className="flex items-center gap-2">
            <BadgeCheck aria-hidden className="size-3.5 text-emerald-400" />
            intake <span className="text-zinc-500">finished</span>
          </p>
          <p className="flex items-center gap-2">
            <BadgeCheck aria-hidden className="size-3.5 text-emerald-400" />
            retrieve <span className="text-zinc-500">5 authorized chunks</span>
          </p>
          <p className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-3.5 animate-pulse rounded-full border-2 border-zinc-500 border-t-blue-400"
            />
            answer <span className="text-zinc-500">composing cited findings…</span>
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
          awaiting_approval — supervisor decision required
        </p>
      </div>
    </div>
  );
}

// --- Workflow step cards ------------------------------------------------------

const STEPS = [
  {
    n: "01",
    icon: Monitor,
    name: "Console",
    caption: "The investigator submits a bounded objective with the asset in scope.",
    bullets: ["ACL-checked from the first keystroke", "Equipment-scoped requests"],
  },
  {
    n: "02",
    icon: Server,
    name: "API",
    caption: "FastAPI issues JWTs, filters documents by role, and streams every event.",
    bullets: ["SSE envelope, seq-ordered", "Approvals with zero bypass"],
  },
  {
    n: "03",
    icon: Workflow,
    name: "Agent graph",
    caption: "A checkpointed LangGraph plans, retrieves, answers, and proposes.",
    bullets: ["Citations on every claim", "Abstains when evidence is thin"],
  },
  {
    n: "04",
    icon: Database,
    name: "Ollama · Qdrant · Tools",
    caption: "Local inference, local vectors, and least-privilege read-only tools.",
    bullets: ["No cloud, no egress", "Parameterized queries only"],
  },
];

function StepCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {STEPS.map((s, i) => (
        <div
          key={s.n}
          className={`relative rounded-xl border p-4 ${
            i === STEPS.length - 1 ? "border-emerald-500/40" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-semibold text-zinc-400">
              {s.n}
            </span>
            <s.icon aria-hidden className="size-5" />
            <h3 className="text-sm font-semibold">{s.name}</h3>
            {i === STEPS.length - 1 && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <Cpu aria-hidden className="size-3" />
                100% LOCAL
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            {s.caption}
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {s.bullets.map((b) => (
              <li key={b} className="flex items-center gap-1.5 text-xs">
                <ArrowRight aria-hidden className="size-3 shrink-0 text-zinc-400" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// --- Analytics charts (SVG, illustrative data) --------------------------------

function ChunksChart() {
  const bars = [2, 5, 4, 8, 6, 5];
  const max = 10;
  return (
    <div className="flex-1">
      <p className="text-xs font-medium text-zinc-300">
        Authorized chunks retrieved per step
      </p>
      <svg
        viewBox="0 0 220 110"
        className="mt-2 w-full"
        role="img"
        aria-label="Bar chart: authorized chunks retrieved per investigation step, illustrative data"
      >
        {[0, 1, 2, 3].map((g) => (
          <line
            key={g}
            x1="28"
            x2="212"
            y1={12 + g * 24}
            y2={12 + g * 24}
            stroke="currentColor"
            className="text-zinc-800"
            strokeDasharray="3 4"
          />
        ))}
        {bars.map((v, i) => (
          <rect
            key={i}
            x={34 + i * 30}
            y={84 - (v / max) * 68}
            width="18"
            height={(v / max) * 68}
            rx="2"
            className="fill-zinc-500"
          />
        ))}
        {["0", "5", "10"].map((t, g) => (
          <text key={t} x="22" y={16 + g * 24} textAnchor="end" className="fill-zinc-500 text-[8px]">
            {t}
          </text>
        ))}
        {["in", "re", "an", "fi", "pr", "ap"].map((t, i) => (
          <text key={t} x={43 + i * 30} y="100" textAnchor="middle" className="fill-zinc-500 text-[8px]">
            {t}
          </text>
        ))}
      </svg>
    </div>
  );
}

function AuditDonut() {
  // 100% verified arc
  const c = 2 * Math.PI * 36;
  return (
    <div className="flex-1">
      <p className="text-xs font-medium text-zinc-300">Audit hash chain</p>
      <svg
        viewBox="0 0 100 100"
        className="mx-auto mt-2 w-28"
        role="img"
        aria-label="Donut chart: audit hash chain verified, illustrative data"
      >
        <circle cx="50" cy="50" r="36" fill="none" strokeWidth="10" className="stroke-zinc-800" />
        <circle
          cx="50"
          cy="50"
          r="36"
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-emerald-500"
          strokeDasharray={`${c} ${c}`}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="54" textAnchor="middle" className="fill-zinc-100 text-[14px] font-semibold">
          100%
        </text>
      </svg>
      <p className="text-center text-xs text-zinc-400">verified on read</p>
    </div>
  );
}

function ConfidenceGauge() {
  // Semicircle gauge at 0.87
  const arc = Math.PI * 34;
  return (
    <div className="flex-1">
      <p className="text-xs font-medium text-zinc-300">Report confidence</p>
      <svg
        viewBox="0 0 100 62"
        className="mx-auto mt-2 w-28"
        role="img"
        aria-label="Gauge chart: report confidence 0.87, illustrative data"
      >
        <path
          d="M 14 54 A 36 36 0 0 1 86 54"
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-zinc-800"
        />
        <path
          d="M 14 54 A 36 36 0 0 1 86 54"
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className="stroke-emerald-500"
          strokeDasharray={`${0.87 * arc} ${arc}`}
        />
        <text x="50" y="50" textAnchor="middle" className="fill-zinc-100 text-[14px] font-semibold">
          0.87
        </text>
      </svg>
      <p className="text-center text-xs text-zinc-400">cited, abstains below threshold</p>
    </div>
  );
}

function AnalyticsSection() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-zinc-100">
      <div className="flex flex-col gap-6 sm:flex-row">
        <ChunksChart />
        <AuditDonut />
        <ConfidenceGauge />
      </div>
      <p className="mt-4 text-center text-xs text-zinc-500">
        Illustrative demo data — synthetic documents, seeded demo run.
      </p>
    </div>
  );
}

// --- Terminal card --------------------------------------------------------------

const SSE_ROWS = [
  { seq: 0, type: "node_started", node: "intake" },
  { seq: 2, type: "node_started", node: "retrieve" },
  { seq: 4, type: "tool_called", node: "retrieve", ref: "search_documents" },
  { seq: 5, type: "evidence_added", node: "retrieve" },
  { seq: 9, type: "node_finished", node: "finalize" },
  { seq: 12, type: "awaiting_approval", node: "propose", ref: "approval_request" },
];

function TerminalCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <span aria-hidden className="size-2.5 rounded-full bg-zinc-600" />
        <span aria-hidden className="size-2.5 rounded-full bg-zinc-600" />
        <span aria-hidden className="size-2.5 rounded-full bg-zinc-600" />
        <p className="text-muted-foreground ml-2 font-mono text-xs">
          GET /api/jobs/…/events — text/event-stream
        </p>
      </div>
      <div className="space-y-1 p-4 font-mono text-xs">
        {SSE_ROWS.map((r) => (
          <p key={r.seq} className="flex gap-2">
            <span className="text-zinc-500">seq {String(r.seq).padStart(2, "0")}</span>
            <span className="text-emerald-400">{r.type}</span>
            <span className="text-zinc-400">{r.node}</span>
            {r.ref && <span className="text-zinc-500">[{r.ref}]</span>}
          </p>
        ))}
        <p className="flex gap-2">
          <span className="text-zinc-500">seq 13</span>
          <span className="animate-pulse text-zinc-300">▊</span>
        </p>
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
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <span className="text-lg font-semibold tracking-tight">NIRVA</span>
          <nav aria-label="Main">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        {/* Hero */}
        <section className="grid grid-cols-1 items-center gap-8 py-14 lg:grid-cols-2 lg:py-20">
          <div className="flex flex-col items-center gap-4 text-center lg:items-start lg:text-left">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              NIRVA
            </h1>
            <p className="max-w-xl text-xl font-medium sm:text-2xl">
              The offline industrial investigation workbench
            </p>
            <p className="text-muted-foreground max-w-xl text-sm sm:text-base">
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
          </div>
          <WorkbenchMock />
        </section>

        {/* Workflow steps */}
        <section aria-labelledby="how-heading" className="py-10">
          <h2
            id="how-heading"
            className="mb-4 text-sm font-semibold uppercase tracking-wide"
          >
            How it works
          </h2>
          <StepCards />
        </section>

        {/* Analytics */}
        <section aria-labelledby="analytics-heading" className="py-10">
          <h2
            id="analytics-heading"
            className="mb-4 text-sm font-semibold uppercase tracking-wide"
          >
            Measured, not claimed
          </h2>
          <AnalyticsSection />
        </section>

        {/* Terminal */}
        <section aria-labelledby="terminal-heading" className="py-10">
          <h2
            id="terminal-heading"
            className="mb-4 text-sm font-semibold uppercase tracking-wide"
          >
            Every event, streamed and auditable
          </h2>
          <TerminalCard />
        </section>

        {/* Features */}
        <section aria-labelledby="features-heading" className="py-10">
          <h2
            id="features-heading"
            className="mb-4 text-sm font-semibold uppercase tracking-wide"
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
            className="mb-4 text-sm font-semibold uppercase tracking-wide"
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
