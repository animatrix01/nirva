"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, login, storeAuth } from "@/lib/api";

const DEMO_ACCOUNTS = [
  { username: "engineer", role: "engineer" },
  { username: "safety_officer", role: "safety_officer" },
  { username: "supervisor", role: "supervisor" },
  { username: "admin", role: "admin" },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await login(username.trim(), password);
      storeAuth({ token: res.access_token, user: res.user });
      router.push("/investigations");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.detail);
      } else {
        setError("Login failed. Try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">NIRVA</CardTitle>
          <CardDescription>
            Offline industrial investigation workbench. Sign in with your
            organization account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex-col items-start gap-2">
          <p className="text-muted-foreground text-xs">
            Demo accounts — password: <code>nirva-demo-pass</code>
          </p>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.username}
                type="button"
                className="text-primary hover:underline"
                onClick={() => {
                  setUsername(a.username);
                  setPassword("nirva-demo-pass");
                }}
              >
                {a.role}
              </button>
            ))}
          </div>
        </CardFooter>
      </Card>
    </main>
  );
}
