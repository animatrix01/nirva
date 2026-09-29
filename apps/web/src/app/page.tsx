"use client";

/**
 * NIRVA Landing Page — Visual Product Experience
 * 
 * Full-bleed hero with terminal
 * Comparison cards for differentiation
 * Visual workflow with icons
 * Sovereign deployment showcase
 * Simplified roles
 * Less text, more visual hierarchy
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Lock,
  ShieldCheck,
  TriangleAlert,
  User,
  Zap,
} from "lucide-react";
import { Fragment, useSyncExternalStore, useEffect, useState } from "react";
import { useStoredAuth } from "@/lib/auth-client";
import { ApiError, login, storeAuth } from "@/lib/api";

const LIME = "#B9FF52";

// ─── Hydration ────────────────────────────────────────────────────────────────

const subscribeNoop = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

// ─── NIRVA Logo ───────────────────────────────────────────────────────────────

function NirvaLogo({ className = "size-8" }: { className?: string }) {
  return (
    <img
      src="/nirva_logo_-removebg-preview.png"
      alt="NIRVA"
      className={`object-contain ${className}`}
    />
  );
}

// ─── LOGIN MODAL ──────────────────────────────────────────────────────────────

const DEMO_ACCOUNTS = [
  { username: "engineer",       role: "engineer",       line: "investigate & upload" },
  { username: "safety_officer", role: "safety_officer", line: "audit everything" },
  { username: "supervisor",     role: "supervisor",     line: "the only approval authority" },
  { username: "admin",          role: "admin",          line: "manage docs & models" },
];

function LoginModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await login(username.trim(), password);
      storeAuth({ token: res.access_token, user: res.user });
      router.push("/workbench");
    } catch (err) {
      setError(err instanceof ApiError ? err.body.detail : "Login failed. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      role="dialog" aria-modal="true" aria-label="Sign in"
    >
      <div
        className="absolute inset-0 cursor-pointer"
        style={{ backdropFilter: "blur(8px)", background: "rgba(15,23,42,0.35)" }}
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-[480px] rounded-2xl border border-slate-200 bg-white p-10 shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex size-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="mb-8 flex flex-col items-center gap-4">
          <NirvaLogo className="size-20" />
          <h1 className="text-2xl font-bold tracking-wider text-slate-900">NIRVA</h1>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="modal-username" className="text-xs font-medium uppercase tracking-wider text-slate-600">Username</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 size-4 -translate-y-1/2" style={{ color: LIME }} />
              <input id="modal-username" type="text"
                name="modal-username-field"
                autoComplete="off"
                value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Enter username" required
                className="w-full rounded-lg border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-300 focus:text-slate-900 transition-colors"
                style={{ WebkitTextFillColor: "inherit", WebkitBoxShadow: "0 0 0 1000px white inset", caretColor: LIME }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="modal-password" className="text-xs font-medium uppercase tracking-wider text-slate-600">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2" style={{ color: LIME }} />
              <input id="modal-password" type="password"
                name="modal-password-field"
                autoComplete="new-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter password" required
                className="w-full rounded-lg border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-300 focus:text-slate-900 transition-colors"
                style={{ WebkitTextFillColor: "inherit", WebkitBoxShadow: "0 0 0 1000px white inset", caretColor: LIME }}
              />
            </div>
          </div>
          {error && (
            <div className="rounded-lg border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-400">{error}</div>
          )}
          <button type="submit" disabled={submitting}
            className="mt-2 w-full rounded-lg py-3.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: LIME }}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-8 border-t border-slate-200 pt-6">
          <p className="mb-4 text-center text-xs uppercase tracking-widest text-slate-500">Demo accounts</p>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.username}
                type="button"
                onClick={() => { setUsername(a.username); setPassword("nirva-demo-pass"); }}
                className={`rounded-lg border px-3 py-2.5 text-left transition hover:border-slate-300 ${
                  username === a.username ? "border-[#B9FF52]/50 bg-[#B9FF52]/10" : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-xs font-semibold text-slate-800">{a.role}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{a.line}</p>
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-slate-500">
            password: <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">nirva-demo-pass</code>
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVESTIGATION TERMINAL — Hero right column
// ═══════════════════════════════════════════════════════════════════════════════

function InvestigationTerminal() {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500/70" />
          <span className="size-2.5 rounded-full bg-yellow-500/70" />
          <span className="size-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <span className="font-mono text-[11px] text-stone-500">NIRVA Investigation Engine</span>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
          Demo
        </span>
      </div>

      <div className="space-y-4 p-5 bg-white">
        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-widest text-slate-500">Investigation objective</p>
          <p className="text-sm leading-relaxed text-slate-800">
            &ldquo;Investigate why <span className="font-semibold text-slate-900">Pump P-204</span> has failed repeatedly.
            Cross-reference maintenance history, OEM manual, and safety SOP.&rdquo;
          </p>
        </div>

        <div>
          <p className="mb-2 text-[11px] uppercase tracking-widest text-slate-500">Investigation plan</p>
          <div className="space-y-1.5">
            {[
              { done: true,  active: false, label: "Read maintenance history",         sub: "7 work orders · 18 months" },
              { done: true,  active: false, label: "Cross-reference OEM manual rev C", sub: "Bearing spec mismatch — p.41" },
              { done: false, active: true,  label: "Check spare-part inventory…",      sub: "Querying local inventory" },
              { done: false, active: false, label: "Compare safety SOP rev 4",         sub: "" },
              { done: false, active: false, label: "Compose cited recommendation",     sub: "" },
            ].map((s, i) => (
              <div key={i} className={`flex items-start gap-3 rounded px-3 py-2 ${s.active ? "border border-slate-200 bg-slate-50" : ""}`}>
                {s.done ? (
                  <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                ) : s.active ? (
                  <span className="mt-0.5 inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-stone-600 border-t-stone-300" />
                ) : (
                  <span className="mt-0.5 inline-block size-4 shrink-0 rounded-full border border-stone-700" />
                )}
                <div>
                  <span className={`text-[13px] ${s.done ? "text-slate-500" : s.active ? "font-medium text-slate-800" : "text-slate-400"}`}>
                    {s.label}
                    {s.done && <span className="ml-2 text-[11px] text-emerald-600">✓</span>}
                  </span>
                  {s.sub && <p className="mt-0.5 text-[11px] text-stone-600">{s.sub}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-3 rounded border border-orange-200 bg-orange-50 px-3 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-orange-500" />
          <div>
            <p className="text-[13px] font-semibold text-orange-700">NIRVA caught a conflict — needs human judgment</p>
            <p className="mt-0.5 text-xs leading-relaxed text-orange-600">
              OEM manual rev C (p.41): 4.2 kN — Work Order WO-88712: 5.8 kN
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] uppercase tracking-widest text-slate-500">Evidence citations</p>
          <div className="flex flex-wrap gap-1.5">
            {["OEM Manual, rev C, p.41", "SOP-MRPL-004, rev 4, §3.2", "WO-88712, rev 2", "Incident IR-2024-031"].map((c) => (
              <a key={c} href="#how-it-works" className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700 transition hover:border-slate-300 hover:text-slate-900">{c}</a>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] uppercase tracking-widest text-slate-500">Confidence</p>
            <p className="mt-1 text-xl font-bold text-slate-900">87%</p>
            <div className="mt-2 h-1 rounded-full bg-slate-200">
              <div className="h-1 w-[87%] rounded-full bg-emerald-600" />
            </div>
            <p className="mt-1 text-[10px] text-slate-500">live demo data</p>
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 p-3">
            <p className="text-[11px] uppercase tracking-widest text-amber-700">Status</p>
            <p className="mt-1 text-xs font-semibold text-amber-700">Paused for sign-off</p>
            <p className="mt-1 text-[11px] text-amber-600">No action without approval</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FAQ Data ────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "What is NIRVA?",
    a: "NIRVA is an offline industrial investigation workbench. It helps engineers and supervisors investigate equipment failures by retrieving evidence from plant documents, cross-checking information, and producing traceable, cited recommendations — all without sending data to the cloud.",
  },
  {
    q: "How does NIRVA help with equipment failures?",
    a: "NIRVA takes a plain-language question (like 'Why did Pump P-204 fail?'), searches your plant knowledge base (manuals, work orders, SOPs), identifies relevant evidence, detects contradictions between sources, and drafts a cited recommendation for human review.",
  },
  {
    q: "Can NIRVA operate without internet or cloud access?",
    a: "Yes. NIRVA runs entirely on-premise. All retrieval, reasoning, and vision analysis happen on local infrastructure. No external service call required. Air-gapped deployment is fully supported.",
  },
  {
    q: "What plant knowledge can NIRVA process?",
    a: "Manuals, SOPs, P&IDs, work orders, incident reports, equipment photos, and operational data logs (CSV). The local vision model processes images directly on your hardware.",
  },
  {
    q: "How does NIRVA differ from a chatbot?",
    a: "Chatbots generate answers. NIRVA investigates evidence. It abstains when evidence is thin, surfaces contradictions explicitly, cites every claim with source document and page, and requires supervisor approval before any action executes.",
  },
  {
    q: "How are AI findings verified?",
    a: "Every claim links to its source: document title, revision, section, page. Engineers can inspect the exact retrieved text. If evidence is insufficient, NIRVA abstains explicitly rather than guessing.",
  },
];

// Each FAQ item needs its own component so useState isn't called inside .map()
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="group flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-base font-semibold text-slate-800 group-hover:text-slate-900">{q}</span>
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white">
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none"
            className="transition-transform duration-200"
            style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
          >
            <line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? "300px" : "0" }}
      >
        <p className="pb-6 text-base leading-relaxed text-slate-600">{a}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// HERO SOURCE GLYPHS
// Presentation-only marks for the five plant source types NIRVA reads. They
// carry no state, are hidden from assistive tech, and are purely decorative —
// the adjacent label carries the meaning.
// ═══════════════════════════════════════════════════════════════════════════════

const SOURCE_TYPES = [
  {
    label: "Manuals",
    glyph: (
      <>
        <path d="M9.5 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5z" />
        <path d="M9.5 1.5V5H13" />
        <path d="M6 8.5h4M6 11h3" />
      </>
    ),
  },
  {
    label: "Logs",
    glyph: (
      <>
        <ellipse cx="8" cy="3.6" rx="5.4" ry="2.1" />
        <path d="M2.6 3.6v8.8c0 1.2 2.4 2.1 5.4 2.1s5.4-.9 5.4-2.1V3.6" />
        <path d="M2.6 8c0 1.2 2.4 2.1 5.4 2.1s5.4-.9 5.4-2.1" />
      </>
    ),
  },
  {
    label: "Drawings",
    glyph: (
      <>
        <rect x="1.8" y="1.8" width="8.6" height="10.4" rx="1.2" />
        <path d="M5.2 4.4H13.4a1 1 0 0 1 1 1v7.4a1 1 0 0 1-1 1H5.2" />
        <path d="M4 7.4h3.6M4 9.8h2.4" />
      </>
    ),
  },
  {
    label: "Images",
    glyph: (
      <>
        <rect x="1.8" y="2.8" width="12.4" height="10.4" rx="1.2" />
        <circle cx="5.6" cy="6" r="1.1" />
        <path d="M2.3 11.6l3.5-3.1 2.4 2.1 2.2-1.9 3.3 2.9" />
      </>
    ),
  },
  {
    label: "Work orders",
    glyph: (
      <>
        <path d="M6 2.4H4.4A1.4 1.4 0 0 0 3 3.8v9a1.4 1.4 0 0 0 1.4 1.4h7.2A1.4 1.4 0 0 0 13 12.8v-9a1.4 1.4 0 0 0-1.4-1.4H10" />
        <rect x="6" y="1.2" width="4" height="2.4" rx="1" />
        <path d="M6.2 8.4l1.4 1.4 2.4-2.6" />
      </>
    ),
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Differentiation comparison rows.
 *
 * Copy is ported verbatim from the approved mockup
 * (Z:\MYPROJECTS\nirva-hero-v1.html) — do not reword.
 * `ai` is what a general AI assistant does; `nirva` / `nirvaSub` is
 * what NIRVA does instead, and is the only column rendered with emphasis.
 */
