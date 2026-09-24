"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { isUnauthorized } from "@/lib/api";
import { logout } from "@/lib/auth";
import { fetchMyReports, listDrafts, deleteDraft, type WorkerReport, type WorkerDraft } from "@/lib/worker";
import type { ReportStatus, ReportType } from "@/types/report";
import { useWorkerUser, workerErrorMessage } from "@/components/worker/workerGuard";
import { WorkerShell } from "@/components/worker/WorkerShell";
import { AiAssessmentBadge, StatusBadge, TypeBadge } from "@/components/common/Badges";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { Modal, PageHeader } from "@/components/ui/primitives";
import { PlusIcon, SearchIcon } from "@/components/ui/Icons";

const REPORT_TYPES: ReportType[] = ["UNSAFE_ACT", "UNSAFE_CONDITION", "NEAR_MISS"];
const STATUSES: ReportStatus[] = ["NEW", "ANALYZED", "UNDER_REVIEW", "CLOSED"];

type Tab = "all" | "drafts" | "submitted" | "closed";

function formatDate(v: string) {
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export default function WorkerReportsPage() {
  return (
    <WorkerShell title="My Reports">
      <Suspense>
        <WorkerReportsContent />
      </Suspense>
    </WorkerShell>
  );
}

function WorkerReportsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useWorkerUser();
  const [tab, setTab] = useState<Tab>("all");
  const [items, setItems] = useState<WorkerReport[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState("");
  const [reportType, setReportType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [drafts, setDrafts] = useState<WorkerDraft[]>([]);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WorkerDraft | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setError("");
      try {
        let effectiveStatus: ReportStatus | "" = status as ReportStatus | "";
        if (tab === "submitted") effectiveStatus = "";
        else if (tab === "closed") effectiveStatus = "CLOSED";
        const res = await fetchMyReports({
          page: p,
          limit: 15,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(effectiveStatus ? { status: effectiveStatus } : tab === "all" && status ? { status: status as ReportStatus } : {}),
          ...(reportType ? { reportType: reportType as ReportType } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
        });
        let filtered = res.items;
        if (tab === "submitted") filtered = res.items.filter((r) => r.status !== "CLOSED");
        if (tab === "closed") filtered = res.items.filter((r) => r.status === "CLOSED");
        setItems(filtered);
        setTotal(res.pagination.total);
        setTotalPages(Math.max(1, res.pagination.totalPages));
        setPage(res.pagination.page);
      } catch (err: unknown) {
        if (isUnauthorized(err)) {
          logout();
          router.push("/login?expired=1");
          return;
        }
        setError(workerErrorMessage(err, "Unable to load your reports. Please try again."));
      } finally {
        setLoading(false);
      }
    },
    [search, status, reportType, dateFrom, dateTo, router, tab]
  );

  const loadDrafts = useCallback(async () => {
    setDraftLoading(true);
    setDraftError("");
    try {
      const res = await listDrafts({ limit: 50 });
      setDrafts(res.items);
    } catch (err: unknown) {
      if (isUnauthorized(err)) {
        logout();
        router.push("/login?expired=1");
        return;
      }
      setDraftError(workerErrorMessage(err, "Unable to load drafts."));
    } finally {
      setDraftLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (user) {
      if (tab === "drafts") loadDrafts();
      else load(1);
    }
  }, [user, tab, load, loadDrafts]);
  // Header search navigates here with ?search=
  useEffect(() => {
    const q = searchParams.get("search") || "";
    setSearch((prev) => (prev === q ? prev : q));
  }, [searchParams]);
  useEffect(() => {
    if (tab === "drafts" && user) loadDrafts();
  }, [tab, user, loadDrafts]);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    load(1);
  }
  function clear() {
    setSearch("");
    setStatus("");
    setReportType("");
    setDateFrom("");
    setDateTo("");
  }

  async function handleDeleteDraft() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteDraft(deleteTarget.id);
      setDrafts((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      setDraftError(workerErrorMessage(err, "Unable to delete draft."));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
      <div className="space-y-4 sm:space-y-5">
        <PageHeader
          eyebrow="Worker · Safety Reporting"
          title="My Reports"
          description="Track the safety observations you have submitted."
          actions={
            <Link href="/reports/new" className="button-primary">
              <PlusIcon className="h-4 w-4" /> New Report
            </Link>
          }
        />

        <div className="flex gap-1 overflow-x-auto rounded-[12px] border border-white/5 bg-[#151C26] p-1.5" role="tablist" aria-label="Report views">
          {(["all", "drafts", "submitted", "closed"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-[13.5px] font-semibold transition-colors ${tab === t ? "bg-white text-[#0A0D12]" : "text-white/40 hover:bg-white/[0.04] hover:text-white"}`}
            >
              {t === "all" ? "All" : t === "drafts" ? "Drafts" : t === "submitted" ? "Submitted" : "Closed"}
            </button>
          ))}
        </div>

        {!user ? (
          <LoadingState message="Loading reports…" />
        ) : tab === "drafts" ? (
          draftError ? (
            <ErrorState message={draftError} onRetry={loadDrafts} />
          ) : draftLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="panel space-y-2 p-5">
                  <div className="skeleton h-4 w-1/2" />
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-9 w-32" />
                </div>
              ))}
            </div>
          ) : drafts.length === 0 ? (
            <EmptyState message="No saved drafts. Your unfinished reports will appear here." action={{ label: "New Report", href: "/reports/new" }} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {drafts.map((d) => (
                <article key={d.id} className="panel flex flex-col p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="badge badge-neutral">Draft</span>
                    <span className="font-mono text-[11.5px] tabular-nums text-white/30">
                      {d.updatedAt ? new Date(d.updatedAt).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                  <p className="mt-2.5 text-[14px] font-bold text-white">{d.activity || d.reportType?.replace(/_/g, " ") || "Untitled draft"}</p>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-white/45">{d.description || "No description yet."}</p>
                  <div className="mt-4 flex gap-2 border-t border-white/5 pt-3.5">
                    <Link href={`/reports/new?draftId=${d.id}`} className="button-primary h-10 flex-1 px-4 text-[13px]">
                      Continue
                    </Link>
                    <button onClick={() => setDeleteTarget(d)} className="button-secondary h-10 px-4 text-[13px]">
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : error ? (
          <ErrorState message={error} onRetry={() => load(page)} />
        ) : (
          <>
            <form onSubmit={apply} className="filter-bar" aria-label="Filters">
              <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/35">Search</span>
                <span className="relative">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                  <input type="search" placeholder="Search my reports..." value={search} onChange={(e) => setSearch(e.target.value)} className="field w-full pl-9" aria-label="Search my reports" />
                </span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/35">Status</span>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="field min-w-[140px]" aria-label="Filter by status">
                  <option value="">All statuses</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/35">Type</span>
                <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="field min-w-[150px]" aria-label="Filter by type">
                  <option value="">All types</option>
                  {REPORT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/35">From</span>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="field" aria-label="From date" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/35">To</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="field" aria-label="To date" />
              </label>
              <div className="flex items-end gap-2">
                <button type="submit" className="button-primary">
                  Apply
                </button>
                <button type="button" onClick={clear} className="button-secondary">
                  Clear
                </button>
              </div>
            </form>
            {loading ? (
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="panel space-y-2 p-5">
                    <div className="skeleton h-4 w-1/3" />
                    <div className="skeleton h-3 w-full" />
                    <div className="skeleton h-3 w-2/3" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState message="No reports yet. When you submit a safety observation, it will appear here." action={{ label: "Submit Your First Report", href: "/reports/new" }} />
            ) : (
              <>
                {/* Mobile cards */}
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:hidden">
                  {items.map((r) => (
                    <li key={r.id}>
                      <Link href={`/reports/${r.id}`} className="block rounded-2xl border border-white/5 bg-[#151C26] p-5 transition-colors hover:border-[rgba(0,229,255,0.22)] hover:bg-white/[0.02]">
                        <p className="font-mono text-[12.5px] font-bold text-[#00E5FF]">{r.reportNumber}</p>
                        <p className="mt-1.5 text-[14px] font-bold text-white">
                          {r.reportType.replace(/_/g, " ")} · {r.activity}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-white/45">“{r.description}”</p>
                        <p className="mt-3 flex items-center justify-between gap-2">
                          <StatusBadge value={r.status} />
                          <span className="font-mono text-[12px] tabular-nums text-white/30">{formatDate(r.date)}</span>
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
                {/* Desktop table */}
                <div className="panel hidden overflow-hidden xl:block">
                  <div className="overflow-x-auto">
                    <table className="data-table min-w-[720px]">
                      <thead>
                        <tr>
                          <th>Report Number</th>
                          <th>Type</th>
                          <th>Site</th>
                          <th>Date</th>
                          <th>Status</th>
                          <th>AI Assessment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((r) => (
                          <tr key={r.id}>
                            <td className="whitespace-nowrap font-mono text-[12.5px] font-semibold">
                              <Link href={`/reports/${r.id}`} className="text-[#00E5FF] hover:underline">
                                {r.reportNumber}
                              </Link>
                            </td>
                            <td>
                              <TypeBadge value={r.reportType} />
                            </td>
                            <td className="max-w-[150px] truncate text-white/70">
                              {r.site ? `${r.site.name}${r.site.code ? ` (${r.site.code})` : ""}` : "—"}
                            </td>
                            <td className="whitespace-nowrap font-mono tabular-nums text-white/40">{formatDate(r.date)}</td>
                            <td>
                              <StatusBadge value={r.status} />
                            </td>
                            <td>
                              <AiAssessmentBadge report={r as unknown as { status: string; aiAnalysis?: { sifPotential: boolean | null; analysisStatus?: string } | null }} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/5 px-5 py-3.5">
                    <button disabled={page <= 1} onClick={() => load(page - 1)} className="button-secondary px-4 text-[13px] disabled:opacity-40">
                      Previous
                    </button>
                    <span className="font-mono text-[13px] tabular-nums text-white/40">
                      Page {page} of {totalPages} · {total.toLocaleString()} total
                    </span>
                    <button disabled={page >= totalPages} onClick={() => load(page + 1)} className="button-secondary px-4 text-[13px] disabled:opacity-40">
                      Next
                    </button>
                  </div>
                </div>
                {/* Mobile pagination */}
                <div className="flex items-center justify-between xl:hidden">
                  <button disabled={page <= 1} onClick={() => load(page - 1)} className="button-secondary px-4 text-[13px] disabled:opacity-40">
                    Previous
                  </button>
                  <span className="font-mono text-[13px] tabular-nums text-white/40">
                    Page {page} of {totalPages}
                  </span>
                  <button disabled={page >= totalPages} onClick={() => load(page + 1)} className="button-secondary px-4 text-[13px] disabled:opacity-40">
                    Next
                  </button>
                </div>
              </>
            )}
          </>
        )}
      {deleteTarget ? (
        <Modal title="Delete draft?" description="This unfinished report will be permanently removed." onClose={() => setDeleteTarget(null)}>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="button-secondary">
              Cancel
            </button>
            <button onClick={handleDeleteDraft} disabled={deleting} className="button-primary bg-[#EF4444] border-[#EF4444] text-white hover:bg-[#DC2626] disabled:opacity-50">
              {deleting ? "Deleting…" : "Delete Draft"}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
