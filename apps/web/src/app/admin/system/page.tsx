"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/app-header";
import { useStoredAuth } from "@/lib/auth-client";
import { ApiError, getAdminModels } from "@/lib/api";

interface ModelRow {
  model_name: string;
  purpose: string;
  quantization: string;
  checksum_sha256: string;
  profile: string;
  loaded: boolean;
}

export default function AdminSystemPage() {
  const auth = useStoredAuth();
  const isAdmin = auth?.user.role === "admin";
  const [models, setModels] = useState<ModelRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const signal = { cancelled: false };
    queueMicrotask(() => {
      void getAdminModels()
        .then((data) => {
          if (!signal.cancelled) setModels(data);
        })
        .catch((e: unknown) => {
          if (!signal.cancelled) {
            setError(
              e instanceof ApiError ? e.body.detail : "Failed to load model registry"
            );
          }
        });
    });
    return () => {
      signal.cancelled = true;
    };
  }, [isAdmin]);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="System" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        {!isAdmin ? (
          <p role="alert" className="text-destructive text-sm">
            Model registry is restricted to admins.
          </p>
        ) : error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : !models ? (
          <div className="h-48 animate-pulse rounded bg-muted/50" aria-busy="true" />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Purpose</th>
                  <th className="px-3 py-2">Quantization</th>
                  <th className="px-3 py-2">Checksum (sha256)</th>
                  <th className="px-3 py-2">Profile</th>
                  <th className="px-3 py-2">Loaded</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.model_name} className="border-t">
                    <td className="px-3 py-2 font-medium">{m.model_name}</td>
                    <td className="px-3 py-2">{m.purpose}</td>
                    <td className="px-3 py-2 font-mono">{m.quantization}</td>
                    <td className="px-3 py-2 font-mono">{m.checksum_sha256.slice(0, 16)}…</td>
                    <td className="px-3 py-2">{m.profile}</td>
                    <td className="px-3 py-2">
                      {m.loaded ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          loaded
                        </Badge>
                      ) : (
                        <Badge variant="secondary">not loaded</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
