"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isUnauthorized } from "@/lib/api";
import { apiErrorMessage, logout } from "@/lib/auth";
import { fetchWorkerProfile, updateWorkerProfile, changeWorkerPassword, type WorkerProfile } from "@/lib/worker";
import { useWorkerUser, workerErrorMessage } from "@/components/worker/workerGuard";
import { WorkerShell } from "@/components/worker/WorkerShell";
import { ErrorState, LoadingState } from "@/components/common/States";

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function FieldRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 border-b border-white/5 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">{label}</span>
      <span className={`text-[13px] font-medium text-white ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const userGuard = useWorkerUser();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit profile state
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editErrors, setEditErrors] = useState<Partial<Record<"name" | "mobile" | "form", string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwErrors, setPwErrors] = useState<Partial<Record<"currentPassword" | "newPassword" | "confirmPassword" | "form", string>>>({});
  const [pwBusy, setPwBusy] = useState(false);
  const [pwSuccess, setPwSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchWorkerProfile();
      setProfile(res.user);
      setEditName(res.user.name || "");
      setEditMobile(res.user.mobile || "");
    } catch (err: unknown) {
      if (isUnauthorized(err)) { logout(); router.push("/login?expired=1"); return; }
      setError(workerErrorMessage(err, "Unable to load your profile. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { if (userGuard) load(); }, [userGuard, load]);

  function validateProfile(): boolean {
    const e: typeof editErrors = {};
    const n = editName.trim();
    if (!n) e.name = "Full name is required.";
    else if (n.length < 2) e.name = "Full name must be at least 2 characters.";
    const m = editMobile.trim();
    if (m && !/^[0-9+\-\s]{7,20}$/.test(m)) e.mobile = "Enter a valid mobile number (7–20 digits, + - allowed).";
    setEditErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaveSuccess("");
    setEditErrors({});
    if (!validateProfile()) return;
    setSaving(true);
    try {
      const payload: { name?: string; mobile?: string } = {};
      if (editName.trim() !== (profile?.name ?? "")) payload.name = editName.trim();
      const trimmedMobile = editMobile.trim();
      const currentMobile = profile?.mobile ?? "";
      if (trimmedMobile !== currentMobile) payload.mobile = trimmedMobile;
      if (Object.keys(payload).length === 0) {
        setEditErrors({ form: "No changes to save." });
        return;
      }
      const res = await updateWorkerProfile(payload);
      setProfile(res.user);
      // Update local storage user cache for header
      try {
        const raw = window.localStorage.getItem("sif_user");
        if (raw) {
          const u = JSON.parse(raw);
          window.localStorage.setItem("sif_user", JSON.stringify({ ...u, name: res.user.name }));
        }
      } catch {}
      setSaveSuccess("Profile updated successfully.");
    } catch (err: unknown) {
      if (isUnauthorized(err)) { logout(); router.push("/login?expired=1"); return; }
      const msg = apiErrorMessage(err);
      setEditErrors({ form: msg || "Unable to update your profile. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function validatePassword(): boolean {
    const e: typeof pwErrors = {};
    if (!currentPassword) e.currentPassword = "Current password is required.";
    if (!newPassword) e.newPassword = "New password is required.";
    else if (newPassword.length < 8) e.newPassword = "New password must be at least 8 characters.";
    if (!confirmPassword) e.confirmPassword = "Please confirm your new password.";
    else if (newPassword !== confirmPassword) e.confirmPassword = "Passwords do not match.";
    setPwErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwBusy) return;
    setPwSuccess("");
    setPwErrors({});
    if (!validatePassword()) return;
    setPwBusy(true);
    try {
      await changeWorkerPassword({ currentPassword, newPassword, confirmPassword });
      setPwSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      if (isUnauthorized(err)) { logout(); router.push("/login?expired=1"); return; }
      const msg = apiErrorMessage(err);
      const lower = msg.toLowerCase();
      if (lower.includes("current password is incorrect") || lower.includes("invalid_password")) {
        setPwErrors({ currentPassword: "Current password is incorrect." });
      } else if (lower.includes("passwords do not match")) {
        setPwErrors({ confirmPassword: "Passwords do not match." });
      } else {
        setPwErrors({ form: msg || "Unable to change your password. Please try again." });
      }
    } finally {
      setPwBusy(false);
    }
  }

  if (!userGuard) {
    return (
      <WorkerShell title="Profile">
        <LoadingState message="Loading profile…" />
      </WorkerShell>
    );
  }

  return (
    <WorkerShell title="Profile">
      <div className="mx-auto w-full max-w-[720px] space-y-5 sm:space-y-6">
        <div className="border-b border-white/5 pb-4">
          <h1 className="page-title text-white">Worker Profile</h1>
          <p className="page-subtitle">Manage your account information and security settings.</p>
        </div>

        {loading ? <LoadingState message="Loading profile…" /> : error ? <ErrorState message={error} onRetry={load} /> : profile ? (
          <>
            {/* Read-only info */}
            <section className="panel">
              <div className="panel-header">
                <h2 className="section-title">Profile Information</h2>
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-white/25">Real data from MySQL</span>
              </div>
              <div className="panel-body">
                <FieldRow label="Full Name" value={profile.name} />
                <FieldRow label="Email" value={profile.email} mono />
                {profile.employeeId !== undefined ? <FieldRow label="Employee ID" value={profile.employeeId ?? "—"} mono /> : null}
                {profile.mobile !== undefined ? <FieldRow label="Mobile Number" value={profile.mobile ?? "—"} mono /> : null}
                <FieldRow label="Role" value={profile.role} />
                <FieldRow label="Account Status" value={profile.status} />
                <FieldRow label="Account Created" value={formatDate(profile.createdAt)} />
              </div>
            </section>

            {/* Edit profile */}
            <section className="panel">
              <div className="panel-header">
                <h2 className="section-title">Edit Profile</h2>
                <span className="text-[11px] text-white/25">Update your name and mobile number</span>
              </div>
              <div className="panel-body">
                <form onSubmit={onSaveProfile} noValidate className="space-y-4">
                  {editErrors.form ? <p className="rounded-[8px] border border-[rgba(239,68,68,0.20)] bg-[rgba(239,68,68,0.08)] px-4 py-2.5 text-[13px] font-medium text-[#FCA5A5]" role="alert">{editErrors.form}</p> : null}
                  {saveSuccess ? <p className="rounded-[8px] border border-[rgba(16,185,129,0.20)] bg-[rgba(16,185,129,0.08)] px-4 py-2.5 text-[13px] font-medium text-[#6EE7B7]" role="status">{saveSuccess}</p> : null}
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-white">Full Name <span className="text-[#EF4444]">*</span></span>
                    <input id="field-name" value={editName} onChange={(e) => setEditName(e.target.value)} className={`field w-full ${editErrors.name ? "!border-[#EF4444]" : ""}`} aria-invalid={!!editErrors.name} aria-describedby={editErrors.name ? "err-name" : undefined} />
                    {editErrors.name ? <p id="err-name" className="mt-1 text-[11px] text-[#FCA5A5]">{editErrors.name}</p> : null}
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-white">Mobile Number <span className="text-[11px] font-normal text-white/30">(optional)</span></span>
                    <input id="field-mobile" value={editMobile} onChange={(e) => setEditMobile(e.target.value)} placeholder="9876543210" className={`field w-full ${editErrors.mobile ? "!border-[#EF4444]" : ""}`} aria-invalid={!!editErrors.mobile} aria-describedby={editErrors.mobile ? "err-mobile" : undefined} />
                    {editErrors.mobile ? <p id="err-mobile" className="mt-1 text-[11px] text-[#FCA5A5]">{editErrors.mobile}</p> : null}
                  </label>
                  <p className="font-mono text-[11px] text-white/25">Email, Employee ID, Role and Status cannot be changed from this page.</p>
                  <button type="submit" disabled={saving} className="button-primary px-5 disabled:opacity-50">{saving ? "Saving..." : "Save Changes"}</button>
                </form>
              </div>
            </section>

            {/* Security / Change Password */}
            <section className="panel">
              <div className="panel-header">
                <h2 className="section-title">Security</h2>
                <span className="text-[11px] text-white/25">Change your password</span>
              </div>
              <div className="panel-body">
                <form onSubmit={onChangePassword} noValidate className="space-y-4">
                  {pwErrors.form ? <p className="rounded-[8px] border border-[rgba(239,68,68,0.20)] bg-[rgba(239,68,68,0.08)] px-4 py-2.5 text-[13px] font-medium text-[#FCA5A5]" role="alert">{pwErrors.form}</p> : null}
                  {pwSuccess ? <p className="rounded-[8px] border border-[rgba(16,185,129,0.20)] bg-[rgba(16,185,129,0.08)] px-4 py-2.5 text-[13px] font-medium text-[#6EE7B7]" role="status">{pwSuccess}</p> : null}
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-white">Current Password <span className="text-[#EF4444]">*</span></span>
                    <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" className={`field w-full ${pwErrors.currentPassword ? "!border-[#EF4444]" : ""}`} aria-invalid={!!pwErrors.currentPassword} aria-describedby={pwErrors.currentPassword ? "err-currentPassword" : undefined} />
                    {pwErrors.currentPassword ? <p id="err-currentPassword" className="mt-1 text-[11px] text-[#FCA5A5]">{pwErrors.currentPassword}</p> : null}
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-white">New Password <span className="text-[#EF4444]">*</span></span>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" className={`field w-full ${pwErrors.newPassword ? "!border-[#EF4444]" : ""}`} aria-invalid={!!pwErrors.newPassword} aria-describedby={pwErrors.newPassword ? "err-newPassword" : undefined} />
                    {pwErrors.newPassword ? <p id="err-newPassword" className="mt-1 text-[11px] text-[#FCA5A5]">{pwErrors.newPassword}</p> : null}
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-white">Confirm New Password <span className="text-[#EF4444]">*</span></span>
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="Repeat new password" className={`field w-full ${pwErrors.confirmPassword ? "!border-[#EF4444]" : ""}`} aria-invalid={!!pwErrors.confirmPassword} aria-describedby={pwErrors.confirmPassword ? "err-confirmPassword" : undefined} />
                    {pwErrors.confirmPassword ? <p id="err-confirmPassword" className="mt-1 text-[11px] text-[#FCA5A5]">{pwErrors.confirmPassword}</p> : null}
                  </label>
                  <button type="submit" disabled={pwBusy} className="button-primary px-5 disabled:opacity-50">{pwBusy ? "Changing password..." : "Change Password"}</button>
                </form>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </WorkerShell>
  );
}
