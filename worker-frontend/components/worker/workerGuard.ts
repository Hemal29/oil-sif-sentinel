"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { logout } from "@/lib/auth";

/**
 * Worker Portal guard: only USER role stays. HSE roles are blocked and
 * redirected to login with a message — they should use the HSE portal at
 * :3001 instead. Returns the user once resolved, or null while loading.
 */
export function useWorkerUser() {
  const router = useRouter();
  const user = useCurrentUser();

  useEffect(() => {
    if (user === null) return;
    // useCurrentUser returns null while loading; wait for fetch.
    // Once resolved, if role is HSE, redirect to login with blocked flag.
    if (user && user.role !== "USER") {
      router.replace("/login?blocked=1");
    }
  }, [user, router]);

  return user && user.role === "USER" ? user : null;
}

/** For pages that need to show a blocked message for HSE users. */
export function isHseUser(user: ReturnType<typeof useCurrentUser>): boolean {
  return !!user && user.role !== "USER";
}

/** Friendly worker-facing error text: never raw API/database internals. */
export function workerErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const resp = (err as { response?: { status?: number; data?: { error?: { message?: string; code?: string } } } }).response;
    const status = resp?.status;
    if (status === 401) {
      logout();
      return "Your session has expired. Please sign in again.";
    }
    if (status === 403 || status === 404) {
      return "This report was not found. It may have been moved or you may not have access to it.";
    }
    const message = resp?.data?.error?.message;
    // Zod field messages from the backend are already worker-readable.
    if (typeof message === "string" && message.length > 0 && message.length < 200) return message;
  }
  if (err instanceof Error && err.message === "Network Error") {
    return "Unable to reach the server. Check your connection and try again.";
  }
  return fallback;
}
