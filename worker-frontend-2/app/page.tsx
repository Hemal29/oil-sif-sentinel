"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchNotifications, isUnauthorized, type Notification } from "@/lib/api";
import { logout } from "@/lib/auth";
import { fetchMyReports, fetchWorkerSummary, listDrafts, type WorkerDraft, type WorkerReport, type WorkerSummary } from "@/lib/worker";
import { useWorkerUser, workerErrorMessage } from "@/components/worker/workerGuard";
import { WorkerShell } from "@/components/worker/WorkerShell";
import { StatusBadge } from "@/components/common/Badges";
import { EmptyState, ErrorState } from "@/components/common/States";
import { KpiCard, KpiSkeleton } from "@/components/ui/primitives";
import { AlertIcon, BellIcon, CheckIcon, ClockIcon, DocIcon, EditIcon, InboxIcon, PlusIcon } from "@/components/ui/Icons";

function formatDate(v: string) {
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function formatSaved(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return "Saved just now";
  if (mins < 60) return `Saved ${mins} minute${mins === 1 ? "" : "s"} ago`;
  return `Saved ${d.toLocaleDateString(undefined, { day: "2-digit", month: "short" })}`;
}

function formatAgo(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function WorkerDashboardPage() {
  const router = useRouter();
  const user = useWorkerUser();
  const [summary, setSummary] = useState<WorkerSummary | null>(null);
  const [recent, setRecent] = useState<WorkerReport[]>([]);
  const [drafts, setDrafts] = useState<WorkerDraft[]>([]);
  const [notes, setNotes] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, r, d, n] = await Promise.all([
        fetchWorkerSummary(),
        fetchMyReports({ limit: 5 }),
        listDrafts({ limit: 3 }).catch(() => null),
        fetchNotifications({ limit: 4 }).catch(() => null),
      ]);
      setSummary(s);
      setRecent(r.items);
      setDrafts(d ? d.items : []);
      setNotes(n ? n.items : []);
    } catch (err: unknown) {
      if (isUnauthorized(err)) {
        logout();
        router.push("/login?expired=1");
        return;
      }
      setError(workerErrorMessage(err, "Unable to load your dashboard. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [router]);
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const firstName = user ? user.name.split(" ")[0] : "";

  return (
    <WorkerShell title="Dashboard">
      <div className="space-y-5 sm:space-y-6">
        {/* HERO — wide short horizontal banner: 55% / 45% */}
        <section className="overflow-hidden rounded-[22px] border border-[#E2E8F0] bg-[#FEF3E7] shadow-[0_1px_3px_rgba(15,23,42,0.06)]" aria-label="Welcome">
          <div className="relative grid grid-cols-1 lg:h-[375px] lg:min-h-[360px] lg:max-h-[390px] lg:grid-cols-[55%_45%] lg:overflow-hidden">
            <div className="flex flex-col justify-center px-5 py-8 sm:px-8 lg:px-9 lg:py-7">
              <p className="mb-[18px] text-[15px] font-bold uppercase tracking-[0.18em] text-[#D97706]">Worker Safety Portal</p>
              <h1
                title={`${greeting()}, ${firstName}`}
                className="max-w-full text-[34px] font-extrabold leading-[1.08] tracking-[-0.02em] text-[#0F172A] sm:text-[40px] lg:overflow-hidden lg:text-ellipsis lg:whitespace-nowrap lg:text-[48px] lg:leading-[1.05] lg:tracking-[-0.03em]"
              >
                {greeting()}
                {firstName ? `, ${firstName}` : ""} <span aria-hidden="true">👋</span>
              </h1>
              <p className="mt-3 max-w-[480px] text-[16px] leading-[1.5] text-[#475569] sm:text-[17px] lg:text-[18px]">
                Stay safe. Report unsafe acts, unsafe conditions and near misses.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-center sm:gap-[14px]">
                <Link
                  href="/reports/new"
                  className="button-primary h-[52px] w-full whitespace-nowrap px-5 text-[15px] sm:h-[54px] sm:w-auto sm:min-w-[300px] lg:min-w-[320px]"
                >
                  <PlusIcon className="h-5 w-5 shrink-0" /> <span className="whitespace-nowrap">Report a Safety Observation</span>
                </Link>
                <Link
                  href="/reports"
                  className="button-secondary h-[52px] w-full whitespace-nowrap px-5 text-[15px] sm:h-[54px] sm:w-auto sm:min-w-[185px]"
                >
                  <DocIcon className="h-5 w-5 shrink-0" /> <span className="whitespace-nowrap">View My Reports</span>
                </Link>
              </div>
            </div>
            {/* vertical divider at ~55%, 70% height */}
            <span className="absolute bottom-[15%] left-[55%] top-[15%] hidden w-px bg-[#E2E8F0] lg:block" aria-hidden="true" />
            <div className="relative min-h-[240px] overflow-hidden sm:min-h-[280px] lg:h-[375px] lg:min-h-[360px] lg:max-h-[390px]">
              <Image
                src="/hero-worker.png"
                alt="Safety worker wearing PPE looking over an oil refinery"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover object-[65%_center]"
              />
              {/* subtle white fade on LEFT of image only — worker/refinery on right stay clear */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#FEF3E7]/60 via-transparent to-transparent sm:bg-none" aria-hidden="true" />
              <div
                className="absolute inset-y-0 left-0 w-[64%] bg-gradient-to-r from-[#FEF3E7] via-[#FEF3E7]/85 to-[#FEF3E7]/0"
                aria-hidden="true"
              />
              <div className="relative flex h-full min-h-[240px] flex-col p-5 sm:min-h-[280px] sm:p-7 lg:h-[375px] lg:min-h-[360px] lg:p-7">
                <p className="pr-1 text-right text-[11px] font-bold uppercase leading-[1.7] tracking-[0.25em] text-[#94A3B8] lg:text-[12px]">
                  Safe People
                  <br />
                  Stronger
                  <br />
                  Tomorrow
                </p>
                <div className="mt-auto max-w-[250px] pt-6 sm:max-w-[270px]">
                  <p className="text-[30px] font-extrabold leading-[1.08] tracking-tight text-[#0F172A] sm:text-[33px] lg:text-[34px] lg:leading-[1.05]">
                    Small Observations
                    <br />
                    <span className="text-[#D97706]">Make a Safer Tomorrow</span>
                  </p>
                  <span className="mt-3 block h-[3px] w-9 rounded-full bg-[#D97706]" aria-hidden="true" />
                  <p className="mt-2.5 text-[14px] font-medium text-[#64748B] sm:text-[15px]">See it. Report it. Prevent it.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {!user || loading || !summary ? (
          <>
            {error ? (
              <ErrorState message={error} onRetry={load} />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <KpiSkeleton key={i} />
                ))}
              </div>
            )}
          </>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            {/* KPI CARDS */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4" aria-label="Your summary">
              <KpiCard label="My Reports" value={summary.myReports} hint="Reports submitted" icon={<DocIcon className="h-4 w-4" />} />
              <KpiCard label="Drafts" value={drafts.length} hint="Saved reports" icon={<EditIcon className="h-4 w-4" />} />
              <KpiCard label="Under Review" value={summary.underReview} hint="Awaiting HSE action" icon={<ClockIcon className="h-4 w-4" />} />
              <KpiCard label="Closed" value={summary.closed} hint="Completed reports" icon={<CheckIcon className="h-4 w-4" />} />
            </div>

            {/* RECENT + SIDE */}
            <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-5">
              <section className="panel overflow-hidden xl:col-span-3" aria-label="Recent reports">
                <div className="panel-header">
                  <h2 className="section-title">Recent Reports</h2>
                  <Link href="/reports" className="text-[12.5px] font-semibold text-[#D97706] hover:underline">
                    View all →
                  </Link>
                </div>
                {recent.length === 0 ? (
                  <div className="p-5">
                    <EmptyState
                      message="No reports yet. You haven't submitted any safety observations yet."
                      action={{ label: "Report a Safety Observation", href: "/reports/new" }}
                    />
                  </div>
                ) : (
                  <ul className="divide-y divide-[#EDF1F6]">
                    {recent.map((r) => (
                      <li key={r.id}>
                        <Link href={`/reports/${r.id}`} className="block px-5 py-4 transition-colors hover:bg-[#F8FAFC]">
                          <p className="font-mono text-[12px] font-bold text-[#D97706]">{r.reportNumber}</p>
                          <p className="mt-1 text-[13.5px] font-semibold text-[#0F172A]">
                            {r.reportType.replace(/_/g, " ")} · {r.activity}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-[13px] text-[#64748B]">{r.description}</p>
                          <p className="mt-2 flex items-center justify-between gap-2">
                            <StatusBadge value={r.status} />
                            <span className="text-[12px] tabular-nums text-[#94A3B8]">{formatDate(r.date)}</span>
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="space-y-4 sm:space-y-5 xl:col-span-2">
                <section className="panel" aria-label="Drafts">
                  <div className="panel-header">
                    <h2 className="section-title">Continue your reports</h2>
                    <Link href="/reports" className="text-[12.5px] font-semibold text-[#D97706] hover:underline">
                      All drafts →
                    </Link>
                  </div>
                  <div className="panel-body">
                    {drafts.length === 0 ? (
                      <div className="flex gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#64748B]">
                          <InboxIcon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-[13.5px] font-bold text-[#0F172A]">No saved drafts</p>
                          <p className="mt-0.5 text-[12.5px] text-[#64748B]">Your unfinished reports will appear here.</p>
                        </div>
                      </div>
                    ) : (
                      <ul className="space-y-3">
                        {drafts.map((d) => (
                          <li key={d.id} className="rounded-xl border border-[#E2E8F0] px-4 py-3">
                            <p className="line-clamp-1 text-[13.5px] font-semibold text-[#0F172A]">
                              {d.activity || d.reportType?.replace(/_/g, " ") || "Untitled draft"}
                            </p>
                            <p className="mt-0.5 text-[12px] text-[#64748B]">{formatSaved(d.updatedAt)}</p>
                            <Link href={`/reports/new?draftId=${d.id}`} className="mt-1.5 inline-block text-[12.5px] font-semibold text-[#D97706] hover:underline">
                              Continue →
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>

                <section className="panel" aria-label="Notifications">
                  <div className="panel-header">
                    <h2 className="section-title">Notifications</h2>
                    <Link href="/notifications" className="text-[12.5px] font-semibold text-[#D97706] hover:underline">
                      View all →
                    </Link>
                  </div>
                  <div className="panel-body">
                    {notes.length === 0 ? (
                      <div className="flex gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#64748B]">
                          <BellIcon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-[13.5px] font-bold text-[#0F172A]">You&apos;re all caught up</p>
                          <p className="mt-0.5 text-[12.5px] text-[#64748B]">No new notifications.</p>
                        </div>
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {notes.slice(0, 3).map((n) => (
                          <li key={n.id}>
                            <Link
                              href={n.reportId ? `/reports/${n.reportId}` : "/notifications"}
                              className={`block rounded-xl px-3.5 py-2.5 transition-colors hover:bg-[#F8FAFC] ${!n.isRead ? "bg-[#FEF3E7]" : ""}`}
                            >
                              <p className="flex items-center gap-2 text-[13px] font-semibold text-[#0F172A]">
                                {!n.isRead ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D97706]" aria-label="Unread" /> : null}
                                <span className="line-clamp-1">{n.title}</span>
                              </p>
                              <p className="mt-0.5 line-clamp-1 pl-3.5 text-[12px] text-[#64748B]">{n.message}</p>
                              <p className="mt-0.5 pl-3.5 text-[11px] tabular-nums text-[#94A3B8]">{formatAgo(n.createdAt)}</p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              </div>
            </div>

            {summary.needsInformation > 0 ? (
              <div className="flex gap-3 rounded-2xl border border-[#FBD8A0] bg-[#FEF3E7] p-4 sm:p-5" role="status">
                <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#D97706]" />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-[#0F172A]">
                    {summary.needsInformation} report{summary.needsInformation === 1 ? "" : "s"} need{summary.needsInformation === 1 ? "s" : ""} your attention
                  </p>
                  <p className="mt-0.5 text-[13px] text-[#475569]">The HSE team requested more information. Open the report to read their request.</p>
                  <Link href="/reports" className="mt-1.5 inline-block text-[13px] font-semibold text-[#D97706] hover:underline">
                    View my reports →
                  </Link>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </WorkerShell>
  );
}