const DIFF_ROWS = [
  {
    n: "01",
    title: "Insufficient evidence",
    cond: "Plant record or required specification is missing.",
    ai: "Can provide a plausible conversational answer from available context.",
    nirva: "Abstains and identifies the missing evidence.",
    nirvaSub: "Makes the gap explicit instead of filling it.",
  },
  {
    n: "02",
    title: "Conflicting records",
    cond: "Two plant sources contain different values.",
    ai: "May synthesize one answer when sources disagree.",
    nirva: "Surfaces both sources side-by-side and highlights the discrepancy.",
    nirvaSub: "Keeps all versions visible for review.",
  },
  {
    n: "03",
    title: "Producing a finding",
    cond: "An engineer needs a conclusion they can defend.",
    ai: "Produces a generated conclusion unless explicitly constrained by an investigation workflow.",
    nirva: "Links the finding to source passage, page, and revision.",
    nirvaSub: "Every claim is traceable to its source document.",
  },
  {
    n: "04",
    title: "Consequential action",
    cond: "A recommendation could trigger real-world work.",
    ai: "Can suggest an action, but this is not the same as NIRVA’s built-in approval gate.",
    nirva: "Drafts the recommendation and pauses for authorized supervisor approval.",
    nirvaSub: "No consequential action without review.",
  },
] as const;

