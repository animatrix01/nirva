"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  GitCompare,
  KeyRound,
  Link2,
  Lock,
  Quote,
  Shield,
  ShieldCheck,
  TriangleAlert,
  UserCog,
  UserShield,
} from "lucide-react";
import { useSyncExternalStore } from "react";
import { useStoredAuth } from "@/lib/auth-client";

const subscribeNoop = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

const LIME = "#c8f135";

// ─── NIRVA Asterisk Logo ─────────────────────────────────────────────────────
function NirvaLogo({ className = "size-8" }: { className?: string }) {
  const cx = 16, cy = 16, r = 13, w = 3.2;
  const spokes = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * 60 - 90) * (Math.PI / 180);
    const ox = cx + r * Math.cos(angle);
    const oy = cy + r * Math.sin(angle);
    const tip = 2.5;
    const tx = cx + tip * Math.cos(angle + Math.PI);
    const ty = cy + tip * Math.sin(angle + Math.PI);
    const px = Math.sin(angle) * w;
    const py = -Math.cos(angle) * w;
    const hw = w * 2.2;
    const hpx = Math.sin(angle) * hw;
    const hpy = -Math.cos(angle) * hw;
    const headLen = 5.5;
    const bx = tx + headLen * Math.cos(angle);
    const by = ty + headLen * Math.sin(angle);
    return (
      <g key={i}>
        <polygon
          fill={LIME}
          points={` ${ox + px},${oy + py} ${ox - px},${oy - py} ${bx - px},${by - py} ${bx + px},${by + py} `}
        />
        <polygon
          fill={LIME}
          points={` ${tx},${ty} ${bx + hpx},${by + hpy} ${bx - hpx},${by - hpy} `}
        />
      </g>
    );
  });
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none">
      {spokes}
    </svg>
  );
}

