"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { isUnauthorized } from "@/lib/api";
import { logout } from "@/lib/auth";
import { fetchMyReports, type WorkerReport } from "@/lib/worker";
import type { ReportStatus, ReportType } from "@/types/report";
import { useWorkerUser, workerErrorMessage } from "@/components/worker/workerGuard";
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { PriorityBadge, SifBadge, StatusBadge, TypeBadge } from "@/components/common/Badges";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, ScrollTable, TD, TH } from "@/components/common/States";

const REPORT_TYPES: ReportType[] = ["UNSAFE_ACT", "UNSAFE_CONDITION", "NEAR_MISS"];
const STATUSES: ReportStatus[] = ["NEW", "ANALYZED", "UNDER_REVIEW", "CLOSED"];

const inputCls = "field w-full px-3 py-1.5 text-sm";

export default function WorkerReportsPage() {
  const router = useRouter();
  const user = useWorkerUser();
  const [items, setItems] = useState<WorkerReport[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [reportType, setReportType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetchMyReports({
          page: p,
          limit: 15,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(status ? { status: status as ReportStatus } : {}),
          ...(reportType ? { reportType: reportType as ReportType } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
        });
        setItems(res.items);
        setTotal(res.pagination.total);
        setTotalPages(Math.max(1, res.pagination.totalPages));
        setPage(res.pagination.page);
      } catch (err: unknown) {
        if (isUnauthorized(err)) { logout(); router.push("/login?expired=1"); return; }
        setError(workerErrorMessage(err, "Unable to load your reports. Please try again."));
      } finally { setLoading(false); }
    },
    [search, status, reportType, dateFrom, dateTo, router]
  );

  useEffect(() => { if (user) load(1); }, [user, load]);

  function applyFilters(e: React.FormEvent) { e.preventDefault(); load(1); }
  function clearFilters() { setSearch(""); setStatus(""); setReportType(""); setDateFrom(""); setDateTo(""); }

  return (
    <main className="page-canvas">
      <WorkerHeader title="My Reports" />
      <div className="mx-auto w-[min(100%-2rem,1100px)] space-y-4 py-6">
        <PageHeader
          title="My Reports"
          description="Reports submitted by you."
          actions={
            <Link href="/worker/reports/new" className="button-primary px-4 py-2 text-sm">
              + Submit Safety Report
            </Link>
          }
        />

        {!user ? <LoadingState message="Loading reports…" /> : error ? (
          <ErrorState message={error} onRetry={() => load(page)} />
        ) : (
          <>
            <form onSubmit={applyFilters} className="panel p-4" aria-label="My report filters">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Search</span>
                  <input type="search" placeholder="Number or description…" value={search} onChange={(e) => setSearch(e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Status</span>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                    <option value="">All statuses</option>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Report type</span>
                  <select value={reportType} onChange={(e) => setReportType(e.target.value)} className={inputCls}>
                    <option value="">All report types</option>
                    {REPORT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Date from</span>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Date to</span>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="submit" className="button-primary px-4 py-1.5 text-sm">Apply</button>
                <button type="button" onClick={clearFilters} className="button-secondary px-4 py-1.5 text-sm">Clear</button>
              </div>
            </form>

            {loading ? <LoadingState message="Loading reports…" /> : items.length === 0 ? (
              <EmptyState
                message="No reports yet. Your submitted safety reports will appear here."
                action={{ label: "Submit Your First Report", href: "/worker/reports/new" }}
              />
            ) : (
              <Card title={`${total} Report${total === 1 ? "" : "s"}`}>
                <ScrollTable>
                  <table className="w-full min-w-[820px]">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className={TH}>Report Number</th>
                        <th className={TH}>Type</th>
                        <th className={TH}>Site</th>
                        <th className={TH}>Date</th>
                        <th className={TH}>Status</th>
                        <th className={TH}>AI Assessment</th>
                        <th className={TH}>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r) => (
                        <tr key={r.id} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.04]">
                          <td className={TD}>
                            <Link href={`/worker/reports/${r.id}`} className="font-medium text-[#00E5FF] hover:underline">
                              {r.reportNumber}
                            </Link>
                          </td>
                          <td className={TD}><TypeBadge value={r.reportType} /></td>
                          <td className={TD}>{r.site ? `${r.site.name}${r.site.code ? ` (${r.site.code})` : ""}` : "—"}</td>
                          <td className={`${TD} tabular-nums`}>{r.date}</td>
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
                <div className="mt-4 flex items-center justify-between">
                  <button disabled={page <= 1} onClick={() => load(page - 1)} className="button-secondary px-4 py-1.5 text-sm disabled:opacity-40">Previous</button>
                  <span className="text-sm text-[#94A3B8]">Page {page} of {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => load(page + 1)} className="button-secondary px-4 py-1.5 text-sm disabled:opacity-40">Next</button>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </main>
  );
}
