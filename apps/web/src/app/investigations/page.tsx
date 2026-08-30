"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { InvestigationsList } from "@/components/InvestigationsList";

export default function InvestigationsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="Investigations" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-10">
        <div className="flex items-center justify-between py-7">
          <div>
            <h1 className="text-xl font-semibold text-white">Investigations</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Durable investigation runs — filter, review, reopen.
            </p>
          </div>
          <Link
            href="/investigations/new"
            className="flex items-center gap-1.5 rounded-lg bg-[#C4F135] px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-110"
          >
            <Plus className="size-4" />
            New investigation
          </Link>
        </div>
        <InvestigationsList />
      </main>
    </div>
  );
}
