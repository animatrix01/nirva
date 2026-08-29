"use client";

import { AppHeader } from "@/components/app-header";
import { InvestigationsList } from "@/components/InvestigationsList";

export default function InvestigationsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="Investigations" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <InvestigationsList />
      </main>
    </div>
  );
}
