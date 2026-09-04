"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function BackTo({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1.5 text-xs text-neutral-400 transition hover:text-neutral-200"
    >
      <ArrowLeft className="size-3.5" />
      {label}
    </Link>
  );
}
