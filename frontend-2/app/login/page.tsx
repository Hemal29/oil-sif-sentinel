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
    <main className="flex min-h-screen items-center justify-center bg-[#14283F] px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#C8791A] text-[14px] font-extrabold text-white">OS</span>
          <span>
            <span className="block font-heading text-[15px] font-bold uppercase tracking-[0.1em] text-white">OIL SIF Sentinel</span>
            <span className="block text-[12px] text-[#9BA3AF]">Safety Intelligence Platform</span>
          </span>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white p-7 shadow-[0_24px_64px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FCF0DE] text-[#C8791A]">
              <ShieldIcon className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-heading text-[20px] font-bold tracking-tight text-[#14283F]">HSE Sign in</h1>
              <p className="text-[13px] text-[#6B7385]">For HSE reviewers and administrators</p>
            </div>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            {expired ? (
              <p className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-2.5 text-[13px] font-medium text-[#92400E]">
                Your session expired. Please sign in again.
              </p>
            ) : null}
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#14283F]">Work email</span>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field w-full" placeholder="name@company.com" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#14283F]">Password</span>
              <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="field w-full" placeholder="••••••••" />
            </label>
            {error ? (
              <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5 text-[13px] font-medium text-[#991B1B]" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={busy} className="button-primary w-full py-1 text-[14px] disabled:opacity-50">
              {busy ? "Signing in…" : "Sign in to Dashboard"}
            </button>
          </form>
          <p className="mt-5 text-center text-[11.5px] leading-relaxed text-[#9BA3AF]">
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
