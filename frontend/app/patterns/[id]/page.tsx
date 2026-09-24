"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, isUnauthorized } from "@/lib/api";
import { apiErrorMessage, logout } from "@/lib/auth";
import { AppShell } from "@/components/common/AppShell";
import { ErrorState, LoadingState } from "@/components/common/States";
import { StatusBadge } from "@/components/common/Badges";
import { BackIcon } from "@/components/ui/Icons";

interface PatternDetail {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  metadata?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B]">{label}</p>
      <p className={`mt-1 text-[13.5px] text-white ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

export default function PatternDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [pattern, setPattern] = useState<PatternDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/patterns/${id}`);
      setPattern(res.data.data.pattern as PatternDetail);
    } catch (err: unknown) {
      if (isUnauthorized(err)) {
        logout();
        router.push("/login?expired=1");
        return;
      }
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, router]);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <AppShell title="Pattern Detail">
      <div className="space-y-5">
        <Link href="/patterns" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#00E5FF] hover:underline">
          <BackIcon className="h-4 w-4" /> Back to Patterns
        </Link>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading || !pattern ? (
          <LoadingState message="Loading pattern…" />
        ) : (
          <>
            <div className="rounded-2xl border border-white/[0.06] bg-[#131B24] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:p-6">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[24px] font-bold tracking-tight text-white sm:text-[28px]">{pattern.name}</h1>
                <StatusBadge value={pattern.status} />
              </div>
              <p className="mt-2 font-mono text-[12.5px] text-[#64748B]">Pattern code {pattern.code ?? "—"}</p>
            </div>
            <section className="panel">
              <div className="panel-header">
                <h2 className="section-title">Pattern Information</h2>
              </div>
              <div className="panel-body">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field label="Name" value={pattern.name} />
                  <Field label="Code" value={pattern.code ?? "—"} mono />
                  <Field label="Status" value={<StatusBadge value={pattern.status} />} />
                  <Field label="Pattern ID" value={pattern.id} mono />
                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B]">Description</p>
                    <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-white">{pattern.description ?? "No description."}</p>
                  </div>
                  {pattern.metadata ? (
                    <div className="sm:col-span-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B]">Metadata</p>
                      <pre className="mt-2 overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.04] p-4 font-mono text-[12px] leading-relaxed text-[#CBD5E1]">
                        {JSON.stringify(pattern.metadata, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
