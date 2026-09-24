"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { isUnauthorized } from "@/lib/api";
import { logout } from "@/lib/auth";
import { fetchMyReport, type WorkerReport } from "@/lib/worker";
import { useWorkerUser, workerErrorMessage } from "@/components/worker/workerGuard";
import { WorkerShell } from "@/components/worker/WorkerShell";
import { DecisionBadge, SifBadge, StatusBadge, TypeBadge, PriorityBadge } from "@/components/common/Badges";
import { ErrorState, LoadingState } from "@/components/common/States";
import { AnalysisPanel } from "@/components/analysis/AnalysisPanel";
import { ActivityHistory } from "@/components/activity/ActivityHistory";
import { AlertIcon, BackIcon } from "@/components/ui/Icons";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/5 py-3 last:border-0">
      <dt className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-white/30">{label}</dt>
      <dd className="mt-1 text-[13.5px] text-white">{value}</dd>
    </div>
  );
}
function statusLabel(s: string) {
  switch (s) {
    case "NEW":
      return "Submitted";
    case "ANALYZED":
      return "AI assessed — awaiting HSE review";
    case "UNDER_REVIEW":
      return "Under HSE review";
    case "CLOSED":
      return "Closed";
    default:
      return s;
  }
}
function buildTimeline(report: WorkerReport) {
  const ai = (report as unknown as { aiAnalysis?: { route?: string; analysisStatus?: string } | null }).aiAnalysis;
  const review = (report as unknown as { latestReview?: { hseDecision?: string | null } | null }).latestReview;
  const aiDone = ai?.analysisStatus === "COMPLETED";
  const isAutoClose = ai?.route === "AUTO_CLOSE" && aiDone && report.status === "CLOSED" && !review;
  return [
    { label: "Submitted", detail: report.createdAt ? new Date(report.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : report.date, done: true, current: report.status === "NEW" && !aiDone },
    { label: "AI Assessment", detail: aiDone ? `Completed${ai?.route ? ` · ${ai.route.replace("_", " ")}` : ""}` : ai?.analysisStatus === "FAILED" ? "Failed — HSE notified" : "Pending", done: aiDone, current: Boolean(ai && !aiDone) },
    { label: "HSE Review", detail: isAutoClose ? "Automatically closed — no review required" : review?.hseDecision ? review.hseDecision.replace(/_/g, " ") : report.status === "UNDER_REVIEW" ? "In progress" : report.status === "CLOSED" && aiDone ? "Not required" : "Pending", done: Boolean(review?.hseDecision) || isAutoClose, current: report.status === "UNDER_REVIEW" && !review?.hseDecision && !isAutoClose },
    { label: "Closed", detail: report.status === "CLOSED" ? (isAutoClose ? "Automatically closed by SIF screening" : "Review complete") : "Pending", done: report.status === "CLOSED", current: false },
  ];
}
export default function WorkerReportDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const user = useWorkerUser();
  const [report, setReport] = useState<WorkerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchMyReport(id);
      setReport(res.report);
    } catch (err: unknown) {
      if (isUnauthorized(err)) {
        logout();
        router.push("/login?expired=1");
        return;
      }
      setError(workerErrorMessage(err, "Unable to load your report. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [id, router]);
  useEffect(() => {
    if (user) load();
  }, [user, load]);
  const timeline = report ? buildTimeline(report) : [];
  const review = (report as unknown as { latestReview?: { hseDecision?: string | null; comment?: string | null; reviewedAt?: string | null } | null } | null)?.latestReview ?? null;
  const needsInfo = review?.hseDecision === "NEEDS_MORE_INFO" && report?.status !== "CLOSED";

  return (
    <WorkerShell title="Report Detail">
      <div className="space-y-4 sm:space-y-5">
        <Link href="/reports" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#00E5FF] hover:underline">
          <BackIcon className="h-4 w-4" /> Back to My Reports
        </Link>
        {!user || loading || !report ? (
          error ? (
            <ErrorState message={error} onRetry={load} />
          ) : (
            <LoadingState message="Loading report…" />
          )
        ) : (
          <>
            {needsInfo ? (
              <div className="flex gap-3 rounded-2xl border border-[rgba(0,229,255,0.18)] bg-[rgba(0,229,255,0.06)] p-4 sm:p-5" role="status">
                <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#00E5FF]" />
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-white">More information requested</p>
                  <p className="mt-0.5 text-[13px] text-white/60">The HSE team needs additional information about this report.</p>
                  {review?.comment ? (
                    <div className="mt-2.5 rounded-xl border border-[rgba(0,229,255,0.18)] bg-[#0A0D12] px-3.5 py-2.5">
                      <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/35">HSE Request</p>
                      <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-white">{review.comment}</p>
                    </div>
                  ) : null}
                  <a href="#hse-review" className="mt-2 inline-block text-[13px] font-semibold text-[#00E5FF] hover:underline">
                    View Request →
                  </a>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/5 bg-[#151C26] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.35)] sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-mono text-[19px] font-bold tracking-tight text-white sm:text-[21px]">{report.reportNumber}</h1>
                <TypeBadge value={report.reportType} />
                <StatusBadge value={report.status} />
              </div>
              <p className="mt-1.5 font-mono text-[13px] text-white/40">
                {report.date} · {report.reportType.replace(/_/g, " ")}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <SifBadge value={report.aiAnalysis?.sifPotential ?? null} />
                <PriorityBadge value={report.aiAnalysis?.priority ?? null} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-5">
              <div className="space-y-4 sm:space-y-5 lg:col-span-3">
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2 className="section-title">Report Information</h2>
                      <p className="section-subtitle">As you submitted</p>
                    </div>
                  </div>
                  <div className="panel-body grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                    <Field label="Report Number" value={report.reportNumber} />
                    <Field label="Type" value={report.reportType.replace(/_/g, " ")} />
                    <Field label="Site" value={report.site ? `${report.site.name}${report.site.code ? ` (${report.site.code})` : ""}` : "—"} />
                    <Field label="Area / Activity" value={report.activity} />
                    {report.location ? <Field label="Location" value={report.location} /> : null}
                    {report.equipment ? <Field label="Equipment / Asset" value={report.equipment} /> : null}
                    <Field label="Date" value={report.date} />
                    <Field label="Submitted" value={report.createdAt ? new Date(report.createdAt).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"} />
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2 className="section-title">Observation</h2>
                      <p className="section-subtitle">Your original account — unchanged</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    <blockquote className="whitespace-pre-wrap rounded-xl border border-white/5 border-l-2 border-l-[#00E5FF] bg-[#0A0D12] px-4 py-3.5 text-[14px] leading-relaxed text-white/80">
                      {report.description}
                    </blockquote>
                  </div>
                </section>
              </div>
              <div className="space-y-4 sm:space-y-5 lg:col-span-2">
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2 className="section-title">Current Status</h2>
                      <p className="section-subtitle">{statusLabel(report.status)}</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    <ol className="timeline">
                      {timeline.map((s, i) => (
                        <li key={s.label} className="timeline-item">
                          {i < timeline.length - 1 ? <span className="timeline-line" aria-hidden="true" /> : null}
                          <span className={`timeline-dot ${s.done ? "done" : s.current ? "current" : ""}`} aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-semibold text-white">
                              {s.label} {s.current ? <span className="font-mono text-[11px] font-medium text-[#00E5FF]">· current</span> : null}
                            </span>
                            <span className="block text-[12.5px] text-white/45">{s.detail}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </section>
                <section className="panel" id="hse-review">
                  <div className="panel-header">
                    <div>
                      <h2 className="section-title">HSE Review</h2>
                      <p className="section-subtitle">Read-only</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    {!review && report.status === "CLOSED" && report.aiAnalysis?.route === "AUTO_CLOSE" ? (
                      <div className="rounded-xl border border-[rgba(16,185,129,0.20)] bg-[rgba(16,185,129,0.08)] px-4 py-3.5">
                        <p className="text-[13.5px] font-semibold text-[#6EE7B7]">Automatically closed by SIF screening</p>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-[#6EE7B7]/80">No SIF precursor signal. No human review was required.</p>
                      </div>
                    ) : !review ? (
                      <p className="text-[13.5px] text-white/40">{report.status === "CLOSED" ? "This report is closed." : "No HSE decision recorded yet. You will see the outcome here."}</p>
                    ) : (
                      <dl className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">Decision</dt>
                          <dd>{review.hseDecision ? <DecisionBadge value={review.hseDecision} /> : <span className="text-[13px] text-white/25">—</span>}</dd>
                        </div>
                        {review.comment ? (
                          <div className="rounded-xl bg-[#0A0D12] border border-white/5 px-3.5 py-2.5">
                            <dt className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">HSE comment</dt>
                            <dd className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-white/80">{review.comment}</dd>
                          </div>
                        ) : null}
                        {review.reviewedAt ? (
                          <div>
                            <dt className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">Reviewed</dt>
                            <dd className="mt-1 font-mono text-[13.5px] text-white/80">{new Date(review.reviewedAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}</dd>
                          </div>
                        ) : null}
                      </dl>
                    )}
                  </div>
                </section>
              </div>
            </div>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="section-title">Activity History</h2>
                  <p className="section-subtitle">What happened to your report — newest first</p>
                </div>
              </div>
              <div className="panel-body">
                <ActivityHistory reportId={report.id} currentUserId={user?.id} />
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="section-title">Safety Assessment</h2>
                  <p className="section-subtitle">Automated screening — you cannot modify it</p>
                </div>
              </div>
              <div className="panel-body">
                <AnalysisPanel analysis={report.aiAnalysis ?? null} />
                <p className="mt-3 border-t border-white/5 pt-3 font-mono text-[11.5px] text-white/25">
                  Automated assessment is decision support and requires HSE review. Final safety decisions are made by authorized HSE personnel.
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </WorkerShell>
  );
}
