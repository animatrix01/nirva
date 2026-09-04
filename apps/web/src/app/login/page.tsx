"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock } from "lucide-react";
import { ApiError, login, storeAuth } from "@/lib/api";

const DEMO_ACCOUNTS = [
  { username: "engineer", role: "engineer" },
  { username: "safety_officer", role: "safety_officer" },
  { username: "supervisor", role: "supervisor" },
  { username: "admin", role: "admin" },
];

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

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await login(username.trim(), password);
      storeAuth({ token: res.access_token, user: res.user });
      router.push("/investigations");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.detail);
      } else {
        setError("Login failed. Try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-8 font-sans overflow-hidden">

      {/* ── Background: simulated landing page content, blurred ── */}
      <div className="absolute inset-0 bg-[#1a1917]">
        {/* Faked hero content blocks to mimic the landing page behind the modal */}
        <div className="absolute inset-0 opacity-60">
          {/* Large headline text shape */}
          <div className="absolute top-[12%] left-[6%] w-[44%] space-y-3">
            <div className="h-10 w-[90%] rounded-lg bg-white/8" />
            <div className="h-10 w-[75%] rounded-lg bg-white/6" />
            <div className="mt-2 h-1 w-16 rounded-full" style={{ backgroundColor: `${LIME}60` }} />
            <div className="mt-4 h-3 w-[85%] rounded bg-white/4" />
            <div className="h-3 w-[70%] rounded bg-white/4" />
            <div className="h-3 w-[60%] rounded bg-white/4" />
          </div>
          {/* Role cards row */}
          <div className="absolute top-[38%] left-[6%] flex gap-3 w-[44%]">
            {[40, 30, 38, 28].map((w, i) => (
              <div key={i} className={`h-16 rounded-lg bg-white/5 border border-white/5`} style={{ width: `${w}%` }} />
            ))}
          </div>
          {/* CTA buttons */}
          <div className="absolute top-[53%] left-[6%] flex gap-3">
            <div className="h-10 w-32 rounded-xl" style={{ backgroundColor: `${LIME}30` }} />
            <div className="h-10 w-28 rounded-xl bg-white/5 border border-white/8" />
          </div>
          {/* Right terminal panel */}
          <div className="absolute top-[8%] right-[4%] w-[42%] h-[78%] rounded-xl border border-white/6 bg-white/3">
            <div className="p-4 space-y-2.5">
              <div className="flex gap-1.5 mb-3">
                <div className="size-2.5 rounded-full bg-red-500/40" />
                <div className="size-2.5 rounded-full bg-yellow-500/40" />
                <div className="size-2.5 rounded-full bg-emerald-500/40" />
              </div>
              {[80, 65, 90, 55, 70, 45, 75, 60, 50].map((w, i) => (
                <div key={i} className="h-2.5 rounded bg-white/5" style={{ width: `${w}%` }} />
              ))}
              <div className="mt-3 h-12 rounded-lg bg-orange-500/8 border border-orange-500/10" />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="h-14 rounded-lg bg-white/4" />
                <div className="h-14 rounded-lg bg-amber-500/8 border border-amber-500/10" />
              </div>
            </div>
          </div>
          {/* Ambient grid dots */}
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }} />
        </div>
        {/* Motion blur overlay */}
        <div className="absolute inset-0 backdrop-blur-[5px]" />
        {/* Dark tint so background doesn't overpower */}
        <div className="absolute inset-0 bg-[#0d0e0f]/20" />
        {/* Lime ambient glow */}
        <div className="pointer-events-none absolute inset-0" style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${LIME}08 0%, transparent 70%)`,
        }} />
      </div>

      {/* ── Glassmorphism Login Card ── */}
      <div className="relative z-10 w-full max-w-[480px]">
        <div
          className="relative rounded-[20px] border p-10 shadow-2xl"
          style={{
            background: "rgba(20, 21, 23, 0.55)",
            backdropFilter: "blur(24px) saturate(160%)",
            WebkitBackdropFilter: "blur(24px) saturate(160%)",
            borderColor: "rgba(255,255,255,0.08)",
            boxShadow: `0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 60px ${LIME}06, 0 24px 48px rgba(0,0,0,0.5)`,
          }}
        >
          {/* Branding */}
          <div className="mb-8 flex flex-col items-center gap-4">
            <NirvaLogo className="size-14" />
            <h1
              className="text-2xl font-bold tracking-[0.12em] text-white"
              style={{ fontFamily: "Inter, system-ui, sans-serif" }}
            >
              NIRVA
            </h1>
          </div>

          {/* Description */}
          <div className="mb-8 text-center">
            <p className="text-sm leading-relaxed text-neutral-500">
              Offline industrial investigation workbench.
            </p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">
              Sign in with your organization account.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Username Field */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="username"
                className="text-xs font-medium uppercase tracking-wider text-neutral-400"
              >
                Username
              </label>
              <div className="relative">
                <User
                  className="absolute left-4 top-1/2 size-4 -translate-y-1/2"
                  style={{ color: LIME }}
                />
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  className="w-full rounded-lg border border-white/8 bg-white/5 py-3.5 pl-12 pr-4 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-[#c8f135]/60 focus:outline-none focus:ring-1 focus:ring-[#c8f135]/40 transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="password"
                className="text-xs font-medium uppercase tracking-wider text-neutral-400"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-4 top-1/2 size-4 -translate-y-1/2"
                  style={{ color: LIME }}
                />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full rounded-lg border border-white/8 bg-white/5 py-3.5 pl-12 pr-4 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-[#c8f135]/60 focus:outline-none focus:ring-1 focus:ring-[#c8f135]/40 transition-colors"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-400"
              >
                {error}
              </div>
            )}

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-lg py-[14px] text-[15px] font-semibold text-black transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: LIME,
                boxShadow: `0 4px 12px ${LIME}25`,
              }}
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Demo Accounts */}
          <div className="mt-8 border-t border-white/8 pt-6">
            <p className="mb-4 text-center text-xs uppercase tracking-widest text-neutral-600">
              Demo accounts
            </p>
            <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  onClick={() => {
                    setUsername(account.username);
                    setPassword("nirva-demo-pass");
                  }}
                  className="rounded-md border border-white/8 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-white/15 hover:bg-white/10"
                >
                  {account.role}
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-neutral-600">
              password:{" "}
              <code className="rounded bg-white/8 px-2 py-0.5 font-mono text-xs text-white">
                nirva-demo-pass
              </code>
            </p>
          </div>

          {/* Subtle decorative element */}
          <div className="absolute bottom-6 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-neutral-800 to-transparent opacity-30" />
        </div>
      </div>
    </main>
  );
}
