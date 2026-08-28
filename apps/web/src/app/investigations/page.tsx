"use client";

import { AppHeader } from "@/components/app-header";
import { InvestigationsList } from "@/components/InvestigationsList";

export default function InvestigationsPage() {
  return (
    <main className="flex flex-1 overflow-y-auto">
      <AppHeader title="Investigations" />
      <InvestigationsList />
    </main>
  );
}