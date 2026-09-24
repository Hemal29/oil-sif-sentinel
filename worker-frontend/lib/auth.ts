import { api, TOKEN_KEY } from "./api";
import type { AuthResponse, User } from "@/types/user";

const USER_KEY = "sif_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}

export function logout(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  }
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<User> {
  const res = await api.post("/auth/login", { email, password });
  const payload = res.data?.data as AuthResponse | undefined;
  if (!payload?.token) throw new Error("Login did not return a token.");
  window.localStorage.setItem(TOKEN_KEY, payload.token);
  if (payload.user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  }
  return payload.user;
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await api.get("/auth/me");
  const user = res.data?.data?.user as User | undefined;
  if (!user) throw new Error("Session lookup did not return a user.");
  if (typeof window !== "undefined") {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  return user;
}

export function apiErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const resp = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })
      .response;
    if (resp?.data?.error?.message) return resp.data.error.message;
    if (typeof resp?.data?.message === "string" && resp.data.message) return resp.data.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}
