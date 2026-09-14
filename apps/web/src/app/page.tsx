"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  FileSearch,
  Link2,
  Lock,
  Shield,
  ShieldCheck,
  TriangleAlert,
  User,
  UserCog,
  UserShield,
} from "lucide-react";
import { useSyncExternalStore, useEffect, useState } from "react";
import { useStoredAuth } from "@/lib/auth-client";
import { ApiError, login, storeAuth } from "@/lib/api";

const subscribeNoop = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

const LIME = "#c8f135";

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
          <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-2">+ Investigation Plan — 5 Steps</p>
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
              OEM manual rev C (p.41) specifies bearing load 4.2 kN — Work Order WO-88712 records installation at 5.8 kN. Surfaced side-by-side.
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

// ─── Journey Workflow ─────────────────────────────────────────────────────────
type Accent = "green" | "amber" | "blue" | "orange" | "stone";

function FlowNode({
  icon,
  title,
  sub,
  accent = "stone",
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  accent?: Exclude<Accent, "orange">;
}) {
  const border = {
    green:  "border-emerald-700/40 hover:border-emerald-600/60",
    amber:  "border-amber-700/40   hover:border-amber-600/60",
    blue:   "border-blue-700/40    hover:border-blue-600/60",
    violet: "border-violet-700/40  hover:border-violet-600/60",
    stone:  "border-stone-700/40   hover:border-stone-600/60",
  }[accent];
  const iconClr = {
    green: "text-emerald-400", amber: "text-amber-400",
    blue:  "text-blue-400",    violet: "text-violet-400", stone: "text-stone-400",
  }[accent];
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border bg-stone-900/60 px-3.5 py-3 transition-all duration-300 hover:-translate-y-0.5 ${border}`}>
      <span className={`mt-0.5 shrink-0 ${iconClr}`}>{icon}</span>
      <div>
        <p className="text-[12px] font-semibold text-stone-100 leading-tight">{title}</p>
        <p className="text-[10px] text-stone-500 mt-0.5 leading-tight">{sub}</p>
      </div>
    </div>
  );
}

function ArrR({ accent = "green" }: { accent?: "green" | "stone" }) {
  return (
    <div className="flex items-center self-center shrink-0 w-8">
      <div className={`h-px flex-1 ${accent === "green" ? "bg-emerald-700/50" : "bg-stone-700/30"}`} />
      <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
        <path d="M1 4h6M4 1l3 3-3 3" stroke={accent === "green" ? "#34d399" : "#57534e"} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ArrD({ accent = "stone", dashed = false }: { accent?: Accent; dashed?: boolean }) {
  const clr = { green: "#34d399", amber: "#f59e0b", blue: "#60a5fa", orange: "#fb923c", stone: "#44403c" }[accent];
  return (
    <div className="flex justify-center">
      <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
        <line x1="8" y1="0" x2="8" y2="18" stroke={clr} strokeWidth="1.2" strokeDasharray={dashed ? "3 3" : undefined} />
        <path d="M5 15l3 3.5 3-3.5" stroke={clr} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function FlowBadge({ text, accent }: { text: string; accent: Exclude<Accent, "stone"> }) {
  const clr = { green: "text-emerald-400 border-emerald-800/50", amber: "text-amber-400 border-amber-800/50", blue: "text-blue-400 border-blue-800/50", orange: "text-orange-400 border-orange-800/50" }[accent];
  return <span className={`text-[9px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded border ${clr}`}>{text}</span>;
}

function BranchCard({ accent, icon, title, sub }: { accent: Exclude<Accent, "green" | "violet">; icon: React.ReactNode; title: string; sub: string }) {
  const styles = {
    blue:   { border: "border-blue-800/30",   bg: "bg-blue-950/20",   titleClr: "text-blue-300",   subClr: "text-blue-400/60"   },
    amber:  { border: "border-amber-800/30",  bg: "bg-amber-950/20",  titleClr: "text-amber-300",  subClr: "text-amber-400/60"  },
    orange: { border: "border-orange-800/30", bg: "bg-orange-950/20", titleClr: "text-orange-300", subClr: "text-orange-400/60" },
    stone:  { border: "border-stone-700/40",  bg: "bg-stone-900/60",  titleClr: "text-stone-200",  subClr: "text-stone-500"     },
  }[accent];
  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} px-3.5 py-3 hover:opacity-90 transition-all duration-300 h-full`}>
      <div className="flex items-start gap-2">
        {icon}
        <div>
          <p className={`text-[12px] font-semibold leading-tight ${styles.titleClr}`}>{title}</p>
          <p className={`text-[10px] mt-0.5 leading-relaxed ${styles.subClr}`}>{sub}</p>
        </div>
      </div>
    </div>
  );
}

