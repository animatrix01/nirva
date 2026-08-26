"use client";

import { useCallback, useSyncExternalStore } from "react";
import { AUTH_STORAGE_KEY, type StoredAuth } from "@/lib/api";

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function useStoredAuth(): StoredAuth | null {
  const getSnapshot = useCallback(
    () => window.localStorage.getItem(AUTH_STORAGE_KEY),
    []
  );
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}
