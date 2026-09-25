"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { isUnauthorized } from "@/lib/api";
import { logout } from "@/lib/auth";
import { fetchMyReport, type WorkerReport } from "@/lib/worker";
import { useWorkerUser, workerErrorMessage } from "@/components/worker/workerGuard";
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { DecisionBadge, PriorityBadge, SifBadge, StatusBadge, TypeBadge } from "@/components/common/Badges";
import { Card, ErrorState, LoadingState, PageHeader } from "@/components/common/States";
import { AnalysisPanel } from "@/components/analysis/AnalysisPanel";

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-b border-slate-100 py-2.5 last:border-0">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-sm text-slate-800 ${mono ? "whitespace-pre-wrap" : ""}`}>{value}</dd>
    </div>
  );
}

function workerStatusLabel(status: string): string {
  switch (status) {
    case "NEW": return "Submitted";
    case "ANALYZED": return "AI assessed — awaiting HSE review";
    case "UNDER_REVIEW": return "Under HSE review";
    case "CLOSED": return "Closed";
    default: return status;
  }
}

interface TimelineStage { label: string; detail: string; done: boolean; current: boolean; }

function buildTimeline(report: WorkerReport): TimelineStage[] {
  const ai = report.aiAnalysis;
  const review = report.latestReview;
  const aiDone = ai?.analysisStatus === "COMPLETED";
  const stages: TimelineStage[] = [
    {
      label: "Submitted",
      detail: report.createdAt ? new Date(report.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : report.date,
      done: true,
      current: report.status === "NEW" && !aiDone,
    },
    {
      label: "AI Assessment",
      detail: aiDone ? `Completed${ai?.route ? ` · ${ai.route.replace("_", " ")}` : ""}` : ai?.analysisStatus === "FAILED" ? "Assessment failed — HSE has been notified" : "Pending",
      done: aiDone,
      current: Boolean(ai && !aiDone) || (report.status === "ANALYZED" && !aiDone),
    },
    {
      label: "HSE Review",
      detail: review?.hseDecision ? review.hseDecision.replace(/_/g, " ") : report.status === "UNDER_REVIEW" ? "In progress" : "Pending",
      done: Boolean(review?.hseDecision),
      current: report.status === "UNDER_REVIEW" && !review?.hseDecision,
    },
    {
      label: "Closed",
      detail: report.status === "CLOSED" ? "Review complete" : "Pending",
      done: report.status === "CLOSED",
      current: false,
    },
  ];
  return stages;
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
      if (isUnauthorized(err)) { logout(); router.push("/login?expired=1"); return; }
      setError(workerErrorMessage(err, "Unable to load your report. Please try again."));
    } finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const timeline = report ? buildTimeline(report) : [];
  const review = report?.latestReview ?? null;

  return (
    <main className="page-canvas">
      <WorkerHeader title="Report Detail" />
      <div className="mx-auto w-[min(100%-2rem,1100px)] space-y-5 py-6">
        <Link href="/worker/reports" className="inline-flex items-center gap-1 text-sm font-semibold text-[#C8791A] hover:underline">
          <span aria-hidden="true">←</span> Back to My Reports
        </Link>

        {!user || loading || !report ? (
          error ? <ErrorState message={error} onRetry={load} /> : <LoadingState message="Loading report…" />
        ) : (
          <>
            <PageHeader
              title={`Report ${report.reportNumber}`}
              description={`${report.date} · ${report.reportType.replace(/_/g, " ")}`}
            />
            <div className="flex flex-wrap gap-2" aria-label="Report classifications">
              <StatusBadge value={report.status} />
              <TypeBadge value={report.reportType} />
              <SifBadge value={report.aiAnalysis?.sifPotential ?? null} />
              <PriorityBadge value={report.aiAnalysis?.priority ?? null} />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
              <div className="space-y-5 lg:col-span-3">
                <Card title="Report Information" subtitle="Details as you submitted them">
                  <dl>
                    <Field label="Report Number" value={report.reportNumber} />
                    <Field label="Type" value={report.reportType.replace(/_/g, " ")} />
                    <Field label="Site" value={report.site ? `${report.site.name}${report.site.code ? ` (${report.site.code})` : ""}` : "—"} />
                    <Field label="Area / Activity" value={report.activity} />
                    {report.location ? <Field label="Location" value={report.location} /> : null}
                    {report.equipment ? <Field label="Equipment / Asset" value={report.equipment} /> : null}
                    <Field label="Date" value={report.date} />
                    <Field
                      label="Submitted"
                      value={report.createdAt ? new Date(report.createdAt).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    />
                  </dl>
                </Card>

                <Card title="Description" subtitle="Your original account — kept unchanged">
                  <blockquote className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-900">
                    {report.description}
                  </blockquote>
                </Card>
              </div>

              <div className="space-y-5 lg:col-span-2">
                <Card title="Current Status" subtitle={workerStatusLabel(report.status)}>
                  <ol className="space-y-0">
                    {timeline.map((s, i) => (
                      <li key={s.label} className="relative flex gap-3 pb-5 last:pb-0">
                        {i < timeline.length - 1 ? (
                          <span className="absolute left-[7px] top-5 h-[calc(100%-1rem)] w-px bg-slate-200" aria-hidden="true" />
                        ) : null}
                        <span
                          className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                            s.done ? "border-green-700 bg-green-700" : s.current ? "border-[#C8791A] bg-white" : "border-slate-300 bg-white"
                          }`}
                          aria-hidden="true"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">
                            {s.label}
                            {s.current ? <span className="ml-2 text-xs font-medium text-[#C8791A]">· current</span> : null}
                          </span>
                          <span className="block text-[13px] text-slate-500">{s.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </Card>

                <Card title="HSE Review" subtitle="Human safety decision — read-only for workers.">
                  {!review ? (
                    <p className="text-sm text-slate-500">
                      {report.status === "CLOSED"
                        ? "This report is closed."
                        : "No HSE decision recorded yet. You will see the outcome here when it is available."}
                    </p>
                  ) : (
                    <dl className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Decision</dt>
                        <dd>{review.hseDecision ? <DecisionBadge value={review.hseDecision} /> : <span className="text-sm text-slate-400">—</span>}</dd>
                      </div>
                      {review.comment ? (
                        <div>
                          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">HSE comment</dt>
                          <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{review.comment}</dd>
                        </div>
                      ) : null}
                      {review.reviewedAt ? (
                        <div>
                          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Reviewed</dt>
                          <dd className="mt-0.5 text-sm text-slate-800">
                            {new Date(review.reviewedAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  )}
                </Card>
              </div>
            </div>

            <Card title="AI Assessment" subtitle="Advisory assessment — you cannot modify it.">
              <AnalysisPanel analysis={report.aiAnalysis ?? null} />
              <p className="mt-3 border-t border-slate-100 pt-3 text-[13px] text-slate-500">
                AI assessment is advisory. Final safety decisions are made by authorized HSE personnel.
              </p>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
