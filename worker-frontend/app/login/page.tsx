"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiErrorMessage, login, logout } from "@/lib/auth";
import { ShieldIcon } from "@/components/ui/Icons";
import { AmbientDots } from "@/components/ui/AmbientDots";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const expired = searchParams.get("expired") === "1";
  const blocked = searchParams.get("blocked") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(email, password);
      if (user.role !== "USER") {
        logout();
        setError("This portal is for workers only. Please use the HSE portal at http://localhost:3001/login for HSE/Admin accounts.");
        return;
      }
      router.push("/");
    } catch (err: unknown) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#0A0D12] px-4 py-10">
      <AmbientDots />
      <div className="relative z-[1] w-full max-w-[440px]">
        <div className="mb-7 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(0,229,255,0.10)] text-[#00E5FF] ring-1 ring-white/10">
            <ShieldIcon className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-display text-[15px] font-bold tracking-tight text-white">OIL SIF Sentinel</span>
            <span className="block font-mono text-[12px] font-medium uppercase tracking-[0.12em] text-white/40">Worker Safety Portal</span>
          </span>
        </div>
        <div className="rounded-2xl border border-white/5 bg-[#151C26] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.45)] sm:p-8">
          <h1 className="font-display text-[22px] font-bold tracking-tight text-white">Welcome back</h1>
          <p className="mt-1 text-[13.5px] text-white/45">Sign in to report and track workplace safety observations.</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {expired ? (
              <p className="rounded-xl border border-[rgba(245,158,11,0.20)] bg-[rgba(245,158,11,0.08)] px-4 py-2.5 text-[13px] font-medium text-[#FCD34D]">
                Your session expired. Please sign in again.
              </p>
            ) : null}
            {blocked ? (
              <p className="rounded-xl border border-[rgba(245,158,11,0.20)] bg-[rgba(245,158,11,0.08)] px-4 py-2.5 text-[13px] font-medium text-[#FCD34D]">
                HSE accounts should use the HSE portal at http://localhost:3001. This portal is for workers only.
              </p>
            ) : null}
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-white">Email</span>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="field w-full" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-white">Password</span>
              <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="field w-full" />
            </label>
            {error ? (
              <p className="rounded-xl border border-[rgba(239,68,68,0.20)] bg-[rgba(239,68,68,0.08)] px-4 py-2.5 text-[13px] font-medium text-[#FCA5A5]" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={busy} className="button-primary w-full text-[15px] disabled:opacity-50">
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>
          <p className="mt-5 text-center text-[13.5px] text-white/40">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-[#00E5FF] hover:underline">
              Register as Worker
            </Link>
          </p>
        </div>
        <p className="mt-5 text-center font-mono text-[12px] text-white/25">HSE/Admin users: use the HSE Portal</p>
      </div>
    </main>
  );
}
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