function JourneyWorkflow() {
  return (
    <div
      className="rounded-2xl border border-stone-800/60 bg-stone-900/20 overflow-hidden"
      style={{ padding: "36px 40px 32px", boxShadow: "0 0 80px -20px rgba(200,241,53,0.04) inset" }}
    >
      {/* ── ROW 1: Main flow ── */}
      <div className="flex items-center gap-0">
        {/* Engineer asks */}
        <div className="flex-1">
          <FlowNode icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>}
            title="Engineer asks" sub="Plain language" />
        </div>
        <ArrR />
        {/* Read */}
        <div className="flex-1">
          <FlowNode icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>}
            title="Read" sub="Only authorized" />
        </div>
        <ArrR />
        {/* Decision diamond */}
        <div className="flex items-center justify-center shrink-0" style={{ width: 80, height: 80 }}>
          <div className="relative" style={{ width: 76, height: 76 }}>
            <div className="absolute inset-0 rotate-45 rounded-lg border border-stone-600/60 bg-stone-900/80" />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[9px] font-semibold text-stone-200 text-center leading-tight">Records</p>
              <p className="text-[9px] font-semibold text-stone-200 text-center leading-tight">consistent?</p>
            </div>
          </div>
        </div>
        {/* YES label + arrow */}
        <div className="flex flex-col items-start shrink-0 self-center ml-1 gap-0.5">
          <FlowBadge text="yes" accent="green" />
          <div className="flex items-center w-8">
            <div className="h-px flex-1 bg-emerald-700/50" />
            <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
              <path d="M1 4h6M4 1l3 3-3 3" stroke="#34d399" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        {/* Cited recommendation */}
        <div className="flex-1">
          <FlowNode icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
            title="Cited recommendation" sub="Every claim sourced" accent="green" />
        </div>
        <ArrR />
        {/* Work-order draft */}
        <div className="flex-1">
          <FlowNode icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
            title="Work-order draft" sub="Awaits supervisor" accent="stone" />
        </div>
        <ArrR />
        {/* Signed off */}
        <div className="flex-1">
          <FlowNode icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
            title="Signed off" sub="Full audit trail" accent="green" />
        </div>
      </div>

      {/* ── ROW 2: Down arrows — col template matches row 1 proportions ── */}
      {/* cols: flex-1 | 32px | flex-1 | 32px | 80px | 40px | flex-1 | 32px | flex-1 | 32px | flex-1 */}
      <div className="grid mt-1" style={{ gridTemplateColumns: "1fr 32px 1fr 32px 80px 40px 1fr 32px 1fr 32px 1fr" }}>
        <div /><div />
        <ArrD accent="blue" dashed />   {/* under Read */}
        <div />
        {/* under diamond+YES combined → spans diamond col + YES col */}
        <div className="col-span-2 flex justify-center"><ArrD accent="amber" dashed /></div>
        <div /><div />
        <ArrD accent="orange" dashed /> {/* under Work-order */}
        <div /><div />
      </div>

      {/* ── ROW 3: Branch badges ── */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 32px 1fr 32px 80px 40px 1fr 32px 1fr 32px 1fr" }}>
        <div /><div />
        <div className="flex justify-center"><FlowBadge text="insufficient" accent="blue" /></div>
        <div />
        <div className="col-span-2 flex justify-center"><FlowBadge text="no" accent="amber" /></div>
        <div /><div />
        <div className="flex justify-center"><FlowBadge text="consequential?" accent="orange" /></div>
        <div /><div />
      </div>

      {/* ── ROW 4: Branch cards ── */}
      <div className="grid mt-1.5" style={{ gridTemplateColumns: "1fr 32px 1fr 32px 80px 40px 1fr 32px 1fr 32px 1fr" }}>
        <div /><div />
        <BranchCard accent="blue"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
          title="NIRVA abstains honestly" sub="Says so, cites the gap" />
        <div />
        {/* Conflicting records spans diamond+YES cols for enough width */}
        <div className="col-span-2">
          <BranchCard accent="amber"
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" className="mt-0.5 shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
            title="Conflicting records" sub="Shown side-by-side — never silently resolved" />
        </div>
        <div /><div />
        <BranchCard accent="orange"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round" className="mt-0.5 shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
          title="Supervisor approval gate" sub="Zero actions execute without sign-off" />
        <div /><div />
      </div>

      {/* ── Footer ── */}
      <div className="mt-8 flex items-center justify-center gap-2.5 rounded-xl border border-stone-800/40 bg-stone-900/30 px-6 py-3">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c8f135" strokeWidth="1.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <p className="text-[11px] text-stone-500 text-center">
          Retrieved content is evidence, not instructions —{" "}
          <span style={{ color: LIME }} className="font-medium">zero consequential actions</span>{" "}
          run without a supervisor.
        </p>
      </div>
    </div>
  );
}

