import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-semibold tracking-tight">NIRVA</h1>
      <p className="text-muted-foreground max-w-md text-center text-sm">
        Offline industrial investigation workbench — air-gapped, cited, and
        human-approved.
      </p>
      <Button asChild>
        <Link href="/login">Sign in</Link>
      </Button>
    </main>
  );
}