/**
 * Human Control role views.
 *
 * Copy is ported verbatim from the approved mockup
 * (Z:\MYPROJECTS\nirva-hero-v1.html) — do not reword.
 *
 * This section previously rendered clickable cards carrying a per-role RBAC
 * `constraint` string. The reference design is static and has no slot for that
 * text, so the constraints were removed deliberately. The same RBAC rules are
 * still enforced at the retrieval layer and remain visible in the app itself.
 */
const HC_ROLES = [
  {
    n: "01",
    label: "Engineer",
    desc: "Raises the failure in plain language and uploads supporting evidence.",
    tag: "Investigates",
    dot: "#4D7C0F",
  },
  {
    n: "02",
    label: "Supervisor",
    desc: "Reviews cited findings and is the only role that can authorize consequential action.",
    tag: "Approves",
    dot: "#16A34A",
  },
  {
    n: "03",
    label: "Safety Officer",
    desc: "Reviews the investigation and audit trail, including evidence gaps and restricted-access events.",
    tag: "Audits",
    dot: "#2563EB",
  },
  {
    n: "04",
    label: "Admin",
    desc: "Manages the document library, access controls and local model registry.",
    tag: "Manages",
    dot: "#D97706",
  },
] as const;

const HC_PRINCIPLES = [
  "One investigation, four controlled views",
  "Least privilege by default",
  "One approval authority",
  "Every consequential action is auditable",
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function LandingPage() {
  const mounted  = useMounted();
  const auth     = useStoredAuth();
  const authed   = mounted && auth !== null;
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    document.body.style.overflow = showLogin ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showLogin]);

  return (
    <div className="min-h-screen bg-white text-slate-700">

      {showLogin && !authed && <LoginModal onClose={() => setShowLogin(false)} />}

      {/* ── NAVBAR ── */}
      <nav className="w-full border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-50">
        <div className="w-full px-8 lg:pl-[120px] lg:pr-16 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <NirvaLogo className="size-14" />
            <span className="font-bold text-3xl tracking-tight text-slate-900">NIRVA</span>
          </Link>
          <div className="flex items-center gap-8">
            <div className="hidden md:flex items-center gap-8 text-sm text-slate-500">
              <a href="#overview" className="hover:text-slate-900 transition">Overview</a>
              <a href="#how-it-works" className="hover:text-slate-900 transition">How it works</a>
              <a href="#roles" className="hover:text-slate-900 transition">Roles</a>
              <a href="#faq" className="hover:text-slate-900 transition">FAQ</a>
              <a href="#demo" className="hover:text-slate-900 transition">Demo</a>
            </div>
            <Link
              href={authed ? "/workbench" : "#"}
              onClick={!authed ? (e) => { e.preventDefault(); setShowLogin(true); } : undefined}
              className="flex items-center gap-2 rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              {authed ? "Open workbench" : "Sign in"}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <main id="overview" className="w-full px-8 lg:px-16 pt-4 pb-14"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.07) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[700px_1fr] gap-32 items-start">
          {/* Left column — layout ported from Z:\MYPROJECTS\nirva-hero-v1.html.
              The indent is pl-9 on THIS column only, so the grid container and
              the terminal keep their existing geometry. */}
          <div className="flex flex-col pt-12 pl-14">
            {/* Headline */}
            <h1 className="max-w-[14ch] text-[56px] font-bold leading-[1.06] tracking-[-0.032em] text-slate-900">
              The offline industrial investigation{" "}
              <span style={{ color: LIME }}>workbench.</span>
            </h1>
            <div className="mt-6 mb-[22px] h-1 w-12 rounded-[2px]" style={{ backgroundColor: LIME }} />

            {/* Description */}
            <p className="max-w-[560px] text-[15.5px] leading-[1.68] text-slate-600">
              Ask about any equipment failure in plain language. NIRVA checks OEM manuals, SOPs,
              maintenance history, drawings and work orders, flags conflicts between sources, and
              drafts a cited recommendation — paused for supervisor sign-off with a full audit trail.
            </p>

            {/* Proof row — product principles, not feature cards. Hairline
                dividers only; the middle column has no left rule. */}
            <dl className="mt-8 grid max-w-[600px] grid-cols-3">
              {[
                { k: "On-premise",       v: "Your data stays inside" },
                { k: "Source-traceable", v: "Every claim linked" },
                { k: "Human-approved",   v: "Actions under control" },
              ].map((p) => (
                <div key={p.k} className="px-5 first:pl-0 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-slate-200">
                  <dt className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-slate-900">{p.k}</dt>
                  <dd className="mt-1 text-[12.5px] text-slate-600">{p.v}</dd>
                </div>
              ))}
            </dl>

            {/* CTA — one primary action, one secondary path. */}
            <div className="mt-[30px] flex items-center gap-5">
              <Link
                href={authed ? "/workbench" : "#"}
                onClick={!authed ? (e) => { e.preventDefault(); setShowLogin(true); } : undefined}
                className="inline-flex items-center gap-[11px] rounded-xl px-[26px] py-3 text-[15px] font-semibold text-stone-950 transition hover:brightness-105"
                style={{ backgroundColor: LIME, boxShadow: "0 2px 6px rgba(15,23,42,0.10)" }}
              >
                {authed ? "Open workbench" : "Try the demo"}
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-[26px] py-3 text-[15px] font-semibold text-slate-800 transition hover:border-slate-300"
                style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}
              >
                How it works
              </a>
            </div>

            {/* Source row — editorial listing, not a diagram. No arrows, no
                connectors; the sibling rule supplies the dividers. */}
            <div className="mt-11 max-w-[644px] border-t border-slate-200 pt-[26px]">
              <p className="text-[12.5px] font-bold uppercase tracking-[0.16em] text-slate-600">
                One question. Multiple plant sources. One traceable investigation.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-y-3 [&>*+*]:ml-5 [&>*+*]:border-l [&>*+*]:border-slate-200 [&>*+*]:pl-5">
                {SOURCE_TYPES.map((s) => (
                  <div key={s.label} className="flex items-center gap-2.5 text-[15px] text-slate-900">
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-[19px] shrink-0 text-slate-400"
                      aria-hidden="true"
                    >
                      {s.glyph}
                    </svg>
                    {s.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Right column */}
          <div className="flex flex-col gap-2 w-full pt-14">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-800">
              Live investigation — Pump P-204 · golden demo
            </p>
            <InvestigationTerminal />
          </div>
        </div>
      </main>

      {/* ══════════════════════════════════════════════════════════════════════
          DIFFERENTIATION — Industrial situation vs general AI assistants vs NIRVA
          Hairline editorial matrix. No background grid, no tinted column, no
          cards. Emphasis on the NIRVA column comes from lime marks and text
          contrast only. The hairline top keeps a seam against the white
          Sovereignty section below.
          ══════════════════════════════════════════════════════════════════════ */}
      <section
        id="how-it-works"
        className="w-full border-t border-slate-200 bg-[#FBFCFD] py-[96px] pl-[100px] pr-[64px] pb-[88px]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >
        <div className="mx-auto w-full max-w-[1560px]">

          {/* Header */}
          <div className="mb-14 text-center">
            <p className="text-base font-bold uppercase tracking-[0.2em] text-slate-800">
              Differentiation
            </p>
            <h2 className="mt-[18px] text-[50px] font-bold leading-[1.05] tracking-[-0.03em] text-slate-900">
              Same plant evidence.{" "}
              <br />
              A <span style={{ color: LIME }}>different kind</span>{" "}
              of answer.
            </h2>
            <p className="mx-auto mt-[18px] max-w-[780px] text-[16px] leading-[1.6] text-slate-500">
              When records conflict or evidence is missing, NIRVA makes the uncertainty visible
              instead of guessing.
            </p>
          </div>

          <div className="grid border-t border-l border-slate-200 lg:grid-cols-[33fr_31fr_36fr]">

            {/* ── column headers ── */}
            <div className="hidden border-r border-b border-slate-200 px-4 py-3 lg:block">
              <div className="flex items-center gap-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0" aria-hidden="true">
                  <path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5z" />
                  <path d="M14 3v4.5h4.5" />
                  <path d="M8.75 12.5h6.5M8.75 16h4" />
                </svg>
                <span className="text-[13px] font-semibold uppercase tracking-[0.1em] text-slate-900">
                  Industrial situation
                </span>
              </div>
            </div>

            <div className="hidden border-r border-b border-slate-200 px-4 py-3 lg:block">
              <div className="flex items-center gap-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0" aria-hidden="true">
                  <path d="M12 3l1.7 4.6L18.3 9.3 13.7 11 12 15.6 10.3 11 5.7 9.3l4.6-1.7z" />
                  <path d="M18 15.6l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" />
                </svg>
                <span>
                  <span className="block text-[13px] font-semibold uppercase tracking-[0.1em] text-slate-900">
                    General AI assistants
                  </span>
                  <span className="mt-0.5 block text-[12px] text-slate-500">
                    ChatGPT &middot; Claude &middot; Copilot
                  </span>
                </span>
              </div>
            </div>

            <div className="hidden border-r border-b border-slate-200 px-4 py-3 lg:block">
              <div className="flex items-center gap-3">
                <img
                  src="/nirva_logo_-removebg-preview.png"
                  alt="NIRVA"
                  className="size-8 shrink-0 object-contain"
                />
                <span>
                  <span className="block text-[13px] font-semibold uppercase tracking-[0.1em] text-slate-900">
                    NIRVA
                  </span>
                  <span className="mt-0.5 block text-[12px] text-slate-500">
                    Evidence-grounded investigation
                  </span>
                </span>
              </div>
            </div>

            {/* ── rows ── */}
            {DIFF_ROWS.map((r) => (
              <Fragment key={r.n}>
                {/* industrial situation */}
                <div className="border-r border-b border-slate-200 px-[26px] py-[28px]">
                  <div className="flex items-start gap-[18px]">
                    <span className="w-[32px] shrink-0 text-[18px] font-semibold leading-[1.4] text-[#A8B3BF]">
                      {r.n}
                    </span>
                    <span>
                      <span className="block text-[15px] font-semibold leading-[1.4] text-slate-900">
                        {r.title}
                      </span>
                      <span className="mt-1 block text-[13px] leading-[1.5] text-slate-500">
                        {r.cond}
                      </span>
                    </span>
                  </div>
                </div>

                {/* general AI assistants */}
                <div className="border-r border-b border-slate-200 px-[26px] py-[28px]">
                  <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400 lg:hidden">
                    General AI assistants
                  </p>
                  <p className="text-[15px] leading-[1.55] text-slate-500">{r.ai}</p>
                </div>

                {/* NIRVA */}
                <div className="border-r border-b border-slate-200 px-[26px] py-[28px]">
                  <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400 lg:hidden">
                    NIRVA
                  </p>
                  <div className="flex items-start gap-3">
                    <svg viewBox="0 0 24 24" fill="none" className="mt-px size-[22px] shrink-0" aria-hidden="true">
                      <circle cx="12" cy="12" r="10.4" stroke={LIME} strokeWidth="1.6" />
                      <path d="M7.9 12.3l2.9 2.9 5.3-6" stroke={LIME} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>
                      <span className="block text-[15px] font-semibold leading-[1.4] text-slate-900">
                        {r.nirva}
                      </span>
                      <span className="mt-1 block text-[13px] leading-[1.5] text-slate-500">
                        {r.nirvaSub}
                      </span>
                    </span>
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SOVEREIGN / OFFLINE — Full-bleed, visual treatment
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="w-full bg-white px-8 py-20 lg:px-16 lg:py-24"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >
        <div className="mx-auto w-full max-w-[1600px]">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Sovereign by Design</p>
              <h2 className="mb-6 text-3xl font-bold text-slate-900 lg:text-4xl">
                Plant data stays <span style={{ color: LIME }}>inside the facility</span>
              </h2>
              <p className="mb-8 text-base leading-relaxed text-slate-600">
                NIRVA runs entirely on-premise. All models, retrieval, and indexing happen locally.
                No cloud dependency. Air-gapped deployment supported.
              </p>
              <div className="flex flex-col gap-4">
                {[
                  { icon: Lock, label: "On-premise deployment", desc: "Runs entirely within your infrastructure. No outbound calls." },
                  { icon: Zap, label: "Local AI models", desc: "All inference happens on-device. Data never leaves the facility." },
                  { icon: ShieldCheck, label: "Air-gapped capable", desc: "Fully operational without internet. Supports isolated plant networks." },
                ].map((f) => (
                  <div key={f.label} className="flex items-start gap-4">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
                      <f.icon className="size-5 text-slate-700" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{f.label}</p>
                      <p className="mt-1 text-sm text-slate-500">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              {/* Dark header bar */}
              <div className="bg-slate-900 px-6 py-5 flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-white">Network Status</p>
                  <p className="mt-0.5 text-xs text-slate-400">All systems local · zero external calls</p>
                </div>
                <span className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Operational
                </span>
              </div>
              {/* White content */}
              <div className="bg-white p-6 space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5">
                  <span className="text-base font-medium text-slate-700">External network</span>
                  <span className="text-base font-bold text-red-600">Disconnected</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5">
                  <span className="text-base font-medium text-slate-700">Local vector store</span>
                  <span className="text-base font-bold text-emerald-600">Active</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5">
                  <span className="text-base font-medium text-slate-700">On-device inference</span>
                  <span className="text-base font-bold text-emerald-600">Running</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5">
                  <span className="text-base font-medium text-slate-700">Investigation engine</span>
                  <span className="text-base font-bold text-emerald-600">Operational</span>
                </div>
                <p className="pt-2 text-sm leading-relaxed text-slate-500">
                  Verified operational with zero external dependencies. All plant knowledge remains on-premise.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          HUMAN CONTROL — four role views on one investigation
          Cool blue-grey band; the first tinted surface on the page. Hairline
          matrix, no card fills, no radius. The tag uses mt-auto so all four sit
          on the same baseline despite differing description lengths.
          ══════════════════════════════════════════════════════════════════════ */}
      <section className="w-full bg-[#E9EEF3] py-[96px] pl-[100px] pr-[64px] pb-[88px]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.10) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >
        <div className="mx-auto w-full max-w-[1560px]">

          <div className="mb-[52px] grid grid-cols-1 gap-[48px] lg:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Human control
              </p>
              <h2 className="mt-4 text-[48px] font-bold leading-[1.1] tracking-[-0.03em] text-slate-900">
                The right view for{" "}
                <br />
                <span style={{ color: LIME }}>every role</span>{" "}
                on the investigation.
              </h2>
            </div>
            <p className="border-l-2 border-[#D3DBE2] pl-6 text-[17px] leading-[1.5] text-slate-600">
              One investigation, four purpose-built responsibilities. Each role sees what it needs,
              and consequential actions remain under authorized approval.
            </p>
          </div>

          <div className="grid grid-cols-1 border-t border-l border-slate-200 lg:grid-cols-4">
            {HC_ROLES.map((r) => (
              <div
                key={r.n}
                className="flex flex-col border-r border-b border-slate-200 px-[26px] pb-7 pt-[30px]"
              >
                <div className="mb-[26px] flex items-center justify-between">
                  <span className="text-[18px] font-semibold text-[#A8B3BF]">{r.n}</span>
                  <span className="block size-2 rounded-full" style={{ background: r.dot }} />
                </div>
                <h3 className="text-[21px] font-bold tracking-[-0.015em] text-slate-900">
                  {r.label}
                </h3>
                <p className="mt-3 text-[16px] leading-[1.45] text-slate-600">{r.desc}</p>
                <span className="mt-auto pt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  {r.tag}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-[30px] grid grid-cols-1 border-t border-slate-200 lg:grid-cols-4">
            {HC_PRINCIPLES.map((p, i) => (
              <div
                key={p}
                className={`flex items-center gap-3 pt-[26px] ${
                  i > 0 ? "lg:border-l lg:border-slate-200 lg:pl-[26px] lg:pr-5" : "pr-5"
                }`}
              >
                <span className="block size-[7px] shrink-0 rounded-full" style={{ background: LIME }} />
                <span className="text-[15px] text-slate-600">{p}</span>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FAQ — Simplified accordion
          ══════════════════════════════════════════════════════════════════════ */}
      <section id="faq" className="w-full bg-white px-8 py-20 lg:px-16 lg:py-24"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">FAQ</p>
            <h2 className="text-3xl font-bold text-slate-900 lg:text-4xl">Common questions</h2>
          </div>

          <div className="divide-y divide-slate-200">
            {FAQ_ITEMS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          CTA — Ready to investigate
          ══════════════════════════════════════════════════════════════════════ */}
      <section id="demo" className="relative w-full overflow-hidden border-t border-slate-200">
        <img
          src="/cta-refinery.jpg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="pointer-events-none absolute inset-0 bg-black/65" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-8 py-24 text-center lg:px-16 lg:py-32">
          <NirvaLogo className="size-12 opacity-80" />
          <h2 className="text-3xl font-bold text-white lg:text-4xl">
            Ready to investigate?
          </h2>
          <p className="text-sm leading-relaxed text-white">
            Sign in with <span className="font-bold text-white">any demo account</span> and run the golden investigation: Pump P-204 from
            equipment-failure question to <span className="font-bold text-white">supervisor-approved work order</span> with <span className="font-bold" style={{ color: LIME }}>full audit trail</span>.
          </p>
          <Link
            href={authed ? "/workbench" : "#"}
            onClick={!authed ? (e) => { e.preventDefault(); setShowLogin(true); } : undefined}
            className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-semibold text-black shadow-lg transition hover:brightness-110"
            style={{ backgroundColor: LIME }}
          >
            {authed ? "Open workbench" : "Start demo"}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FOOTER
          ══════════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-5 px-8 py-8 lg:px-16">
          <div className="flex items-center gap-3">
            <NirvaLogo className="size-10" />
            <div>
              <p className="text-base font-extrabold text-slate-900">NIRVA</p>
              <p className="text-xs font-semibold text-slate-500">Offline industrial investigation workbench</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm font-semibold text-slate-600">
            <span>SIH26117 · PSC26117 · MRPL</span>
            <span>·</span>
            <span>All demo data synthetic</span>
          </div>
          <Link href="/login" className="text-sm font-bold text-slate-700 transition hover:text-slate-900 hover:underline">
            Sign in →
          </Link>
        </div>
      </footer>

    </div>
  );
}
