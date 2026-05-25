import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function resolveApiUrl(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_API_URL || "/api";
  }
  return process.env.NEXT_PUBLIC_API_URL || `${window.location.origin}/api`;
}

export function getApiUrl(): string {
  const url = resolveApiUrl();
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function getWsUrl(): string | null {
  const ws = process.env.NEXT_PUBLIC_WS_URL;
  if (!ws || ws === "disabled" || ws === "false") return null;
  return ws;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("ely_token") : null;
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    const error = new Error(err.error || "Request failed") as Error & { body?: Record<string, unknown> };
    error.body = err;
    throw error;
  }
  return res.json();
}
