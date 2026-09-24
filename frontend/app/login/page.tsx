"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiErrorMessage, login } from "@/lib/auth";
import { ShieldIcon } from "@/components/ui/Icons";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const expired = searchParams.get("expired") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#080A0E] px-4 py-10">
      {/* subtle cyan glow behind card */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-[46%] h-[520px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(0,229,255,0.08),transparent_70%)] blur-[1px]" />
        <div className="absolute left-1/2 top-[46%] h-[320px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.06),transparent_70%)]" />
      </div>
      <div className="relative w-full max-w-[440px]">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[rgba(0,229,255,0.12)] text-[14px] font-extrabold text-[#00E5FF] ring-1 ring-[rgba(0,229,255,0.22)]">OS</span>
          <span>
            <span className="block text-[15px] font-bold uppercase tracking-[0.10em] text-white" style={{ fontFamily: "var(--font-heading)" }}>OIL SIF Sentinel</span>
            <span className="block text-[12px] text-[#94A3B8]">Safety Intelligence Platform</span>
          </span>
        </div>
        <div className="rounded-[14px] border border-white/[0.08] bg-[#131B24]/90 p-7 shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-[12px] sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[rgba(0,229,255,0.10)] text-[#00E5FF] ring-1 ring-[rgba(0,229,255,0.16)]">
              <ShieldIcon className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-[20px] font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-heading)" }}>HSE Sign in</h1>
              <p className="text-[13px] text-[#94A3B8]">For HSE reviewers and administrators</p>
            </div>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            {expired ? (
              <p className="rounded-[10px] border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)] px-4 py-2.5 text-[13px] font-medium text-[#FBBF24]">
                Your session expired. Please sign in again.
              </p>
            ) : null}
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-white">Work email</span>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field w-full" placeholder="name@company.com" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-white">Password</span>
              <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="field w-full" placeholder="••••••••" />
            </label>
            {error ? (
              <p className="rounded-[10px] border border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.10)] px-4 py-2.5 text-[13px] font-medium text-[#F87171]" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={busy} className="button-primary w-full py-1 text-[14px] disabled:opacity-50">
              {busy ? "Signing in…" : "Sign in to Dashboard"}
            </button>
          </form>
          <p className="mt-5 text-center text-[11.5px] leading-relaxed text-[#64748B]">
            Authorized HSE personnel only. All access is logged.
          </p>
        </div>
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
