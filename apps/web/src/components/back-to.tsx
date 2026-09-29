"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function BackTo({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
    >
      <ArrowLeft className="size-3.5" />
      {label}
    </Link>
  );
}
