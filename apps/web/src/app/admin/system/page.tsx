"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { Cpu } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useStoredAuth } from "@/lib/auth-client";
import { ApiError, getAdminModels } from "@/lib/api";

interface ModelRow {
  model_name: string;
  purpose: string;
  quantization: string;
  checksum_sha256: string;
  profile: string;
  loaded: boolean;
}

// ─── System page design tokens (Claude-black) ─────────────────────────────────
// Mirrors the Admin Workbench palette but is declared locally: this page must not
// depend on another page's internals, and no global token may change.
const T = {
  raised: "#201F1C",
  thead:  "#252420",
  border: "#2E2D29",
  ink:    "#E8E5DD",
  ink2:   "#7A7668",
  muted:  "#7A7668",
} as const;

export default function AdminSystemPage() {
  const auth = useStoredAuth();
  const isAdmin = auth?.user.role === "admin";
  const [models, setModels] = useState<ModelRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const signal = { cancelled: false };
    queueMicrotask(() => {
      void getAdminModels()
        .then((data) => {
          if (!signal.cancelled) setModels(data);
        })
        .catch((e: unknown) => {
          if (!signal.cancelled) {
            setError(
              e instanceof ApiError ? e.body.detail : "Failed to load model registry"
            );
          }
        });
    });
    return () => {
      signal.cancelled = true;
    };
  }, [isAdmin]);

  return (
    <AppShell title="System">
      <div className="space-y-4">
        {!isAdmin ? (
          <p role="alert" className="text-destructive text-sm">
            Model registry is restricted to admins.
          </p>
        ) : error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : !models ? (
          <div
            className="h-48 animate-pulse rounded-xl border"
            style={{ background: T.raised, borderColor: T.border }}
            aria-busy="true"
          />
        ) : (
          <>
            <div>
              <h1
                className="text-[33px] font-bold leading-[1.1] tracking-[-0.02em]"
                style={{ color: T.ink }}
              >
                Local Model Registry
              </h1>
              <p className="mt-2 text-[15px]" style={{ color: T.ink2 }}>
                Models available to the NIRVA runtime.
              </p>
            </div>

            <section
              className="overflow-hidden rounded-xl border"
              style={{ background: T.raised, borderColor: T.border }}
            >
              {/* Card header */}
              <div
                className="flex items-center gap-2.5 px-5 py-3"
                style={{ borderBottom: `1px solid ${T.border}` }}
              >
                <Cpu className="size-4 shrink-0 text-slate-500" aria-hidden />
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "#0F172A" }}
                >
                  Local model registry
                </p>
                <span
                  className="ml-auto text-[12px] font-semibold tabular-nums"
                  style={{ color: T.ink2 }}
                >
                  {models.length} model{models.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead style={{ background: T.thead, borderBottom: `1px solid ${T.border}` }}>
                    <tr>
                      {[
                        { t: "Model",             w: "w-[26%]" },
                        { t: "Purpose",           w: "w-[13%]" },
                        { t: "Quantization",      w: "w-[13%]" },
                        { t: "Checksum (sha256)", w: "w-[19%]" },
                        { t: "Profile",           w: "w-[13%]" },
                        { t: "Status",            w: "w-[16%]" },
                      ].map((h) => (
                        <th
                          key={h.t}
                          scope="col"
                          className={`px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] ${h.w}`}
                          style={{ color: T.muted }}
                        >
                          {h.t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((m, i) => (
                      <tr
                        key={m.model_name}
                        style={{
                          background: T.raised,
                          borderBottom: i === models.length - 1 ? "none" : `1px solid ${T.border}`,
                        }}
                      >
                        <td
                          className="px-5 py-4 text-[14px] font-semibold"
                          style={{ color: T.ink }}
                        >
                          <span className="block truncate" title={m.model_name}>
                            {m.model_name}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[13px]" style={{ color: T.ink }}>
                          {m.purpose}
                        </td>
                        <td className="px-5 py-4 text-[13px]" style={{ color: T.ink }}>
                          {m.quantization}
                        </td>
                        {/* Full digest is kept in the DOM and exposed via title;
                            CSS truncation only guards a long real sha256. */}
                        <td className="px-5 py-4 text-[13px]" style={{ color: T.muted }}>
                          <span className="block truncate" title={m.checksum_sha256}>
                            {m.checksum_sha256}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[13px]" style={{ color: T.ink }}>
                          {m.profile}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium"
                            style={
                              m.loaded
                                ? { borderColor: "#A7F3D0", background: "#ECFDF5", color: "#047857" }
                                : { borderColor: T.border, background: "#F1F5F9", color: T.ink2 }
                            }
                          >
                            <span
                              className={`size-1.5 shrink-0 rounded-full ${
                                m.loaded ? "bg-emerald-600" : "bg-slate-400"
                              }`}
                              aria-hidden
                            />
                            {m.loaded ? "loaded" : "not loaded"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
