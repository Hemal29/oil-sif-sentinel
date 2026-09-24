"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { fetchActionCenter, fetchSites, isUnauthorized } from "@/lib/api";
import { apiErrorMessage, logout } from "@/lib/auth";
import type { Site } from "@/types/master";
import { AppShell } from "@/components/common/AppShell";
import { PriorityBadge, SifBadge, StatusBadge, TypeBadge } from "@/components/common/Badges";
import { EmptyState, ErrorState } from "@/components/common/States";
import { KpiCard, KpiSkeleton, PageHeader } from "@/components/ui/primitives";
import { AlertIcon, BoltIcon, ClockIcon, DocIcon, SearchIcon } from "@/components/ui/Icons";
import { useCurrentUser, canReview } from "@/hooks/useCurrentUser";

const REPORT_TYPES = ["UNSAFE_ACT", "UNSAFE_CONDITION", "NEAR_MISS"] as const;
const STATUSES = ["NEW", "ANALYZED", "UNDER_REVIEW", "NEEDS_MORE_INFO", "CONFIRMED", "REJECTED", "CLOSED"] as const;
const ROUTES = ["AUTO_CLOSE", "PRIORITY", "UNCERTAIN", "ABSTAIN"] as const;
const SIFS = ["YES", "NO", "INSUFFICIENT"] as const;

function useDebouncedValue<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function RouteChip({ route }: { route: string | null | undefined }) {
  if (!route) return <span className="text-[12px] text-[#94A3B8]">—</span>;
  const styles: Record<string, string> = {
    PRIORITY: "badge badge-info",
    UNCERTAIN: "badge badge-neutral",
    AUTO_CLOSE: "badge badge-neutral",
    ABSTAIN: "badge badge-neutral",
  };
  return <span className={styles[route] ?? "badge badge-neutral"}>{route}</span>;
}

function ReviewsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useCurrentUser();
  const reviewer = canReview(user);

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [route, setRoute] = useState(searchParams.get("route") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [reportType, setReportType] = useState(searchParams.get("reportType") || "");
  const [siteId, setSiteId] = useState(searchParams.get("siteId") || "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [sif, setSif] = useState(searchParams.get("sifPotential") || "");
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));
  const [sites, setSites] = useState<Site[]>([]);
  const debouncedSearch = useDebouncedValue(search, 400);

  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<{ pendingReview: number; priority: number; uncertainOrAbstain: number; needsInformation: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSites({ limit: 100 })
      .then((r) => setSites(r.items))
      .catch(() => {});
  }, []);

  const load = useCallback(
    async (p = page) => {
      setLoading(true);
      setError("");
      const params: Record<string, string | number | undefined> = { page: p, limit: 20 };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (route) params.route = route;
      if (status) params.status = status;
      if (reportType) params.reportType = reportType;
      if (siteId) params.siteId = siteId;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (sif) params.sifPotential = sif;
      try {
        const res = await fetchActionCenter(params);
        setItems(res.items);
        setTotal(res.pagination.total);
        setTotalPages(Math.max(1, res.pagination.totalPages));
        setPage(res.pagination.page);
        setSummary(res.summary);
        const sp = new URLSearchParams();
        if (debouncedSearch) sp.set("search", debouncedSearch);
        if (route) sp.set("route", route);
        if (status) sp.set("status", status);
        if (reportType) sp.set("reportType", reportType);
        if (siteId) sp.set("siteId", siteId);
        if (dateFrom) sp.set("dateFrom", dateFrom);
        if (dateTo) sp.set("dateTo", dateTo);
        if (sif) sp.set("sifPotential", sif);
        sp.set("page", String(res.pagination.page));
        router.replace(`/reviews?${sp.toString()}`);
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
    [debouncedSearch, route, status, reportType, siteId, dateFrom, dateTo, sif, page, router]
  );

  useEffect(() => {
    load(1);
  }, [debouncedSearch, route, status, reportType, siteId, dateFrom, dateTo, sif]);

  function clearFilters() {
    setSearch("");
    setRoute("");
    setStatus("");
    setReportType("");
    setSiteId("");
    setDateFrom("");
    setDateTo("");
    setSif("");
    setPage(1);
  }
  const hasFilters = search || route || status || reportType || siteId || dateFrom || dateTo || sif;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="HSE · Safety Management"
        title="Review & Action Center"
        description="Review AI-flagged and pending safety reports requiring HSE attention."
      />

      {/* KPI STRIP */}
      {loading && !summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Pending Review" value={summary?.pendingReview ?? 0} hint="Requiring HSE action" accent="amber" icon={<ClockIcon className="h-4 w-4" />} />
          <KpiCard label="Priority" value={summary?.priority ?? 0} hint="Route PRIORITY" accent="red" icon={<BoltIcon className="h-4 w-4" />} />
          <KpiCard label="Uncertain / Abstain" value={summary?.uncertainOrAbstain ?? 0} hint="Requires review" accent="orange" icon={<AlertIcon className="h-4 w-4" />} />
          <KpiCard label="Needs Information" value={summary?.needsInformation ?? 0} hint="Latest NEEDS_MORE_INFO" accent="blue" icon={<DocIcon className="h-4 w-4" />} />
        </div>
      )}

      {/* FILTERS */}
      <div className="filter-bar" role="search" aria-label="Review filters">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Search</span>
          <span className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input type="search" placeholder="Report #, description, activity, equipment" value={search} onChange={(e) => setSearch(e.target.value)} className="field w-full pl-9" aria-label="Search reviews" />
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">AI Route</span>
          <select value={route} onChange={(e) => setRoute(e.target.value)} className="field min-w-[130px]" aria-label="Filter by AI route">
            <option value="">All</option>
            {ROUTES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="field min-w-[150px]" aria-label="Filter by status">
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Type</span>
          <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="field min-w-[150px]" aria-label="Filter by type">
            <option value="">All</option>
            {REPORT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Site</span>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="field min-w-[150px]" aria-label="Filter by site">
            <option value="">All</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">SIF</span>
          <select value={sif} onChange={(e) => setSif(e.target.value)} className="field min-w-[120px]" aria-label="Filter by SIF">
            <option value="">All</option>
            {SIFS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">From</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="field" aria-label="From date" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">To</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="field" aria-label="To date" />
        </label>
        <div className="flex items-end">
          <button onClick={clearFilters} className="button-secondary">
            Clear
          </button>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => load(page)} />
      ) : loading ? (
        <div className="panel overflow-hidden" aria-live="polite" aria-busy="true">
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-12" />
            ))}
          </div>
        </div>
      ) : items.length === 0 ? (
        <EmptyState message={hasFilters ? "No reports match the selected filters." : "No reports currently require HSE review."} />
      ) : (
        <div className="panel overflow-hidden">
          <div className="panel-header">
            <h2 className="section-title">Review Queue</h2>
            <span className="text-[12px] tabular-nums text-[#64748B]">
              Showing {Math.min((page - 1) * 20 + 1, total)}–{Math.min(page * 20, total)} of {total.toLocaleString()}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[1180px]">
              <thead>
                <tr>
                  <th>Report Number</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Activity</th>
                  <th>Site</th>
                  <th>AI Route</th>
                  <th>Risk</th>
                  <th>SIF</th>
                  <th>Status</th>
                  <th>Submitted By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r: any) => {
                  const priority = r.aiAnalysis?.route === "PRIORITY";
                  return (
                    <tr key={r.id} className={priority ? "border-l-2 border-l-[#00E5FF] bg-[rgba(0,229,255,0.06)]" : undefined}>
                      <td className="whitespace-nowrap font-mono text-[12.5px] font-semibold">
                        <Link href={`/reports/${r.id}`} className="inline-flex items-center gap-2 text-[#00E5FF] hover:underline">
                          {priority ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#00E5FF] shadow-[0_0_6px_rgba(0,229,255,0.6)]" aria-label="Priority" /> : null}
                          {r.reportNumber}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap tabular-nums text-[12.5px] text-[#64748B]">{r.date}</td>
                      <td>
                        <TypeBadge value={r.reportType} />
                      </td>
                      <td className="max-w-[160px] truncate text-[13px]">{r.activity}</td>
                      <td className="max-w-[130px] truncate text-[13px]">{r.site ? `${r.site.name}` : "—"}</td>
                      <td>
                        <RouteChip route={r.aiAnalysis?.route} />
                      </td>
                      <td className="tabular-nums text-[13px] font-semibold">
                        {r.aiAnalysis?.riskScore != null ? `${(r.aiAnalysis.riskScore * 100).toFixed(0)}%` : <span className="font-normal text-[#94A3B8]">—</span>}
                      </td>
                      <td>{r.aiAnalysis ? <SifBadge value={r.aiAnalysis.sifPotential} /> : <span className="text-[12px] text-[#94A3B8]">—</span>}</td>
                      <td>
                        <StatusBadge value={r.status} />
                      </td>
                      <td className="max-w-[130px] truncate text-[13px]">{r.creator ? r.creator.name : r.createdBy.slice(0, 8)}</td>
                      <td className="whitespace-nowrap">
                        {reviewer ? (
                          <Link href={`/reports/${r.id}`} className="button-primary h-8 px-3 text-[12px]">
                            Review
                          </Link>
                        ) : (
                          <Link href={`/reports/${r.id}`} className="text-[12.5px] font-semibold text-[#00E5FF] hover:underline">
                            View →
                          </Link>
                        )}{" "}
                        <Link href={`/reports/${r.id}#activity`} className="px-1 text-[12px] font-semibold text-[#00E5FF] hover:underline">
                          Activity
                        </Link>
                      </td>
                    </tr>
                  );
                })}
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

export default function ReviewsPageWrapper() {
  return (
    <AppShell title="Review & Action Center">
      <Suspense
        fallback={
          <div className="p-6">
            <div className="skeleton h-8 w-64" />
          </div>
        }
      >
        <ReviewsContent />
      </Suspense>
    </AppShell>
  );
}