// ─── Investigation Terminal (right column) ───────────────────────────────────
function InvestigationTerminal() {
  return (
    <div className="w-full bg-stone-900/60 rounded-xl border border-stone-700/60 shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 bg-stone-900/80">
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-red-500/80" />
          <span className="size-3 rounded-full bg-yellow-500/80" />
          <span className="size-3 rounded-full bg-emerald-500/80" />
        </div>
        <span className="text-xs text-stone-400 font-mono">NIRVA Investigation Engine — Live</span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Running
        </span>
      </div>

      <div className="p-5 space-y-4 font-mono text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-1.5">Investigation Objective</p>
          <p className="text-stone-200 leading-relaxed text-[13px]">
            &ldquo;Investigate why{" "}
            <span className="font-semibold text-white">Pump P-204</span> has
            failed repeatedly. Compare maintenance history with the OEM manual and safety SOP, check
            spare-part availability, and prepare a cited maintenance recommendation.&rdquo;
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-2">
            + Investigation Plan — 5 Steps
          </p>
          <div className="space-y-1.5">
            {[
              { done: true,  active: false, label: "Read maintenance history",         sub: "Found 7 work orders spanning 18 months" },
              { done: true,  active: false, label: "Cross-reference OEM manual rev C", sub: "Bearing spec mismatch detected on p.41" },
              { done: false, active: true,  label: "Check spare-part inventory…",      sub: "Querying local inventory database" },
              { done: false, active: false, label: "Compare safety SOP rev 4",         sub: "" },
              { done: false, active: false, label: "Compose cited recommendation",     sub: "" },
            ].map((s, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-lg px-3 py-2 ${s.active ? "bg-stone-800/60 border border-stone-700" : ""}`}>
                {s.done ? (
                  <BadgeCheck className="size-4 shrink-0 mt-0.5 text-emerald-400" />
                ) : s.active ? (
                  <span className="size-4 shrink-0 mt-0.5 rounded-full border-2 border-stone-600 border-t-stone-300 animate-spin inline-block" />
                ) : (
                  <span className="size-4 shrink-0 mt-0.5 rounded-full border border-stone-600 inline-block" />
                )}
                <div>
                  <span className={`text-[12px] ${s.done ? "text-stone-300" : s.active ? "text-stone-200 font-medium" : "text-stone-500"}`}>
                    {s.label}
                    {s.done && <span className="ml-2 text-[10px] text-emerald-500">done</span>}
                  </span>
                  {s.sub && <p className="text-[10px] text-stone-500 mt-0.5">{s.sub}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-orange-700/40 bg-orange-500/10 px-3 py-3">
          <TriangleAlert className="size-4 shrink-0 mt-0.5 text-orange-400" />
          <div>
            <p className="text-[12px] font-semibold text-orange-300">Contradiction detected</p>
            <p className="mt-0.5 text-[11px] text-orange-400/80 leading-relaxed">
              OEM manual rev C (p.41) specifies bearing load 4.2 kN — Work Order WO-88712 records
              installation at 5.8 kN. Surfaced side-by-side.
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-1.5">+ Evidence Citations</p>
          <div className="flex flex-wrap gap-1.5">
            {["OEM Manual, rev C, p.41","SOP-MRPL-004, rev 4, §3.2","WO-88712, rev 2, §3.2","Incident IR-2024-031, p.3"].map(c => (
              <span key={c} className="rounded border border-stone-700 bg-stone-900 px-2 py-0.5 text-[10px] text-stone-300">{c}</span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-stone-700/50 bg-stone-900/60 p-3">
            <p className="text-[10px] uppercase tracking-widest text-stone-500">Report Confidence</p>
            <p className="mt-1 text-2xl font-bold text-white">87%</p>
            <div className="mt-2 h-1.5 rounded-full bg-stone-800">
              <div className="h-1.5 w-[87%] rounded-full bg-emerald-500" />
            </div>
          </div>
          <div className="rounded-lg border border-amber-700/40 bg-amber-500/10 p-3">
            <p className="text-[10px] uppercase tracking-widest text-amber-600">Status</p>
            <p className="mt-1 text-xs font-semibold text-amber-300">Awaiting supervisor decision</p>
            <p className="mt-1 text-[10px] text-amber-400/70 leading-relaxed">Work-order draft ready. No action executes without approval.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Journey flowchart (SVG, plain-language) ─────────────────────────────────
function JourneyFlowchart() {
  const box = (x: number, y: number, w: number, h: number, fill: string) => (
    <rect x={x} y={y} width={w} height={h} rx={10} fill={fill} stroke="#57534e" strokeWidth={1.2} />
  );
  const label = (x: number, y: number, text: string, fill = "#e7e5e4", size = 11, weight = "600") => (
    <text x={x} y={y} textAnchor="middle" fill={fill} fontSize={size} fontWeight={weight}>{text}</text>
  );
  const arrow = (x1: number, y1: number, x2: number, y2: number) => (
    <g stroke="#78716c" strokeWidth={1.4} fill="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polygon fill="#78716c" stroke="none" points={`${x2},${y2} ${x2 - 6},${y2 - 4} ${x2 - 6},${y2 + 4}`} />
    </g>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-700/60 bg-stone-900/40 p-4">
      <svg viewBox="0 0 960 300" className="min-w-[760px] w-full" fill="none" role="img" aria-label="Investigation journey flowchart">
        {/* start terminator */}
        {box(10, 24, 150, 44, "#1c1917")}
        {label(85, 44, "Engineer asks a question", "#e7e5e4", 10.5)}
        {label(85, 58, "plain language", "#78716c", 9, "400")}
        {arrow(160, 46, 196, 46)}

        {/* process: read */}
        {box(198, 24, 108, 44, "#1c1917")}
        {label(252, 44, "Read", "#e7e5e4", 11)}
        {label(252, 58, "only authorized", "#78716c", 9, "400")}
        {arrow(306, 46, 342, 46)}

        {/* decision */}
        <polygon points="418,16 500,46 418,76 336,46" fill="#1c1917" stroke="#57534e" strokeWidth={1.2} />
        {label(418, 43, "Records", "#e7e5e4", 10.5)}
        {label(418, 57, "consistent?", "#e7e5e4", 10.5)}

        {/* yes -> cited recommendation */}
        {arrow(500, 46, 536, 46)}
        {label(517, 38, "yes", "#a8a29e", 9, "400")}
        {box(538, 24, 132, 44, "#1c1917")}
        {label(604, 44, "Cited recommendation", "#e7e5e4", 10)}
        {label(604, 58, "every claim sourced", "#78716c", 9, "400")}
        {arrow(670, 46, 706, 46)}
        {box(708, 24, 128, 44, "#1c1917")}
        {label(772, 44, "Work-order draft", "#e7e5e4", 10)}
        {label(772, 58, "awaits supervisor", "#78716c", 9, "400")}
        {arrow(836, 46, 872, 46)}

        {/* end terminator */}
        {box(874, 24, 80, 44, "#1c1917")}
        {label(914, 40, "Signed off", "#e7e5e4", 10)}
        {label(914, 54, "full audit trail", "#78716c", 8.5, "400")}

        {/* no branch: conflicting records */}
        {arrow(418, 76, 418, 116)}
        {label(442, 100, "no", "#a8a29e", 9, "400")}
        {box(318, 118, 200, 56, "#1c1917")}
        {label(418, 138, "Conflicting records", "#fbbf24", 10.5, "700")}
        {label(418, 154, "shown side-by-side — never silently resolved", "#78716c", 9, "400")}

        {/* abstain branch */}
        {arrow(252, 68, 252, 158)}
        {label(262, 130, "insufficient", "#a8a29e", 9, "400")}
        {box(150, 160, 204, 52, "#1c1917")}
        {label(252, 180, "NIRVA abstains honestly", "#e7e5e4", 10.5)}
        {label(252, 196, "says so, cites the gap", "#78716c", 9, "400")}

        {/* approval gate note */}
        {arrow(772, 68, 772, 158)}
        {label(782, 130, "consequential?", "#a8a29e", 9, "400")}
        {box(660, 160, 224, 52, "#1c1917")}
        {label(772, 180, "Supervisor approval gate", "#fbbf24", 10.5, "700")}
        {label(772, 196, "zero actions execute without sign-off", "#78716c", 9, "400")}
      </svg>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const mounted = useMounted();
  const auth = useStoredAuth();
  const authed = mounted && auth !== null;

  return (
    <div className="min-h-screen bg-[#1a1917] text-stone-300 font-sans">
      {/* ── Navbar ── */}
      <nav className="w-full border-b border-stone-800/60 bg-[#1a1917]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <NirvaLogo className="size-6" />
            <span className="text-white font-bold text-base tracking-tight">NIRVA</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-stone-400">
            <a href="#overview" className="hover:text-white transition">Overview</a>
            <a href="#how-it-works" className="hover:text-white transition">How it works</a>
            <a href="#roles" className="hover:text-white transition">Roles</a>
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#demo" className="hover:text-white transition">Demo</a>
          </div>
          <div className="hidden lg:flex items-center gap-3 text-xs text-stone-500">
            <span>SIH 2026</span>
            <span>•</span>
            <span>PSC26117</span>
            <span>•</span>
            <span>MRPL</span>
          </div>
          <Link
            href={authed ? "/investigations" : "/login"}
            className="flex items-center gap-2 rounded-lg bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-white transition"
          >
            {authed ? "Open workbench" : "Sign in"}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <main id="overview" className="w-full px-8 lg:px-16 pt-14 pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Left column */}
          <div className="flex flex-col space-y-5">
            <div className="flex items-center gap-3">
              <NirvaLogo className="size-9" />
              <span className="text-white font-bold text-3xl tracking-tight">NIRVA</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-[2.75rem] font-bold leading-[1.08] tracking-tight">
                <span className="text-white">The offline industrial </span>
                <span className="text-stone-500">investigation </span>
                <span className="text-[#c8f135]">workbench.</span>
              </h1>
              <div className="w-14 h-1 rounded-full" style={{ backgroundColor: LIME }} />
            </div>

            <p className="text-[0.9375rem] leading-[1.7] text-stone-400 max-w-[500px]">
              Submit a plain-language question about any equipment failure. NIRVA plans the
              investigation, retrieves only what your role is cleared to read, surfaces contradictions,
              and drafts a cited recommendation — pausing for a supervisor&apos;s sign-off before any
              action executes.
            </p>

            <div className="grid grid-cols-4 gap-2.5">
              {[
                { icon: FileSearch,     label: "Engineer",       sub: "investigates" },
                { icon: ClipboardCheck, label: "Supervisor",     sub: "approves" },
                { icon: UserShield,     label: "Safety Officer", sub: "audits" },
                { icon: UserCog,        label: "Admin",          sub: "manages" },
              ].map((r) => (
                <div
                  key={r.label}
                  className="flex flex-col gap-2 rounded-xl border border-stone-700/70 bg-stone-900/50 px-4 py-4 hover:border-stone-600 transition"
                >
                  <r.icon className="size-5 text-stone-400" />
                  <div>
                    <p className="text-sm font-semibold text-stone-100 leading-none">{r.label}</p>
                    <p className="mt-1 text-xs text-stone-500">{r.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={authed ? "/investigations" : "/login"}
                className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-stone-950 shadow-lg transition hover:brightness-110"
                style={{ backgroundColor: LIME }}
              >
                {authed ? "Open workbench" : "Try the demo"}
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#how-it-works"
                className="flex items-center gap-2 rounded-xl border border-stone-600 bg-stone-900/40 px-6 py-3 text-sm font-semibold text-stone-300 hover:border-stone-500 hover:text-white transition"
              >
                How it works
              </a>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-1 border-t border-stone-800 mt-1">
              {[
                "Zero cloud calls — verified with network disconnected",
                "ACL enforced inside retrieval — never retrieve-then-filter",
                "Every answer cites its source passage or is labeled an assumption",
                "No consequential action executes without supervisor sign-off",
              ].map((t) => (
                <div key={t} className="flex items-start gap-2 pt-3">
                  <CheckCircle2 className="size-4 shrink-0 mt-[2px]" style={{ color: LIME }} />
                  <span className="text-sm leading-[1.55] text-stone-400">{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-2 w-full">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600">
              Live investigation preview — Pump P-204
            </p>
            <InvestigationTerminal />
          </div>
        </div>

        {/* Trust strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-14 rounded-xl border border-stone-700/60 bg-stone-900/40 p-4">
          {[
            { icon: Shield,       title: "Private & Local",    sub: "Your data stays with you" },
            { icon: KeyRound,     title: "Role-based Access",  sub: "Least privilege by design" },
            { icon: Link2,        title: "Audit Ready",        sub: "Traceable & compliant" },
            { icon: TriangleAlert, title: "Made for India",    sub: "Offline-first by default" },
          ].map((s) => (
            <div key={s.title} className="flex items-center gap-3 rounded-lg border border-stone-800 bg-stone-900/60 px-4 py-3.5">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-stone-700 bg-stone-900">
                <s.icon className="size-4" style={{ color: LIME }} />
              </span>
              <div>
                <p className="text-sm font-semibold text-stone-100 leading-none">{s.title}</p>
                <p className="mt-1 text-xs text-stone-500">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ── How it works — journey flowchart ── */}
      <div id="how-it-works" className="border-t border-stone-800/60 py-24">
        <div className="max-w-7xl mx-auto px-8">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-3">The journey</p>
            <h2 className="text-3xl font-bold text-white">From question to signed-off action</h2>
            <p className="mt-4 max-w-xl mx-auto text-stone-400 text-sm">
              Every path is visible. Conflicts are surfaced, never buried. Thin evidence means NIRVA
              abstains honestly instead of guessing.
            </p>
          </div>
          <JourneyFlowchart />
          <p className="mt-4 text-center text-xs text-stone-600">
            Retrieved content is evidence, not instructions — and zero consequential actions run without a supervisor.
          </p>
        </div>
      </div>

      {/* ── Features ── */}
      <div id="features" className="border-t border-stone-800/60 py-24">
        <div className="max-w-7xl mx-auto px-8">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-3">Core capabilities</p>
            <h2 className="text-3xl font-bold text-white">Built for the refinery floor</h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Quote,       title: "Grounded citations",         desc: "Every claim links to an exact source passage — title, revision, page. Uncited claims are labeled assumptions." },
              { icon: ShieldCheck, title: "Human approval gate",        desc: "Consequential actions wait at an interrupt. A supervisor must explicitly approve before anything executes." },
              { icon: GitCompare,  title: "Contradiction surfacing",    desc: "Conflicting records are detected and shown side-by-side. NIRVA surfaces the conflict and lets the engineer decide." },
              { icon: Lock,        title: "Air-gapped sovereignty",     desc: "Zero cloud calls. Every model inference, embedding, and log stays on-premise." },
              { icon: Link2,       title: "Tamper-evident audit trail", desc: "Every node, tool call, and approval decision is recorded in a hash-chained log." },
              { icon: KeyRound,    title: "Role-based access control",  desc: "Four roles with default-deny permissions. ACL filtering happens inside the retrieval query." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-stone-700/60 bg-stone-900/40 p-6 hover:border-stone-600 transition">
                <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg border border-stone-700 bg-stone-900 text-stone-400">
                  <f.icon className="size-5" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-xs leading-relaxed text-stone-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Roles ── */}
      <div id="roles" className="border-t border-stone-800/60 py-24">
        <div className="max-w-7xl mx-auto px-8">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-3">Access control</p>
            <h2 className="text-3xl font-bold text-white">Four roles, least privilege</h2>
            <p className="mt-4 max-w-xl mx-auto text-stone-400 text-sm">
              Every permission is default-deny. Roles enforced server-side and inside the retrieval layer.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: FileSearch,     role: "Engineer",       tag: "Investigates", desc: "Submits investigations, uploads documents, and gets cited evidence for repair decisions." },
              { icon: ClipboardCheck, role: "Supervisor",     tag: "Approves",     desc: "The only role that can approve consequential actions. Reviews recommendations before signing off." },
              { icon: UserShield,     role: "Safety Officer", tag: "Audits",       desc: "Reads the full tamper-evident audit trail and reviews hash-chain validity." },
              { icon: UserCog,        role: "Admin",          tag: "Manages",      desc: "Publishes documents, sets access control lists, and manages the local model registry." },
            ].map((r) => (
              <div key={r.role} className="rounded-xl border border-stone-700/60 bg-stone-900/40 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <r.icon className="size-5 text-stone-400" />
                  <span className="rounded-full border border-stone-700 bg-stone-800 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                    {r.tag}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">{r.role}</h3>
                <p className="text-xs leading-relaxed text-stone-500">{r.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-xl border border-stone-700/60 bg-stone-900/40 px-6 py-4">
            <p className="text-xs text-stone-500">
              <span className="font-semibold text-stone-300">Demo accounts</span> — usernames:{" "}
              {["engineer", "safety_officer", "supervisor", "admin"].map((u, i, arr) => (
                <span key={u}>
                  <code className="rounded bg-stone-800 px-1.5 py-0.5 text-[11px] text-stone-300">{u}</code>
                  {i < arr.length - 1 ? " · " : ""}
                </span>
              ))}{" "}
              · password:{" "}
              <code className="rounded bg-stone-800 px-1.5 py-0.5 text-[11px] text-stone-300">nirva-demo-pass</code>
            </p>
          </div>
        </div>
      </div>

      {/* ── Band + metrics ── */}
      <div className="border-t border-stone-800/60 py-24">
        <div className="max-w-7xl mx-auto px-8">
          <div className="rounded-2xl border border-stone-700/60 bg-stone-900/40 px-8 py-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-3">The difference</p>
            <h2 className="text-3xl font-bold text-white">Runs inside your walls</h2>
            <p className="mt-3 text-sm font-medium" style={{ color: LIME }}>
              From evidence to action — inside your walls.
            </p>
            <p className="mt-4 max-w-xl mx-auto text-stone-400 text-sm">
              No cloud LLM. No data egress. No telemetry leaving the building. The entire pipeline —
              model, vectors, tools, audit — lives on your hardware and keeps working with the
              internet disconnected.
            </p>
          </div>
          <div className="mt-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-6">The numbers that matter</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { n: "100%", label: "cloud calls eliminated" },
                { n: "0",    label: "unauthorized chunks retrieved" },
                { n: "0",    label: "approval bypasses recorded" },
                { n: "5/5",  label: "golden runs, supervisor-approved" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-stone-700/60 bg-stone-900/40 px-4 py-6">
                  <p className="text-3xl font-bold text-white">{s.n}</p>
                  <p className="mt-2 text-xs text-stone-500">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div id="demo" className="border-t border-stone-800/60 py-24">
        <div className="max-w-2xl mx-auto px-8 text-center">
          <NirvaLogo className="size-10 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white">Ready to investigate?</h2>
          <p className="mt-4 text-stone-400 text-sm">
            Sign in with any demo account and run the golden scenario — investigate Pump P-204
            from question to a cited, supervisor-approved work-order recommendation.
          </p>
          <div className="mt-8">
            <Link
              href={authed ? "/investigations" : "/login"}
              className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-stone-950 shadow-lg transition hover:brightness-110"
              style={{ backgroundColor: LIME }}
            >
              {authed ? "Open workbench" : "Start demo"}
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <p className="mt-6 text-xs text-stone-700">All demo data is synthetic · No real MRPL data · SIH26117</p>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-stone-800/60">
        <div className="max-w-7xl mx-auto px-8 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <NirvaLogo className="size-5" />
            <div>
              <p className="text-xs font-bold text-white">NIRVA</p>
              <p className="text-[10px] text-stone-600">Offline industrial investigation workbench</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-stone-600">
            <span>NIRVA — SIH26117 · All demo data is synthetic</span>
            <span>·</span>
            <span>PSC26117 · MRPL</span>
          </div>
          <Link href="/login" className="text-xs text-stone-500 underline underline-offset-2 hover:text-white">
            Sign in →
          </Link>
        </div>
      </footer>
    </div>
  );
}