// ─── Live Pipeline Animation ──────────────────────────────────────────────────
const OUTPUTS = [
  { label: "Grounding citations",    content: "OEM p.41 · WO-88712 · SOP §3.2 · IR-2024-031", color: "text-stone-300" },
  { label: "Contradiction detected", content: "Bearing load: OEM 4.2 kN vs WO 5.8 kN",        color: "text-orange-400" },
  { label: "Recommendation ready",   content: "Replace bearing per OEM spec 4.2 kN",            color: "text-stone-300" },
  { label: "Awaiting approval",      content: "No action executes without supervisor sign-off",  color: "text-amber-400" },
];

function LivePipeline() {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let p = 0;
    const tick = setInterval(() => {
      p += 0.02;
      if (p >= 1) {
        p = 0;
        setStep(s => (s + 1) % 4);
      }
      setProgress(p);
    }, 40);
    return () => clearInterval(tick);
  }, []);

  const chunks = [
    { src: "OEM Manual p.41",   score: 0.97 },
    { src: "WO-88712 rev 2",    score: 0.91 },
    { src: "SOP-MRPL-004 §3.2", score: 0.88 },
    { src: "IR-2024-031 p.3",   score: 0.74 },
  ];

  const tokenSteps = ["▸ embed", "▸ cosine-sim", "▸ rank", "▸ ACL-filter"];

  return (
    <div className="flex gap-0 pt-7 items-stretch" style={{ minHeight: 360 }}>

      {/* LEFT — Local model inference */}
      <div className="flex-1 rounded-l-lg border border-r-0 border-stone-800 bg-stone-900/30 px-3 py-3 flex flex-col gap-2 overflow-hidden">
        <p className="text-[9px] uppercase tracking-widest text-stone-600 font-semibold">Local Model</p>
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full animate-pulse" style={{ backgroundColor: LIME }} />
          <span className="text-[10px] font-mono text-stone-400">mistral-7b · on-device</span>
        </div>
        <div className="flex flex-col justify-between flex-1 gap-1">
          {chunks.map((c, i) => (
            <div key={i} className={`flex items-center gap-2 rounded px-2 py-2 border transition-all duration-500 ${i === step ? "border-stone-700/60 bg-stone-800/50" : "border-stone-800/40 opacity-40"}`}>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-stone-400 truncate font-mono">{c.src}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-stone-800">
                  <div className="h-1 rounded-full transition-all duration-700"
                    style={{ width: `${c.score * 100}%`, backgroundColor: i === step ? LIME : "#44403c" }} />
                </div>
                <span className="text-[8px] text-stone-600 w-6 text-right">{c.score}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded bg-stone-800/40 border border-stone-700/40 px-2 py-1.5">
          <p className="text-[9px] font-mono text-stone-500">
            {tokenSteps[step]}
            <span className="animate-pulse text-lime-500"> █</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500/70" />
          <span className="text-[9px] text-stone-600">Zero cloud calls — air-gapped</span>
        </div>
      </div>

      {/* CENTER — 4 animated flowing lines */}
      <div className="relative w-16 shrink-0 border-y border-stone-800 bg-stone-900/10">
        <svg className="w-full h-full absolute inset-0" viewBox="0 0 64 360" preserveAspectRatio="none">
          <defs>
            {[0,1,2,3].map(i => (
              <linearGradient key={i} id={`lg${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"  stopColor="#44403c" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#d6d3d1" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#44403c" stopOpacity="0.3" />
              </linearGradient>
            ))}
          </defs>
          {[0,1,2,3].map(i => {
            const y = 45 + i * 75;
            return <line key={i} x1="0" y1={y} x2="64" y2={y} stroke={`url(#lg${i})`} strokeWidth="1.5" />;
          })}
          {[0,1,2,3].map(i => {
            const y = 45 + i * 75;
            const isActive = i === step;
            const x = isActive ? progress * 64 : -10;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="6" fill={LIME} opacity={isActive ? 0.15 : 0} />
                <circle cx={x} cy={y} r="3" fill={LIME} opacity={isActive ? 0.9 : 0} />
              </g>
            );
          })}
        </svg>
      </div>

      {/* RIGHT — Output */}
      <div className="flex-1 rounded-r-lg border border-l-0 border-stone-800 bg-stone-900/30 px-3 py-3 flex flex-col gap-2 overflow-hidden">
        <p className="text-[9px] uppercase tracking-widest text-stone-600 font-semibold">Output</p>
        <div className="flex flex-col justify-between flex-1 gap-1">
          {OUTPUTS.map((o, i) => (
            <div key={i} className={`rounded px-2 py-2 border transition-all duration-500 ${
              i === step ? "border-stone-700/60 bg-stone-800/50"
              : i < step ? "border-stone-800/30 opacity-60"
              : "border-transparent opacity-20"}`}>
              <p className="text-[9px] uppercase tracking-widest text-stone-600 mb-0.5">{o.label}</p>
              <p className={`text-[10px] leading-tight ${o.color}`}>{o.content}</p>
            </div>
          ))}
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-[9px] text-stone-600 uppercase tracking-widest">Confidence</span>
            <span className="text-[9px] font-semibold text-stone-300">{Math.min(25 + step * 21, 87)}%</span>
          </div>
          <div className="h-1 rounded-full bg-stone-800">
            <div className="h-1 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(25 + step * 21, 87)}%`, backgroundColor: LIME }} />
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── FAQ Accordion ────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "What is NIRVA?",
    a: "NIRVA is an AI-powered industrial investigation and root-cause decision-support system. It connects fragmented plant knowledge — manuals, SOPs, maintenance records, logs, drawings, and images — to help engineers investigate issues and make evidence-backed decisions.",
  },
  {
    q: "How does NIRVA help with industrial investigations?",
    a: "NIRVA retrieves relevant evidence, analyzes information across multiple sources, identifies relationships and contradictions, and produces traceable findings and recommendations for human review.",
  },
  {
    q: "What makes NIRVA different from a normal AI chatbot?",
    a: "NIRVA is designed specifically for industrial investigations rather than general conversation. It combines RAG, agentic reasoning, multimodal understanding, evidence verification, contradiction detection, and human approval into a controlled investigation workflow.",
  },
  {
    q: "Can NIRVA work without sending plant data to the cloud?",
    a: "Yes. NIRVA is designed for on-premise and air-gapped deployment, allowing sensitive industrial information to remain entirely within the organization's environment.",
  },
  {
    q: "How does NIRVA ensure that AI-generated findings can be trusted?",
    a: "NIRVA follows an evidence-grounded approach where findings can be traced back to their supporting sources. It can cross-check evidence, surface contradictions, and keep humans involved before consequential decisions are made.",
  },
];

function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="divide-y divide-stone-800/60">
      {FAQS.map((faq, i) => (
        <div key={i}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            className="w-full flex items-center justify-between gap-4 py-5 text-left group focus:outline-none focus-visible:ring-1 focus-visible:ring-stone-500 rounded"
          >
            <span className="text-[14px] font-semibold text-stone-200 group-hover:text-white transition-colors duration-200 leading-snug">
              {faq.q}
            </span>
            <span
              className="shrink-0 size-5 flex items-center justify-center rounded-full border border-stone-700 bg-stone-900 transition-all duration-300"
              style={{ color: open === i ? LIME : undefined }}
              aria-hidden="true"
            >
              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="none"
                className="transition-transform duration-300"
                style={{ transform: open === i ? "rotate(45deg)" : "rotate(0deg)" }}
              >
                <line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
          </button>
          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{ maxHeight: open === i ? "240px" : "0px", opacity: open === i ? 1 : 0 }}
            role="region"
            aria-hidden={open !== i}
          >
            <p className="pb-5 text-[13px] leading-[1.75] text-stone-400 max-w-2xl">
              {faq.a}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Login Modal ──────────────────────────────────────────────────────────────
const DEMO_ACCOUNTS = [
  { username: "engineer",       role: "engineer",       line: "investigate & upload — cannot approve" },
  { username: "safety_officer", role: "safety_officer", line: "audit everything — cannot upload or approve" },
  { username: "supervisor",     role: "supervisor",     line: "the only role that can approve actions" },
  { username: "admin",          role: "admin",          line: "publish documents & manage models — cannot approve" },
];

function LoginModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 cursor-pointer"
        style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", background: "rgba(10,11,12,0.50)" }}
        onClick={onClose}
      />

      {/* Card — matches /login page width and style */}
      <div
        className="relative z-10 w-full max-w-[480px] rounded-[20px] border p-10 shadow-2xl"
        style={{
          background: "rgba(18, 19, 21, 0.70)",
          backdropFilter: "blur(28px) saturate(160%)",
          WebkitBackdropFilter: "blur(28px) saturate(160%)",
          borderColor: "rgba(255,255,255,0.09)",
          boxShadow: `0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 60px ${LIME}06, 0 24px 60px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex size-7 items-center justify-center rounded-full border border-white/8 bg-white/5 text-stone-500 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Branding */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <NirvaLogo className="size-14" />
          <h1 className="text-2xl font-bold tracking-[0.12em] text-white">NIRVA</h1>
        </div>

        {/* Description */}
        <div className="mb-8 text-center">
          <p className="text-sm leading-relaxed text-neutral-500">Offline industrial investigation workbench.</p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">Sign in with your organization account.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="modal-username" className="text-xs font-medium uppercase tracking-wider text-neutral-400">Username</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 size-4 -translate-y-1/2" style={{ color: LIME }} />
              <input id="modal-username" name="username" type="text" autoComplete="username"
                value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username" required
                className="w-full rounded-lg border border-white/8 bg-white/5 py-3.5 pl-12 pr-4 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-[#c8f135]/60 focus:outline-none focus:ring-1 focus:ring-[#c8f135]/40 transition-colors"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="modal-password" className="text-xs font-medium uppercase tracking-wider text-neutral-400">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 size-4 -translate-y-1/2" style={{ color: LIME }} />
              <input id="modal-password" name="password" type="password" autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password" required
                className="w-full rounded-lg border border-white/8 bg-white/5 py-3.5 pl-12 pr-4 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-[#c8f135]/60 focus:outline-none focus:ring-1 focus:ring-[#c8f135]/40 transition-colors"
              />
            </div>
          </div>
          {error && (
            <div role="alert" className="rounded-lg border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-400">{error}</div>
          )}
          <button type="submit" disabled={submitting}
            className="mt-2 w-full rounded-lg py-[14px] text-[15px] font-semibold text-black transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: LIME, boxShadow: `0 4px 12px ${LIME}25` }}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Demo accounts — 2×2 role cards, identical to /login page */}
        <div className="mt-8 border-t border-white/8 pt-6">
          <p className="mb-4 text-center text-xs uppercase tracking-widest text-neutral-600">Demo accounts</p>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.username}
                type="button"
                onClick={() => { setUsername(a.username); setPassword("nirva-demo-pass"); }}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-white/20 hover:bg-white/10 ${
                  username === a.username
                    ? "border-[#c8f135]/50 bg-white/10"
                    : "border-white/8 bg-white/5"
                }`}
              >
                <p className="text-xs font-semibold text-white">{a.role}</p>
                <p className="mt-0.5 text-[10px] leading-snug text-neutral-500">{a.line}</p>
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-neutral-600">
            password:{" "}
            <code className="rounded bg-white/8 px-2 py-0.5 font-mono text-xs text-white">nirva-demo-pass</code>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const mounted = useMounted();
  const auth = useStoredAuth();
  const authed = mounted && auth !== null;
  const [showLogin, setShowLogin] = useState(false);

  // Prevent body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = showLogin ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showLogin]);

  return (
    <div className="min-h-screen bg-[#1a1917] text-stone-300 font-sans">
      {/* Login modal */}
      {showLogin && !authed && <LoginModal onClose={() => setShowLogin(false)} />}

      {/* Box grid background — only behind left column, not terminal */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(to right, #a8a29e 1px, transparent 1px), linear-gradient(to bottom, #a8a29e 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
          maskImage: "linear-gradient(to right, black 0%, black 55%, transparent 72%)",
          WebkitMaskImage: "linear-gradient(to right, black 0%, black 55%, transparent 72%)",
        }}
      />
      {/* ── Navbar ── */}
      <nav className="w-full border-b border-stone-800/60 bg-[#1a1917]/90 backdrop-blur sticky top-0 z-50">
        <div className="w-full px-8 lg:px-16 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <NirvaLogo className="size-11" />
            <span className="text-white font-bold text-3xl tracking-tight">NIRVA</span>
          </Link>
          <div className="flex items-center gap-8">
            <div className="hidden md:flex items-center gap-8 text-sm text-stone-400">
              <a href="#how-it-works" className="hover:text-white transition">How it works</a>
              <a href="#roles" className="hover:text-white transition">Roles</a>
              <a href="#demo" className="hover:text-white transition">Demo</a>
            </div>
            <Link
              href={authed ? "/workbench" : "#"}
              onClick={!authed ? (e) => { e.preventDefault(); setShowLogin(true); } : undefined}
              className="flex items-center gap-2 rounded-lg bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-white transition"
            >
              {authed ? "Open workbench" : "Sign in"}
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <main id="overview" className="w-full px-8 lg:px-16 pt-4 pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

          {/* Left column */}
          <div className="flex flex-col space-y-5">
            {/* Headline */}
            <div className="space-y-3">
              <h1 className="text-[2.75rem] font-bold leading-[1.08] tracking-tight">
                <span className="text-white">The offline industrial </span>
                <span className="text-stone-500">investigation </span>
                <span className="text-[#c8f135]">workbench.</span>
              </h1>
              <div className="w-14 h-1 rounded-full" style={{ backgroundColor: LIME }} />
            </div>

            {/* Product statement */}
            <p className="text-[15px] leading-[1.7] text-stone-400 max-w-[520px]">
              Submit an equipment-failure question. NIRVA investigates across plant documents, 
              surfaces contradictions, and drafts a cited recommendation — pausing for supervisor 
              approval before any action.
            </p>

            {/* Trust anchors - 2x2 grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Shield, title: "Works offline", sub: "Zero cloud dependency" },
                { icon: ShieldCheck, title: "ACL-enforced retrieval", sub: "Never retrieve-then-filter" },
                { icon: Link2, title: "Evidence-backed", sub: "Every claim sourced" },
                { icon: ClipboardCheck, title: "Human approval", sub: "No bypass, ever" },
              ].map((anchor) => (
                <div key={anchor.title} className="flex items-start gap-2.5 rounded-lg border border-stone-700/60 bg-stone-900/40 px-3 py-3 hover:border-stone-700 hover:-translate-y-0.5 transition-all duration-200">
                  <anchor.icon className="size-4 shrink-0 mt-0.5" style={{ color: LIME }} />
                  <div>
                    <p className="text-[13px] font-semibold text-stone-200 leading-tight">{anchor.title}</p>
                    <p className="text-[11px] text-stone-500 leading-tight mt-0.5">{anchor.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              <Link
                href={authed ? "/workbench" : "#"}
                onClick={!authed ? (e) => { e.preventDefault(); setShowLogin(true); } : undefined}
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

            {/* Live Pipeline — shows local processing */}
            <div className="pt-8">
              <p className="text-[10px] uppercase tracking-widest text-stone-600 mb-3">See it running</p>
              <LivePipeline />
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-[11px] text-stone-600">
                <span>Local model</span>
                <span>·</span>
                <span>Zero cloud calls</span>
                <span>·</span>
                <span>Grounding citations</span>
                <span>·</span>
                <span>Confidence scoring</span>
              </div>
            </div>

          </div>

          {/* Right column */}
          <div className="flex flex-col gap-2 w-full pt-14">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600">
              Live investigation preview — Pump P-204
            </p>
            <InvestigationTerminal />
          </div>
        </div>
      </main>

      {/* ── Differentiation ── */}
      <div id="how-it-works" className="border-t border-stone-800/60 py-24">
        <div className="max-w-4xl mx-auto px-8">

          {/* Header */}
          <div className="mb-12 text-center">
            {/* Decorative signal line */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-stone-700" />
              <div className="size-1 rounded-full" style={{ backgroundColor: LIME }} />
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-stone-700" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500 mb-4">Differentiation</p>
            <h2 className="text-3xl font-bold text-white">
              Why this isn&apos;t a chatbot
            </h2>
            <p className="mt-4 max-w-xl mx-auto text-stone-400 text-sm leading-relaxed">
              Three moments that separate investigation from conversation.
            </p>
          </div>

          {/* Three proof moments */}
          <div className="space-y-6">
            {/* 1. Thin evidence */}
            <div className="rounded-2xl border border-stone-700/50 bg-stone-900/30 px-8 py-6 hover:border-stone-700 transition-colors duration-300">
              <div className="flex items-start gap-6">
                <div className="shrink-0 flex items-center justify-center size-12 rounded-xl border border-blue-800/40 bg-blue-950/20">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-widest text-stone-500 mb-1">1. Thin Evidence</p>
                  <h3 className="text-lg font-bold text-white mb-2">NIRVA abstains honestly</h3>
                  <p className="text-[13px] leading-relaxed text-stone-400 mb-3">
                    When retrieved evidence is insufficient to answer with confidence, NIRVA says so 
                    explicitly and cites the gap — no hallucinated filler.
                  </p>
                  <div className="border-l-2 border-lime-500/40 pl-3">
                    <p className="text-xs font-mono text-stone-500 italic">
                      Example: &ldquo;Cannot determine bearing replacement schedule — OEM manual section 4.2 
                      is missing from corpus.&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Conflicting records */}
            <div className="rounded-2xl border border-stone-700/50 bg-stone-900/30 px-8 py-6 hover:border-stone-700 transition-colors duration-300">
              <div className="flex items-start gap-6">
                <div className="shrink-0 flex items-center justify-center size-12 rounded-xl border border-amber-800/40 bg-amber-950/20">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-widest text-stone-500 mb-1">2. Conflicting Records</p>
                  <h3 className="text-lg font-bold text-white mb-2">Surfaces contradictions, never resolves silently</h3>
                  <p className="text-[13px] leading-relaxed text-stone-400 mb-3">
                    When sources disagree, NIRVA presents both side-by-side with full citations — 
                    engineers decide which to trust.
                  </p>
                  <div className="border-l-2 border-lime-500/40 pl-3">
                    <p className="text-xs font-mono text-stone-500 italic">
                      Example: &ldquo;OEM p.41 specifies 4.2kN bearing load. WO-88712 records 5.8kN installation. 
                      Mismatch flagged.&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Consequential action */}
            <div className="rounded-2xl border border-stone-700/50 bg-stone-900/30 px-8 py-6 hover:border-stone-700 transition-colors duration-300">
              <div className="flex items-start gap-6">
                <div className="shrink-0 flex items-center justify-center size-12 rounded-xl border border-orange-800/40 bg-orange-950/20">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-widest text-stone-500 mb-1">3. Consequential Action</p>
                  <h3 className="text-lg font-bold text-white mb-2">Waits for supervisor approval</h3>
                  <p className="text-[13px] leading-relaxed text-stone-400 mb-3">
                    NIRVA drafts work orders and recommendations but never executes them. Supervisors 
                    review, approve, or reject — with full audit trail.
                  </p>
                  <div className="border-l-2 border-lime-500/40 pl-3">
                    <p className="text-xs font-mono text-stone-500 italic">
                      Example: &ldquo;Recommendation ready: Replace bearing per OEM spec. Status: Awaiting 
                      supervisor sign-off.&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>



      {/* ── Roles ── */}
      <div id="roles" className="border-t border-stone-800/60 py-24">
        <div className="max-w-[1400px] mx-auto px-8 lg:px-16">

          {/* Header */}
          <div className="mb-16 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-3">Access control</p>
            <h2 className="text-3xl font-bold text-white">Four roles, <span style={{ color: LIME }}>least privilege</span></h2>
            <p className="mt-4 max-w-xl mx-auto text-stone-400 text-sm">
              Every permission is default-deny. Roles enforced server-side and inside the retrieval layer.
            </p>
          </div>

          {/* Tree + Cards */}
          <div className="flex flex-col items-center">

            {/* Root node */}
            <div className="flex flex-col items-center">
              <div className="rounded-lg border border-stone-700/50 bg-stone-900/60 px-5 py-2.5 flex items-center gap-2.5">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: LIME }} />
                <span className="text-xs font-semibold text-stone-300 tracking-wide">Access Control System</span>
                <span className="size-1.5 rounded-full" style={{ backgroundColor: LIME }} />
              </div>
              {/* Root stem */}
              <div className="w-px h-8 bg-gradient-to-b from-stone-600 to-stone-700/50" />
            </div>

            {/* Horizontal connector + 4 branch stems */}
            <div className="hidden lg:block relative w-full">
              <div className="absolute top-0 left-[12.5%] right-[12.5%] h-px bg-stone-700/60" />
              <div className="grid grid-cols-4 gap-8">
                {[0,1,2,3].map(i => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="relative">
                      <div className="size-2 rounded-full border border-stone-600 bg-stone-900 ring-2 ring-stone-800" />
                      <div className="absolute inset-0 size-2 rounded-full opacity-40 blur-sm" style={{ backgroundColor: LIME }} />
                    </div>
                    <div className="w-px h-6 bg-gradient-to-b from-stone-600 to-stone-700/50" />
                  </div>
                ))}
              </div>
            </div>

            {/* Role cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
              {[
                { icon: FileSearch,     role: "Engineer",       desc: "Submits investigations, uploads documents, and gets cited evidence for repair decisions." },
                { icon: ClipboardCheck, role: "Supervisor",     desc: "The only role that can approve consequential actions. Reviews recommendations before signing off." },
                { icon: UserShield,     role: "Safety Officer", desc: "Reads the full tamper-evident audit trail and reviews hash-chain validity." },
                { icon: UserCog,        role: "Admin",          desc: "Publishes documents, sets access control lists, and manages the local model registry." },
              ].map((r) => (
                <div key={r.role} className="flex flex-col items-center text-center rounded-2xl border border-stone-800/80 bg-stone-900/50 px-8 py-8 hover:border-stone-700 hover:bg-stone-900/70 transition-all duration-300">
                  <div className="mb-5 inline-flex size-12 items-center justify-center rounded-xl border border-stone-800 bg-stone-900">
                    <r.icon className="size-5 text-stone-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-3 tracking-tight">{r.role}</h3>
                  <p className="text-xs leading-relaxed text-stone-500">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Demo accounts bar */}
          <div className="mt-10 flex items-center justify-center gap-3 flex-wrap rounded-xl border border-stone-800/60 bg-stone-900/30 px-6 py-3.5">
            <span className="text-[11px] text-stone-500 font-medium">Demo accounts</span>
            <span className="text-stone-700">·</span>
            {["engineer", "safety_officer", "supervisor", "admin"].map((u) => (
              <code key={u} className="rounded-md border border-stone-700/60 bg-stone-800/60 px-2 py-0.5 text-[11px] text-stone-300">{u}</code>
            ))}
            <span className="text-stone-700">·</span>
            <span className="text-[11px] text-stone-500">password</span>
            <code className="rounded-md border border-stone-700/60 bg-stone-800/60 px-2 py-0.5 text-[11px] text-stone-300">nirva-demo-pass</code>
          </div>

        </div>
      </div>

      {/* ── Band + on-premise ── */}
      <div className="border-t border-stone-800/60 py-24">
        <div className="max-w-7xl mx-auto px-8">
          <div className="rounded-2xl border border-stone-700/60 bg-stone-900/40 px-8 py-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-500 mb-3">The difference</p>
            <h2 className="text-3xl font-bold text-white">Runs inside your walls</h2>
            <p className="mt-3 text-sm font-medium" style={{ color: LIME }}>From evidence to action — inside your walls.</p>
            <p className="mt-4 max-w-xl mx-auto text-stone-400 text-sm">
              No cloud LLM. No data egress. No telemetry leaving the building. The entire pipeline — model, vectors, tools, audit — lives on your hardware and keeps working with the internet disconnected.
            </p>
          </div>
        </div>
      </div>

      {/* ── CTA ── */}
      <div id="demo" className="border-t border-stone-800/60 py-24">
        <div className="max-w-2xl mx-auto px-8 text-center">
          <NirvaLogo className="size-16 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white">Ready to investigate?</h2>
          <p className="mt-4 text-stone-400 text-sm max-w-xl mx-auto">
            Sign in with any demo account and run the golden investigation: Pump P-204 from equipment-failure question 
            to supervisor-approved work order with full audit trail.
          </p>
          <div className="mt-8">
            <Link
              href={authed ? "/workbench" : "#"}
              onClick={!authed ? (e) => { e.preventDefault(); setShowLogin(true); } : undefined}
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
            <NirvaLogo className="size-9" />
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
