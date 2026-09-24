"use client";
import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type {
  ActivityAnalytic,
  DashboardDistributions,
  DashboardOverview,
  DashboardTrend,
  DatePreset,
  PendingReview,
  RecentReport,
  RuleAnalytic,
  SiteAnalytic,
  TopCount,
} from "@/types/dashboard";
import {
  fetchActivities as fetchActivityAnalytics,
  fetchBarriers,
  fetchDistributions,
  fetchEnergies,
  fetchOverview,
  fetchPendingReviews,
  fetchPrecursorRules,
  fetchRecentReports,
  fetchRules as fetchRuleAnalytics,
  fetchSites as fetchSiteAnalytics,
  fetchTrends,
} from "@/lib/dashboard";
import { fetchActionCenter, fetchReports } from "@/lib/api";
import { apiErrorMessage, logout } from "@/lib/auth";
import { AppShell } from "@/components/common/AppShell";
import { PriorityBadge, SifBadge, StatusBadge } from "@/components/common/Badges";
import { ErrorState } from "@/components/common/States";
import { KpiCard, KpiSkeleton, PageHeader } from "@/components/ui/primitives";
import { AlertIcon, BoltIcon, CheckIcon, ClockIcon, DocIcon } from "@/components/ui/Icons";
import { TrendChart, SiteChart, ActivityChart, RuleChart, PriorityChart, ReportTypePie, SifPie } from "@/components/dashboard/Charts";

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

const ROUTES = ["AUTO_CLOSE", "PRIORITY", "UNCERTAIN", "ABSTAIN"] as const;

