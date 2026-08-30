import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  MoreVertical,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react";

// ─── Mock data ───────────────────────────────────────────────────────────────

const STATS = [
  { dot: "bg-amber-400", label: "Awaiting approval", count: 2 },
  { dot: "bg-sky-400", label: "Running", count: 1 },
  { dot: "bg-emerald-400", label: "Completed", count: 21 },
];

const NEEDS_ATTENTION = {
  label: "AWAITING APPROVAL",
  title: "Mechanical seal replacement — P-204",
  subtitle:
    "Recurring seal failure investigation with conflicting maintenance records and OEM recommendations.",
  tags: ["P-204", "8 sources", "2 contradictions"],
  risk: "High risk >",
  meta: {
    updated: "12 min ago",
    confidence: 87,
    next: "Supervisor approval required",
  },
};

const ACTIVE = {
  label: "RUNNING",
  title: "Vibration analysis — Motor M-102",
  subtitle: "Investigating high vibration observed on DE side",
  asset: "M-102",
  progress: { done: 3, total: 5 },
  started: "18 min ago",
};

const RECENT = [
  {
    title: "Coupling alignment correction — P-204",
    subtitle: "Recurring coupling failure",
    tags: ["P-204", "8 sources", "92%"],
    updated: "1 hr ago",
  },
  {
    title: "Bearing wear analysis — P-301",
    subtitle: "Vibration trend escalation on DE bearing",
    tags: ["P-301", "6 sources", "88%"],
    updated: "3 hr ago",
  },
  {
    title: "Gauge calibration drift — P-212",
    subtitle: "Discharge pressure reading deviations",
    tags: ["P-212", "5 sources", "81%"],
    updated: "5 hr ago",
  },
  {
    title: "Lubrication schedule audit — P-117",
    subtitle: "Overdue lube intervals flagged by shift log",
    tags: ["P-117", "4 sources", "76%"],
    updated: "8 hr ago",
  },
];

const ALL_ROWS = [
  {
    status: "Completed",
    statusClass: "border-emerald-500/40 text-emerald-400",
    title: "Recurring seal failure investigation — P-204",
    subtitle: "Seal replacement proposal awaiting supervisor decision",
    asset: "P-204",
    sources: 8,
    confidence: 87,
    barColor: "bg-emerald-500",
    updated: "12 min ago",
    next: "Review results",
  },
  {
    status: "Awaiting approval",
    statusClass: "border-amber-500/40 text-amber-400",
    title: "Vibration analysis — Motor M-102",
    subtitle: "High vibration on drive-end bearing under load",
    asset: "M-102",
    sources: 11,
    confidence: 82,
    barColor: "bg-amber-500",
    updated: "35 min ago",
    next: "Supervisor approval",
  },
  {
    status: "Running",
    statusClass: "border-sky-500/40 text-sky-400",
    title: "Lubrication interval audit — P-117",
    subtitle: "Cross-checking shift logs against lube schedule",
    asset: "M-117",
    sources: 6,
    confidence: null,
    barColor: "",
    updated: "18 min ago",
    next: "Gathering evidence",
  },
];

// ─── Small building blocks ───────────────────────────────────────────────────

function SectionTitle({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
        {label}
      </h2>
      <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-neutral-300">
        {count}
      </span>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-700/80 px-2.5 py-0.5 text-[11px] text-neutral-300">
      {children}
    </span>
  );
}

function Kebab() {
  return (
    <button
      type="button"
      aria-label="More actions"
      className="rounded-md p-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
    >
      <MoreVertical className="size-4" />
    </button>
  );
}

function OutlineButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800"
    >
      {children}
      <ArrowRight className="size-3.5" />
    </button>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function InvestigationsPage() {
  return (
    <div className="min-h-screen bg-neutral-950">
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* 1. Page header & stats */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Investigations</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Equipment problems and operational investigations
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md bg-[#C4F135] px-4 py-2 text-sm font-medium text-black transition hover:bg-[#b3dc2f]"
          >
            <Plus className="size-4" />
            New investigation
          </button>
        </div>

        <div className="mt-5 flex items-center gap-5">
          {STATS.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${s.dot}`} />
              <span className="text-sm text-neutral-300">
                {s.count} {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* 2. Filter bar */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {["All statuses", "All assets", "All time"].map((label) => (
              <select
                key={label}
                aria-label={label}
                defaultValue=""
                className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 outline-none transition focus:border-neutral-600"
              >
                <option value="">{label}</option>
              </select>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search investigations..."
                className="w-64 rounded-md border border-neutral-800 bg-neutral-900 py-2 pl-9 pr-3 text-sm text-neutral-200 outline-none transition placeholder:text-neutral-500 focus:border-neutral-600"
              />
            </div>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 transition hover:border-neutral-600"
            >
              <Filter className="size-4" />
              Filters
            </button>
          </div>
        </div>

        <div className="mt-8 space-y-10">
          {/* 3. NEEDS ATTENTION */}
          <section>
            <SectionTitle label="Needs attention" count={2} />
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-5">
              <div className="flex gap-4">
                <TriangleAlert className="mt-1 size-5 shrink-0 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold tracking-wide text-amber-400">
                    {NEEDS_ATTENTION.label}
                  </p>
                  <h3 className="mt-1 font-medium text-white">{NEEDS_ATTENTION.title}</h3>
                  <p className="mt-1 text-sm text-neutral-400">{NEEDS_ATTENTION.subtitle}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {NEEDS_ATTENTION.tags.map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                    <span className="rounded-full border border-red-500/40 bg-red-500/5 px-2.5 py-0.5 text-[11px] font-medium text-red-400">
                      {NEEDS_ATTENTION.risk}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-3">
                  <Kebab />
                  <OutlineButton>Review decision</OutlineButton>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-6 border-t border-amber-500/15 pt-4">
                <div>
                  <p className="text-xs text-neutral-500">Last updated</p>
                  <p className="mt-1 text-sm text-neutral-200">{NEEDS_ATTENTION.meta.updated}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Confidence</p>
                  <p className="mt-1 text-sm text-neutral-200">
                    {NEEDS_ATTENTION.meta.confidence}%
                  </p>
                  <div className="mt-1.5 h-1 w-3/4 rounded-full bg-neutral-800">
                    <div
                      className="h-1 rounded-full bg-amber-500"
                      style={{ width: `${NEEDS_ATTENTION.meta.confidence}%` }}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Next step</p>
                  <p className="mt-1 text-sm text-amber-400">{NEEDS_ATTENTION.meta.next}</p>
                </div>
              </div>
            </div>
          </section>

          {/* 4. ACTIVE */}
          <section>
            <SectionTitle label="Active" count={1} />
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.04] p-5">
              <div className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-sky-500/30 bg-sky-500/10">
                  <Clock className="size-5 text-sky-400" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold tracking-wide text-sky-400">
                    {ACTIVE.label}
                  </p>
                  <h3 className="mt-1 font-medium text-white">{ACTIVE.title}</h3>
                  <p className="mt-1 text-sm text-neutral-400">{ACTIVE.subtitle}</p>
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <OutlineButton>Open</OutlineButton>
                  <Kebab />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-6 border-t border-sky-500/15 pt-4">
                <div>
                  <p className="text-xs text-neutral-500">Asset</p>
                  <p className="mt-1 font-mono text-sm text-neutral-200">{ACTIVE.asset}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Progress</p>
                  <p className="mt-1 text-sm text-neutral-200">
                    {ACTIVE.progress.done} / {ACTIVE.progress.total} steps
                  </p>
                  <div className="mt-1.5 h-1 w-3/4 rounded-full bg-neutral-800">
                    <div
                      className="h-1 rounded-full bg-sky-500"
                      style={{
                        width: `${(ACTIVE.progress.done / ACTIVE.progress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Started</p>
                  <p className="mt-1 text-sm text-neutral-200">{ACTIVE.started}</p>
                </div>
              </div>
            </div>
          </section>

          {/* 5. RECENT */}
          <section>
            <SectionTitle label="Recent" count={4} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {RECENT.map((r) => (
                <div
                  key={r.title}
                  className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 transition hover:border-neutral-700"
                >
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span className="text-[11px] font-semibold tracking-wide text-emerald-400">
                      COMPLETED
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-white">{r.title}</h3>
                  <p className="mt-1 text-xs text-neutral-400">{r.subtitle}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {r.tags.map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-1 border-t border-neutral-800 pt-3 text-xs text-neutral-500">
                    Updated {r.updated}
                    <ArrowUpRight className="size-3.5" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 6. ALL INVESTIGATIONS */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  All investigations
                </h2>
                <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-neutral-300">
                  24
                </span>
              </div>
              <a
                href="#"
                className="flex items-center gap-1 text-xs text-neutral-400 underline-offset-2 transition hover:text-neutral-200 hover:underline"
              >
                View all
                <ExternalLink className="size-3.5" />
              </a>
            </div>

            <div className="overflow-hidden">
              {/* header */}
              <div className="grid grid-cols-12 gap-3 px-2 pb-2 text-sm text-neutral-500">
                <div className="col-span-2">Status</div>
                <div className="col-span-4">Investigation</div>
                <div className="col-span-1">Asset</div>
                <div className="col-span-1">Sources</div>
                <div className="col-span-2">Confidence</div>
                <div className="col-span-1">Updated</div>
                <div className="col-span-1">Next step</div>
              </div>

              {ALL_ROWS.map((r) => (
                <div
                  key={r.title}
                  className="grid grid-cols-12 items-center gap-3 border-b border-neutral-800 px-2 py-3.5 transition-colors hover:bg-neutral-800/40"
                >
                  <div className="col-span-2">
                    <span
                      className={`rounded border px-2 py-0.5 text-[11px] font-medium ${r.statusClass}`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="col-span-4 min-w-0">
                    <p className="truncate text-sm text-neutral-100">{r.title}</p>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">{r.subtitle}</p>
                  </div>
                  <div className="col-span-1 font-mono text-sm text-neutral-300">{r.asset}</div>
                  <div className="col-span-1 text-sm text-neutral-300">{r.sources}</div>
                  <div className="col-span-2">
                    {r.confidence === null ? (
                      <span className="text-sm text-neutral-500">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-neutral-200">{r.confidence}%</span>
                        <div className="h-1 w-14 rounded-full bg-neutral-800">
                          <div
                            className={`h-1 rounded-full ${r.barColor}`}
                            style={{ width: `${r.confidence}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="col-span-1 text-xs text-neutral-400">{r.updated}</div>
                  <div className="col-span-1 flex items-center gap-1 text-xs text-neutral-400">
                    {r.next}
                    <ArrowRight className="size-3 text-neutral-600" />
                    <Kebab />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
