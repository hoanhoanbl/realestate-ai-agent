"use client";

import { useMemo, useSyncExternalStore } from "react";

export type Role = "MANAGER" | "SALE";

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface Session {
  token: string;
  user: SessionUser;
}

const KEY = "re_session";
const CHANGE_EVENT = "re-session-change";

export function getSessionRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  const raw = getSessionRaw();
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as Session).token ?? null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  window.localStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearSession(): void {
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

// undefined = chưa biết (đang render phía server), null = chưa đăng nhập
export function useSession(): Session | null | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(
    subscribe,
    getSessionRaw,
    () => undefined,
  );
  return useMemo(() => {
    if (raw === undefined) return undefined;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }, [raw]);
}