function IntelligenceList({ items, emptyText, barColor }: { items: TopCount[]; emptyText: string; barColor: string }) {
  if (items.length === 0) return <p className="py-4 text-center text-[13px] text-[#64748B]">{emptyText}</p>;
  const max = Math.max(1, ...items.slice(0, 6).map((i) => i.count));
  return (
    <ul className="space-y-3.5">
      {items.slice(0, 6).map((i) => (
        <li key={i.name}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate font-medium text-[#CBD5E1]">{i.name}</span>
            <span className="shrink-0 font-bold tabular-nums text-white">{i.count.toLocaleString()}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06] border border-white/[0.04]" role="img" aria-label={`${i.name}: ${i.count}`}>
            <div className="h-full rounded-full" style={{ width: `${(i.count / max) * 100}%`, background: barColor }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  return (
    <AppShell title="Safety Intelligence Dashboard">
      <Suspense>
        <DashboardContent />
      </Suspense>
    </AppShell>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPreset = (searchParams.get("preset") as DatePreset) || "30d";
  const validPreset = (["7d", "30d", "90d", "1y", "all"] as DatePreset[]).includes(initialPreset) ? initialPreset : "30d";
  const [preset, setPreset] = useState<DatePreset>(validPreset);
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [trends, setTrends] = useState<DashboardTrend | null>(null);
  const [dist, setDist] = useState<DashboardDistributions | null>(null);
  const [recent, setRecent] = useState<RecentReport[]>([]);
  const [pending, setPending] = useState<PendingReview[]>([]);
  const [precursor, setPrecursor] = useState<TopCount[]>([]);
  const [barriers, setBarriers] = useState<TopCount[]>([]);
  const [energies, setEnergies] = useState<TopCount[]>([]);
  const [sites, setSites] = useState<SiteAnalytic[]>([]);
  const [activities, setActivities] = useState<ActivityAnalytic[]>([]);
  const [rules, setRules] = useState<RuleAnalytic[]>([]);
  const [routeCounts, setRouteCounts] = useState<{ name: string; count: number }[]>([]);
  const [closedCount, setClosedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const range = dateFrom && dateTo ? { dateFrom, dateTo } : { preset };
    try {
      const [o, t, d, r, p, pr, b, e, s, a, ru] = await Promise.all([
        fetchOverview(range),
        fetchTrends(range),
        fetchDistributions(range),
        fetchRecentReports(range),
        fetchPendingReviews(range),
        fetchPrecursorRules(range),
        fetchBarriers(range),
        fetchEnergies(range),
        fetchSiteAnalytics(range),
        fetchActivityAnalytics(range),
        fetchRuleAnalytics(range),
      ]);
      setOverview(o);
      setTrends(t);
      setDist(d);
      setRecent(r);
      setPending(p.items);
      setPrecursor(pr);
      setBarriers(b);
      setEnergies(e);
      setSites(s);
      setActivities(a);
      setRules(ru);
      // AI route distribution: real totals per route from the action-center API.
      try {
        const totals = await Promise.all(
          ROUTES.map(async (route) => {
            const res = await fetchActionCenter({ route, limit: 1, page: 1 });
            return { name: route, count: res.pagination.total };
          })
        );
        setRouteCounts(totals.filter((x) => x.count > 0));
      } catch {
        setRouteCounts([]);
      }
      // Closed reports: real total from the reports API.
      try {
        const closed = await fetchReports({ status: "CLOSED", limit: 1, page: 1 });
        setClosedCount(closed.pagination.total);
      } catch {
        setClosedCount(null);
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        logout();
        router.push("/login");
        return;
      }
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [preset, dateFrom, dateTo, router]);

  useEffect(() => {
    load();
  }, [load]);
  const useCustom = dateFrom !== "" || dateTo !== "";

  // Reflect the active range in the URL so the header date pill stays in sync.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (useCustom) {
      if (dateFrom) sp.set("dateFrom", dateFrom);
      if (dateTo) sp.set("dateTo", dateTo);
    } else {
      sp.set("preset", preset);
    }
    router.replace(`/dashboard?${sp.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, dateFrom, dateTo]);

  const routeTotal = Math.max(1, ...routeCounts.map((x) => x.count));

  return (
    <div className="space-y-7">
        <PageHeader
          eyebrow="HSE · Dashboard"
          title="Safety Intelligence Dashboard"
          description="Monitor SIF precursors, high-risk observations, reviews and safety trends."
          actions={
            <div className="flex flex-wrap items-center gap-1.5 rounded-[12px] border border-white/[0.08] bg-[#131B24]/80 p-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.45)] backdrop-blur-[8px]" role="group" aria-label="Reporting period">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => {
                    setPreset(p.value);
                    setDateFrom("");
                    setDateTo("");
                  }}
                  aria-pressed={preset === p.value && !useCustom}
                  className={`rounded-[8px] px-3 py-1.5 text-[12.5px] font-semibold transition-all ${
                    preset === p.value && !useCustom ? "bg-[#00E5FF] text-[#080A0E] shadow-[0_0_12px_rgba(0,229,255,0.35)]" : "text-[#94A3B8] hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <span className="mx-1 hidden h-5 w-px bg-white/[0.08] sm:block" aria-hidden="true" />
              <input type="date" aria-label="Start date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="field h-8 px-2 text-[12px]" />
              <span className="text-[12px] text-[#64748B]">to</span>
              <input type="date" aria-label="End date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="field h-8 px-2 text-[12px]" />
            </div>
          }
        />

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading || !overview ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <KpiSkeleton key={i} />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="skeleton h-72 lg:col-span-2" />
              <div className="skeleton h-72" />
            </div>
          </>
        ) : (
          <>
            {/* KPI CARDS */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Key metrics">
              <KpiCard label="Total Reports" value={overview.totalReports} hint="In selected period" icon={<DocIcon className="h-4 w-4" />} />
              <KpiCard label="SIF Potential" value={overview.sifPotential} hint="AI-flagged precursors" icon={<AlertIcon className="h-4 w-4" />} />
              <KpiCard label="Priority Cases" value={overview.highPriority} hint="High / critical priority" icon={<BoltIcon className="h-4 w-4" />} />
              <KpiCard label="Pending Reviews" value={overview.pendingReviews} hint="Awaiting HSE action" icon={<ClockIcon className="h-4 w-4" />} />
              <KpiCard
                label="Closed Reports"
                value={closedCount ?? "—"}
                hint="Review complete"
                icon={<CheckIcon className="h-4 w-4" />}
              />
            </div>

            {/* ANALYTICS ROW 1 */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <TrendChart data={trends} />
              </div>
              <div className="panel h-full">
                <div className="panel-header">
                  <div>
                    <h2 className="section-title">AI Route Distribution</h2>
                    <p className="section-subtitle">Screening outcomes across reports</p>
                  </div>
                </div>
                <div className="panel-body">
                  {routeCounts.length === 0 ? (
                    <p className="py-8 text-center text-[13px] text-[#94A3B8]">No AI screening outcomes yet.</p>
                  ) : (
                    <ul className="space-y-4">
                      {routeCounts.map((r) => (
                        <li key={r.name}>
                          <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
                            <span className="font-semibold uppercase tracking-wide text-[#CBD5E1]">{r.name.replace("_", " ")}</span>
                            <span className="shrink-0 font-bold tabular-nums text-white">
                              {r.count.toLocaleString()}
                              <span className="ml-2 font-medium text-[#94A3B8]">{((r.count / routeTotal) * 100).toFixed(0)}%</span>
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06] border border-white/[0.04]" role="img" aria-label={`${r.name}: ${r.count} reports`}>
                            <div className="h-full rounded-full bg-[#00E5FF]" style={{ width: `${(r.count / routeTotal) * 100}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* ANALYTICS ROW 2 */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <SifPie data={dist} />
              <PriorityChart data={dist} />
              <ReportTypePie data={dist} />
            </div>

            {/* SAFETY INTELLIGENCE */}
            <section aria-label="Safety intelligence">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-[20px] font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-heading)" }}>Safety Intelligence</h2>
                  <p className="mt-1 text-[13px] text-[#94A3B8]">Precursor signals detected across validated safety reports.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <h3 className="section-title">SIF Precursors</h3>
                      <p className="section-subtitle">Top AI primary-rule signals</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    <IntelligenceList items={precursor} emptyText="No precursor signals for this period." barColor="#00E5FF" />
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <h3 className="section-title">Hazard Energies</h3>
                      <p className="section-subtitle">Energies involved in observations</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    <IntelligenceList items={energies} emptyText="No hazard energy data for this period." barColor="#00E5FF" />
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-header">
                    <div>
                      <h3 className="section-title">Failed Barriers</h3>
                      <p className="section-subtitle">Controls that did not hold</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    <IntelligenceList items={barriers} emptyText="No barrier data for this period." barColor="#00E5FF" />
                  </div>
                </div>
              </div>
            </section>

            {/* SITES + ACTIVITIES */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SiteChart items={sites} />
              <ActivityChart items={activities} />
            </div>
            <RuleChart items={rules} />

            {/* REVIEW QUEUE + RECENT */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="panel xl:col-span-1">
                <div className="panel-header">
                  <h2 className="section-title">Review Queue</h2>
                  <Link href="/reviews" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#00E5FF] hover:underline">
                    Open <span aria-hidden="true">→</span>
                  </Link>
                </div>
                <div className="p-0">
                  {pending.length === 0 ? (
                    <p className="px-5 py-8 text-center text-[13px] text-[#64748B]">Queue is clear. No reports awaiting review.</p>
                  ) : (
                    <ul className="divide-y divide-white/[0.06]">
                      {pending.slice(0, 6).map((r) => (
                        <li key={r.reportId}>
                          <Link href={`/reports/${r.reportId}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-white/[0.04]">
                            <span className="min-w-0">
                              <span className="block truncate font-mono text-[12.5px] font-semibold text-[#00E5FF]">{r.reportNumber}</span>
                              <span className="block truncate text-[12px] text-[#94A3B8]">{r.activity}</span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                              <StatusBadge value={r.status} />
                              <PriorityBadge value={r.priority} />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="panel overflow-hidden xl:col-span-2">
                <div className="panel-header">
                  <h2 className="section-title">Recent Reports</h2>
                  <Link href="/reports" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#00E5FF] hover:underline">
                    View all reports <span aria-hidden="true">→</span>
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[760px]">
                    <thead>
                      <tr>
                        <th>Report</th>
                        <th>Site</th>
                        <th>Activity</th>
                        <th>SIF</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-8 text-center text-[13px] text-[#94A3B8]">
                            No reports in this period.
                          </td>
                        </tr>
                      ) : (
                        recent.slice(0, 8).map((r) => (
                          <tr key={r.analysisId ?? r.reportId}>
                            <td>
                              <Link href={`/reports/${r.reportId}`} className="font-mono text-[12.5px] font-semibold text-[#00E5FF] hover:underline">
                                {r.reportNumber}
                              </Link>
                              <span className="block text-[11.5px] text-[#64748B]">{r.date}</span>
                            </td>
                            <td className="max-w-[140px] truncate">{r.siteName}</td>
                            <td className="max-w-[160px] truncate">{r.activity}</td>
                            <td>
                              <SifBadge value={r.sifPotential} />
                            </td>
                            <td>
                              <StatusBadge value={r.status} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <p className="rounded-[12px] border border-white/[0.08] bg-[#131B24]/60 px-4 py-3 text-[11.5px] leading-relaxed text-[#94A3B8] backdrop-blur-[8px]">
              SIF, priority and risk values are automated precursor screening — not injury probabilities and not official OIL methodology. Human HSE review is final.
            </p>
          </>
        )}
      </div>
  );
}
