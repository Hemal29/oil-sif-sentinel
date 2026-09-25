"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { isUnauthorized } from "@/lib/api";
import { logout } from "@/lib/auth";
import { fetchMyReports, fetchWorkerSummary, type WorkerReport, type WorkerSummary } from "@/lib/worker";
import { useWorkerUser, workerErrorMessage } from "@/components/worker/workerGuard";
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { PriorityBadge, SifBadge, StatusBadge, TypeBadge } from "@/components/common/Badges";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, ScrollTable, TD, TH } from "@/components/common/States";
import { KpiCard } from "@/components/common/States";

function formatDate(value: string): string {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export default function WorkerDashboardPage() {
  const router = useRouter();
  const user = useWorkerUser();
  const [summary, setSummary] = useState<WorkerSummary | null>(null);
  const [recent, setRecent] = useState<WorkerReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, r] = await Promise.all([fetchWorkerSummary(), fetchMyReports({ limit: 5 })]);
      setSummary(s);
      setRecent(r.items);
    } catch (err: unknown) {
      if (isUnauthorized(err)) { logout(); router.push("/login?expired=1"); return; }
      setError(workerErrorMessage(err, "Unable to load your dashboard. Please try again."));
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { if (user) load(); }, [user, load]);

  return (
    <main className="page-canvas">
      <WorkerHeader title="Worker Dashboard" />
      <div className="mx-auto w-[min(100%-2rem,1100px)] space-y-5 py-6">
        <PageHeader
          title="Worker Dashboard"
          description="Submit and track your workplace safety reports."
          actions={
            <Link href="/worker/reports/new" className="button-primary px-4 py-2 text-sm">
              + Submit Safety Report
            </Link>
          }
        />

        {!user ? <LoadingState message="Loading dashboard…" /> : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading || !summary ? (
          <LoadingState message="Loading dashboard…" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Report summary">
              <KpiCard label="My Reports" value={summary.myReports} hint="Submitted by you" variant="primary" />
              <KpiCard label="Under Review" value={summary.underReview} hint="With HSE reviewers" variant="medium" />
              <KpiCard label="Needs Information" value={summary.needsInformation} hint="Action needed from you" variant="high" />
              <KpiCard label="Closed" value={summary.closed} hint="Review complete" variant="success" />
            </div>

            <Card
              title="Recent Reports"
              subtitle="Your latest submissions and their current status."
            >
              {recent.length === 0 ? (
                <EmptyState
                  message="No reports yet. Your submitted safety reports will appear here."
                  action={{ label: "Submit Your First Report", href: "/worker/reports/new" }}
                />
              ) : (
                <ScrollTable>
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className={TH}>Report</th>
                        <th className={TH}>Type</th>
                        <th className={TH}>Submitted</th>
                        <th className={TH}>Status</th>
                        <th className={TH}>AI Assessment</th>
                        <th className={TH}>Last Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((r) => (
                        <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className={TD}>
                            <Link href={`/worker/reports/${r.id}`} className="font-medium text-[#C8791A] hover:underline">
                              {r.reportNumber}
                            </Link>
                          </td>
                          <td className={TD}><TypeBadge value={r.reportType} /></td>
                          <td className={`${TD} tabular-nums`}>{formatDate(r.date)}</td>
                          <td className={TD}><StatusBadge value={r.status} /></td>
                          <td className={TD}><SifBadge value={r.aiAnalysis?.sifPotential ?? null} /></td>
                          <td className={`${TD} tabular-nums`}>
                            {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollTable>
              )}
              {recent.length > 0 ? (
                <div className="mt-3 text-right">
                  <Link href="/worker/reports" className="text-[13px] font-semibold text-[#C8791A] hover:underline">
                    View all reports →
                  </Link>
                </div>
              ) : null}
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
