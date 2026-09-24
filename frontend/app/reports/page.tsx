"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchReports, fetchSites, isUnauthorized } from "@/lib/api";
import { apiErrorMessage, logout } from "@/lib/auth";
import type { ReportFilters, ReportStatus, ReportType, SafetyReport } from "@/types/report";
import { AppShell } from "@/components/common/AppShell";
import { PriorityBadge, SifBadge, StatusBadge, TypeBadge } from "@/components/common/Badges";
import { EmptyState, ErrorState } from "@/components/common/States";
import { PageHeader } from "@/components/ui/primitives";
import { EyeIcon, SearchIcon } from "@/components/ui/Icons";

function shortReportId(report: SafetyReport): string {
  const raw = (report.reportNumber || report.id || "").trim();
  if (!raw) return "—";
  const last4 = raw.slice(-4).toUpperCase();
  return `#${last4}`;
}

function SifCell({ report }: { report: SafetyReport }) {
  const hasField = Object.prototype.hasOwnProperty.call(report, "aiAnalysis");
  if (!hasField || (report as unknown as { aiAnalysis?: unknown }).aiAnalysis === undefined) {
    return <span className="badge badge-neutral">—</span>;
  }
  const a = (report as unknown as { aiAnalysis: SafetyReport["aiAnalysis"] }).aiAnalysis;
  if (a === null || a === undefined) return <SifBadge value={null} />;
  const st = (a as unknown as { analysisStatus?: string; status?: string }).analysisStatus ?? (a as unknown as { status?: string }).status ?? null;
  if (st === "PENDING") return <span className="badge badge-neutral">Pending</span>;
  if (st === "FAILED") return <span className="badge badge-neutral">Failed</span>;
  if (st === "COMPLETED") return <SifBadge value={(a.sifPotential as unknown as boolean | string | null) ?? null} />;
  if (a.sifPotential !== undefined) return <SifBadge value={a.sifPotential as unknown as boolean | string | null} />;
  return <SifBadge value={null} />;
}

function PriorityCell({ report }: { report: SafetyReport }) {
  const hasField = Object.prototype.hasOwnProperty.call(report, "aiAnalysis");
  if (!hasField || (report as unknown as { aiAnalysis?: unknown }).aiAnalysis === undefined) {
    return <span className="badge badge-neutral">—</span>;
  }
  const a = (report as unknown as { aiAnalysis: SafetyReport["aiAnalysis"] }).aiAnalysis;
  if (a === null || a === undefined) return <PriorityBadge value={null} />;
  const st = (a as unknown as { analysisStatus?: string; status?: string }).analysisStatus ?? (a as unknown as { status?: string }).status ?? null;
  if (st === "PENDING") return <span className="badge badge-neutral">Pending</span>;
  if (st === "FAILED") return <span className="badge badge-neutral">Failed</span>;
  if (st === "COMPLETED") return <PriorityBadge value={(a.priority as unknown as string | null) ?? null} />;
  return <PriorityBadge value={(a.priority as unknown as string | null) ?? null} />;
}

function RouteCell({ report }: { report: SafetyReport }) {
  const a = (report as unknown as { aiAnalysis?: { route?: string | null; analysisStatus?: string } | null }).aiAnalysis;
  if (!a || a.analysisStatus !== "COMPLETED" || !a.route) return <span className="text-[12px] text-[#94A3B8]">—</span>;
  const styles: Record<string, string> = {
    PRIORITY: "badge badge-info",
    UNCERTAIN: "badge badge-neutral",
    AUTO_CLOSE: "badge badge-neutral",
    ABSTAIN: "badge badge-neutral",
  };
  return <span className={styles[a.route] ?? "badge badge-neutral"}>{a.route.replace("_", " ")}</span>;
}

const REPORT_TYPES: ReportType[] = ["UNSAFE_ACT", "UNSAFE_CONDITION", "NEAR_MISS"];
const STATUSES: ReportStatus[] = ["NEW", "ANALYZED", "UNDER_REVIEW", "CLOSED"];

export default function ReportsPage() {
  return (
    <AppShell title="Reports">
      <Suspense>
        <ReportsContent />
      </Suspense>
    </AppShell>
  );
}

function ReportsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<SafetyReport[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [site, setSite] = useState("");
  const [activity, setActivity] = useState("");
  const [reportType, setReportType] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sites, setSites] = useState<{ id: string; name: string; code: string }[]>([]);

  useEffect(() => {
    fetchSites({ limit: 100 })
      .then((d) => setSites(d.items.map((s) => ({ id: s.id, name: s.name, code: s.code }))))
      .catch(() => {});
  }, []);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setError("");
      const filters: ReportFilters = { page: p, limit: 20, sortBy: "createdAt", sortOrder: "desc" };
      if (search.trim()) filters.search = search.trim();
      if (site) filters.site = site;
      if (activity.trim()) filters.activity = activity.trim();
      if (reportType) filters.reportType = reportType as ReportType;
      if (status) filters.status = status as ReportStatus;
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      try {
        const res = await fetchReports(filters);
        setItems(res.items);
        setTotal(res.pagination.total);
        setTotalPages(Math.max(1, res.pagination.totalPages));
        setPage(res.pagination.page);
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
    },
    [search, site, activity, reportType, status, dateFrom, dateTo, router]
  );

  useEffect(() => {
    load(1);
  }, [load]);
  // Global header search navigates here with ?search= — pick it up.
  useEffect(() => {
    const q = searchParams.get("search") || "";
    setSearch((prev) => (prev === q ? prev : q));
  }, [searchParams]);
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    load(1);
  }
  function clear() {
    setSearch("");
    setSite("");
    setActivity("");
    setReportType("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
  }
  const hasFilters = search || site || activity || reportType || status || dateFrom || dateTo;

  return (
    <div className="space-y-5">
        <PageHeader
          eyebrow="HSE · Safety Management"
          title="Reports"
          description="Review and manage submitted safety observations and incidents."
          actions={
            <>
              <Link href="/imports" className="button-secondary">
                Import Reports
              </Link>
              <Link href="/analyze" className="button-primary">
                Analyze Reports
              </Link>
            </>
          }
        />

        <form onSubmit={onSubmit} className="filter-bar" aria-label="Report filters">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Search</span>
            <span className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="search"
                placeholder="Report number, description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="field w-full pl-9 pr-3"
                aria-label="Search reports"
              />
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Site</span>
            <select value={site} onChange={(e) => setSite(e.target.value)} className="field min-w-[160px] pr-8" aria-label="Filter by site">
              <option value="">All sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Type</span>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="field min-w-[160px] pr-8" aria-label="Filter by type">
              <option value="">All types</option>
              {REPORT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="field min-w-[160px] pr-8" aria-label="Filter by status">
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Activity</span>
            <input
              type="text"
              placeholder="Activity…"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              className="field min-w-[150px]"
              aria-label="Filter by activity"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">From</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="field min-w-[145px]" aria-label="From date" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">To</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="field min-w-[145px]" aria-label="To date" />
          </label>
          <div className="flex items-end gap-2 pt-1">
            <button type="submit" className="button-primary min-h-[40px]">
              Apply
            </button>
            <button type="button" onClick={clear} className="button-secondary min-h-[40px]">
              Clear
            </button>
          </div>
        </form>

        {error ? (
          <ErrorState message={error} onRetry={() => load(page)} />
        ) : loading ? (
          <div className="panel overflow-hidden" aria-live="polite" aria-busy="true">
            <div className="space-y-2 p-5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton h-11" />
              ))}
            </div>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            message={hasFilters ? "No reports match the selected filters." : "No safety reports yet. Reports submitted by workers will appear here."}
            action={hasFilters ? undefined : { label: "Import Reports", href: "/imports" }}
          />
        ) : (
          <div className="panel overflow-hidden">
            <div className="panel-header">
              <h2 className="section-title">
                {total.toLocaleString()} Report{total === 1 ? "" : "s"}
              </h2>
              <span className="text-[12px] tabular-nums text-[#64748B]">
                Page {page} of {totalPages}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[960px]">
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Worker</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Site</th>
                    <th>SIF</th>
                    <th>AI Route</th>
                    <th>Status</th>
                    <th className="w-[72px] text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap font-mono text-[12.5px] font-semibold">
                        <Link
                          href={`/reports/${r.id}`}
                          className="text-[#00E5FF] hover:underline"
                          title={`${r.reportNumber} — click to view full report`}
                        >
                          {shortReportId(r)}
                        </Link>
                      </td>
                      <td className="max-w-[150px] truncate text-[13px]">
                        {(r as unknown as { creator?: { name?: string } }).creator?.name ?? "—"}
                      </td>
                      <td className="whitespace-nowrap tabular-nums text-[12.5px] text-[#64748B]">{r.date}</td>
                      <td>
                        <TypeBadge value={r.reportType} />
                      </td>
                      <td className="max-w-[170px] truncate text-[13px]">{r.site ? `${r.site.name}` : "—"}</td>
                      <td>
                        <SifCell report={r} />
                      </td>
                      <td>
                        <RouteCell report={r} />
                      </td>
                      <td>
                        <StatusBadge value={r.status} />
                      </td>
                      <td className="text-center">
                        <Link
                          href={`/reports/${r.id}`}
                          aria-label={`View report ${r.reportNumber}`}
                          title={`View ${r.reportNumber}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-[#94A3B8] transition-colors hover:border-[rgba(0,229,255,0.22)] hover:bg-[rgba(0,229,255,0.10)] hover:text-[#00E5FF]"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3.5">
              <button disabled={page <= 1} onClick={() => load(page - 1)} className="button-secondary px-4 text-[13px] disabled:opacity-40">
                Previous
              </button>
              <span className="text-[13px] tabular-nums text-[#64748B]">
                Page {page} of {totalPages} · {total.toLocaleString()} total
              </span>
              <button disabled={page >= totalPages} onClick={() => load(page + 1)} className="button-secondary px-4 text-[13px] disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
  );
}
