"use client";
import { useState } from "react";
import Link from "next/link";
import { registerWorker } from "@/lib/worker";
import { apiErrorMessage } from "@/lib/auth";

type FieldErrors = Partial<Record<"name" | "employeeId" | "email" | "mobile" | "password" | "confirmPassword" | "form", string>>;

function validate(values: { name: string; employeeId: string; email: string; mobile: string; password: string; confirmPassword: string }): FieldErrors {
  const e: FieldErrors = {};
  const name = values.name.trim();
  if (!name) e.name = "Full name is required.";
  else if (name.length < 2) e.name = "Full name must be at least 2 characters.";

  const emp = values.employeeId.trim();
  if (!emp) e.employeeId = "Employee ID is required.";
  else if (emp.length < 2) e.employeeId = "Employee ID must be at least 2 characters.";
  else if (emp.length > 50) e.employeeId = "Employee ID is too long.";

  const email = values.email.trim();
  if (!email) e.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email address.";

  const mobile = values.mobile.trim();
  if (mobile) {
    if (!/^[0-9+\-\s]{7,20}$/.test(mobile)) e.mobile = "Enter a valid mobile number (7–20 digits, + - allowed).";
  }

  if (!values.password) e.password = "Password is required.";
  else if (values.password.length < 8) e.password = "Password must be at least 8 characters.";

  if (!values.confirmPassword) e.confirmPassword = "Please confirm your password.";
  else if (values.password !== values.confirmPassword) e.confirmPassword = "Passwords do not match.";

  return e;
}

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || success) return;
    const nextErrors = validate({ name, employeeId, email, mobile, password, confirmPassword });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstKey = Object.keys(nextErrors)[0] as keyof FieldErrors;
      document.getElementById(`field-${firstKey}`)?.focus();
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await registerWorker({
        name: name.trim(),
        employeeId: employeeId.trim(),
        email: email.trim().toLowerCase(),
        ...(mobile.trim() ? { mobile: mobile.trim() } : {}),
        password,
      });
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      const msg = apiErrorMessage(err);
      const lower = msg.toLowerCase();
      const next: FieldErrors = {};
      if (lower.includes("email already exists") || lower.includes("email is already registered") || lower.includes("duplicate_email")) {
        next.email = "An account with this email already exists.";
      } else if (lower.includes("employee") && lower.includes("already exists") || lower.includes("duplicate_employee")) {
        next.employeeId = "An account with this Employee ID already exists.";
      } else {
        next.form = msg || "Unable to create your account. Please try again.";
      }
      setErrors(next);
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[420px] rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-[0_1px_2px_rgba(15,23,42,0.05)] text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF3E7]">
            <svg className="h-6 w-6 text-[#D97706]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="mt-4 text-[20px] font-bold tracking-tight text-[#0F172A]">Account created successfully.</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">Your Worker account is ready. Sign in to continue.</p>
          <Link href="/login" className="button-primary mt-6 w-full justify-center">Go to Worker Login</Link>
          <p className="mt-3 text-[11px] text-[#94A3B8]">Use your email and password to sign in.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-4 text-center sm:text-left">
            <h1 className="text-[24px] font-bold tracking-tight text-[#0F172A]">Create Worker Account</h1>
            <p className="mt-1 text-[13px] text-[#64748B]">Register to submit and track workplace safety reports.</p>
          </div>
          <form onSubmit={onSubmit} noValidate className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:p-8">
            {errors.form ? <p className="mb-4 rounded-[4px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5 text-[13px] font-medium text-[#991B1B]" role="alert">{errors.form}</p> : null}

            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-[#0F172A]">Full Name <span className="text-[#DC2626]">*</span></span>
              <input id="field-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rahul Patel" autoComplete="name" className={`field w-full ${errors.name ? "!border-[#DC2626]" : ""}`} aria-invalid={!!errors.name} aria-describedby={errors.name ? "err-name" : undefined} />
              {errors.name ? <p id="err-name" className="mt-1 text-[11px] text-[#DC2626]">{errors.name}</p> : null}
            </label>

            <label className="mt-4 block">
              <span className="mb-1 block text-[12px] font-semibold text-[#0F172A]">Employee ID <span className="text-[#DC2626]">*</span></span>
              <input id="field-employeeId" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="EMP-1024" autoComplete="off" className={`field w-full ${errors.employeeId ? "!border-[#DC2626]" : ""}`} aria-invalid={!!errors.employeeId} aria-describedby={errors.employeeId ? "err-employeeId" : undefined} />
              {errors.employeeId ? <p id="err-employeeId" className="mt-1 text-[11px] text-[#DC2626]">{errors.employeeId}</p> : null}
            </label>

            <label className="mt-4 block">
              <span className="mb-1 block text-[12px] font-semibold text-[#0F172A]">Email <span className="text-[#DC2626]">*</span></span>
              <input id="field-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rahul@example.com" autoComplete="email" className={`field w-full ${errors.email ? "!border-[#DC2626]" : ""}`} aria-invalid={!!errors.email} aria-describedby={errors.email ? "err-email" : undefined} />
              {errors.email ? <p id="err-email" className="mt-1 text-[11px] text-[#DC2626]">{errors.email}</p> : null}
            </label>

            <label className="mt-4 block">
              <span className="mb-1 block text-[12px] font-semibold text-[#0F172A]">Mobile Number <span className="text-[11px] font-normal text-[#94A3B8]">(optional)</span></span>
              <input id="field-mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="9876543210" autoComplete="tel" inputMode="numeric" className={`field w-full ${errors.mobile ? "!border-[#DC2626]" : ""}`} aria-invalid={!!errors.mobile} aria-describedby={errors.mobile ? "err-mobile" : undefined} />
              {errors.mobile ? <p id="err-mobile" className="mt-1 text-[11px] text-[#DC2626]">{errors.mobile}</p> : null}
            </label>

            <label className="mt-4 block">
              <span className="mb-1 block text-[12px] font-semibold text-[#0F172A]">Password <span className="text-[#DC2626]">*</span></span>
              <input id="field-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" className={`field w-full ${errors.password ? "!border-[#DC2626]" : ""}`} aria-invalid={!!errors.password} aria-describedby={errors.password ? "err-password" : undefined} />
              {errors.password ? <p id="err-password" className="mt-1 text-[11px] text-[#DC2626]">{errors.password}</p> : null}
            </label>

            <label className="mt-4 block">
              <span className="mb-1 block text-[12px] font-semibold text-[#0F172A]">Confirm Password <span className="text-[#DC2626]">*</span></span>
              <input id="field-confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" autoComplete="new-password" className={`field w-full ${errors.confirmPassword ? "!border-[#DC2626]" : ""}`} aria-invalid={!!errors.confirmPassword} aria-describedby={errors.confirmPassword ? "err-confirmPassword" : undefined} />
              {errors.confirmPassword ? <p id="err-confirmPassword" className="mt-1 text-[11px] text-[#DC2626]">{errors.confirmPassword}</p> : null}
            </label>

            <button type="submit" disabled={busy} className="button-primary mt-6 w-full disabled:opacity-50">{busy ? "Creating account..." : "Create Worker Account"}</button>

            <p className="mt-4 text-center text-[13px] text-[#64748B]">Already have an account? <Link href="/login" className="font-semibold text-[#D97706] hover:underline">Sign in</Link></p>
          </form>
            <p className="mt-4 text-center text-[11px] leading-relaxed text-[#94A3B8]">Your account will be created as Worker (USER). HSE/Admin access is granted separately.</p>
        </div>
    </main>
  );
}
