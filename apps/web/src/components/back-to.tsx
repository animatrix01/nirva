"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function BackTo({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm font-bold text-neutral-400 shadow-sm transition hover:border-neutral-700 hover:text-neutral-200"
    >
      <ArrowLeft className="size-3.5" />
      {label}
    </Link>
  );
}
