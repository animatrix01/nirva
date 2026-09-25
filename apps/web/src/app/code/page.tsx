"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BackTo } from "@/components/back-to";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { useStoredAuth } from "@/lib/auth-client";
import {
  ApiError,
  downloadCodePy,
  getCodeRun,
  listJobs,
  runCode,
  type CodeRunResult,
} from "@/lib/api";
import type { JobSummary } from "@/lib/types";

const DEFAULT_TASK = "Parse vibration log for P-204, flag readings over 3.5.";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function CodePage() {
  const auth = useStoredAuth();
  const role = auth?.user.role ?? "";
  const canRun = role === "engineer" || role === "supervisor" || role === "admin";

  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [jobId, setJobId] = useState("");
  // default to the newest investigation without calling setState in an effect
  const effectiveJobId = jobId || jobs?.[0]?.job_id || "";
  const [task, setTask] = useState(DEFAULT_TASK);
  const [run, setRun] = useState<CodeRunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listJobs()
      .then((list) => {
        if (cancelled) return;
        setJobs(list);
      })
      .catch(() => {
        if (!cancelled) setJobs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadExisting = useCallback((id: string) => {
    if (!id) return;
    setNotice(null);
    void getCodeRun(id)
      .then((existing) => {
        setRun(existing);
        setTask(existing.task);
      })
      .catch((e: unknown) => {
        setRun(null);
        if (e instanceof ApiError && e.status === 404) {
          setNotice("No code run recorded for this investigation yet.");
        }
      });
  }, []);

  useEffect(() => {
    // queueMicrotask keeps the react-compiler happy (no setState in effect)
    queueMicrotask(() => loadExisting(effectiveJobId));
  }, [effectiveJobId, loadExisting]);

  const onRun = () => {
    if (!effectiveJobId || busy || !canRun) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    void runCode(effectiveJobId, task)
      .then((result) => setRun(result))
      .catch((e: unknown) => {
        setError(
          e instanceof ApiError
            ? e.body.detail
            : e instanceof Error
              ? e.message
              : "Code run failed"
        );
      })
      .finally(() => setBusy(false));
  };

  const onDownload = () => {
    if (!effectiveJobId) return;
    void downloadCodePy(effectiveJobId)
      .then((blob) => downloadBlob(blob, `job-${effectiveJobId.slice(0, 8)}-analysis.py`))
      .catch((e: unknown) => {
        setError(
          e instanceof ApiError ? e.body.detail : "Download failed"
        );
      });
  };

  return (
    <AppShell title="Working Code">
      <BackTo href="/investigations" />
      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
          Working Code — Scripts
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Generated analysis code runs in a sandbox (denylisted imports, 5s
          timeout, no network). Results persist per investigation.
        </p>
      </header>

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <label
          htmlFor="code-job"
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
        >
          Investigation
        </label>
        <select
          id="code-job"
          value={effectiveJobId}
          onChange={(e) => setJobId(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {jobs === null && <option value="">Loading…</option>}
          {jobs?.map((j) => (
            <option key={j.job_id} value={j.job_id}>
              {j.objective_summary.slice(0, 70)} ({j.status})
            </option>
          ))}
        </select>

        <label
          htmlFor="code-task"
          className="mb-1 mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300"
        >
          Analysis task
        </label>
        <textarea
          id="code-task"
          rows={3}
          value={task}
          onChange={(e) => setTask(e.target.value)}
          disabled={!canRun}
          placeholder="Write Python to parse vibration log for P-204, flag readings over 3.5."
          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 font-mono text-sm text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canRun ? (
            <Button type="button" onClick={onRun} disabled={busy || !effectiveJobId}>
              {busy ? "Running…" : "Run analysis"}
            </Button>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Your role is view-only — an engineer, supervisor, or admin runs
              the analysis.
            </p>
          )}
          {run && (
            <Button type="button" variant="outline" size="sm" onClick={onDownload} className="bg-white">
              Download .py
            </Button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
        {notice && !run && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{notice}</p>
        )}
      </section>

      {run && (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Result
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                run.ok
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {run.ok ? "Verified" : "Failed"}
            </span>
          </div>
          <CodeBlock code={run.code} language="python" />
          <pre className="mt-2 overflow-x-auto rounded-md bg-slate-50 p-2 font-mono text-xs text-slate-900 dark:bg-slate-900 dark:text-slate-100">
            {run.stdout || "(no output)"}
            {run.stderr ? `\n[stderr]\n${run.stderr}` : ""}
          </pre>
        </section>
      )}
    </AppShell>
  );
}
