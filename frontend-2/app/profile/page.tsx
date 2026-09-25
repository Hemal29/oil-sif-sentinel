"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCurrentUser, getStoredUser } from "@/lib/auth";
import type { User } from "@/types/user";
import { AppShell } from "@/components/common/AppShell";
import { ErrorState, LoadingState } from "@/components/common/States";
import { PageHeader } from "@/components/ui/primitives";
import { ShieldIcon, UserIcon } from "@/components/ui/Icons";

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-b border-[#EFEADF] py-3 last:border-0">
      <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B7385]">{label}</dt>
      <dd className={`mt-1 text-[13.5px] text-[#14283F] ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
      setLoading(false);
    }
    fetchCurrentUser()
      .then((u) => {
        setUser(u);
        setLoading(false);
      })
      .catch(() => {
        if (!stored) {
          setError("Unable to load your profile.");
          setLoading(false);
        }
      });
  }, []);

  return (
    <AppShell title="Profile">
      <div className="mx-auto max-w-[760px] space-y-5">
        <PageHeader eyebrow="HSE · System" title="Profile" description="Your HSE account information." />
        {error && !user ? (
          <ErrorState message={error} onRetry={() => router.refresh()} />
        ) : loading || !user ? (
          <LoadingState message="Loading profile…" />
        ) : (
          <>
            <section className="panel overflow-hidden">
              <div className="flex items-center gap-4 border-b border-[#EFEADF] bg-[#FAF8F4] px-6 py-5">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#14283F] text-[20px] font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-[18px] font-bold tracking-tight text-[#14283F]">{user.name}</h2>
                  <p className="truncate text-[13px] text-[#6B7385]">{user.email}</p>
                </div>
                <span className="badge badge-info ml-auto shrink-0">{user.role.replace(/_/g, " ")}</span>
              </div>
              <div className="px-6 py-2">
                <dl>
                  <Field label="Full Name" value={user.name} />
                  <Field label="Email" value={user.email} mono />
                  <Field label="Role" value={user.role.replace(/_/g, " ")} />
                  <Field label="Account Status" value={user.status} />
                  {user.createdAt ? (
                    <Field label="Member Since" value={new Date(user.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })} />
                  ) : null}
                </dl>
              </div>
            </section>
            <section className="panel">
              <div className="panel-header">
                <div className="flex items-center gap-2.5">
                  <ShieldIcon className="h-4 w-4 text-[#6B7385]" />
                  <h2 className="section-title">Access & Responsibility</h2>
                </div>
              </div>
              <div className="panel-body">
                <ul className="space-y-2.5 text-[13px] leading-relaxed text-[#4C5566]">
                  <li className="flex gap-2.5">
                    <UserIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#9BA3AF]" />
                    Your review decisions are recorded permanently in the report audit trail.
                  </li>
                  <li className="flex gap-2.5">
                    <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#9BA3AF]" />
                    AI screening outputs are decision support only — final safety decisions rest with authorized HSE personnel.
                  </li>
                </ul>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
