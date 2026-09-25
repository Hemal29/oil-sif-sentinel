"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { analyzeReport, fetchReportById, isUnauthorized } from "@/lib/api";
import { apiErrorMessage, logout } from "@/lib/auth";
import type { SafetyReport } from "@/types/report";
import { AppShell } from "@/components/common/AppShell";
import { PriorityBadge, SifBadge, StatusBadge, TypeBadge } from "@/components/common/Badges";
import { ErrorState, LoadingState } from "@/components/common/States";
import { AnalysisPanel } from "@/components/analysis/AnalysisPanel";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { ActivityHistory } from "@/components/audit/ActivityHistory";
import { BackIcon, BoltIcon } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/primitives";

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-b border-[#EFEADF] py-3 last:border-0">
      <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B7385]">{label}</dt>
      <dd className={`mt-1 text-[13.5px] text-[#14283F] ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function RouteBadge({ route }: { route: string | null | undefined }) {
  if (!route) return <span className="badge badge-neutral">Not screened</span>;
  const styles: Record<string, string> = {
    PRIORITY: "badge badge-info",
    UNCERTAIN: "badge badge-neutral",
    AUTO_CLOSE: "badge badge-neutral",
    ABSTAIN: "badge badge-neutral",
  };
  return <span className={styles[route] ?? "badge badge-neutral"}>{route.replace("_", " ")}</span>;
}

function CaseTimeline({ report }: { report: SafetyReport & { latestReview?: { hseDecision?: string | null } | null } }) {
  const ai = report.aiAnalysis;
  const review = report.latestReview ?? null;
  const aiDone = ai?.analysisStatus === "COMPLETED";
  const isAutoClose = ai?.route === "AUTO_CLOSE" && aiDone && report.status === "CLOSED" && !review;
  const stages = [
    {
      label: "Submitted",
      detail: report.createdAt
        ? new Date(report.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
        : report.date,
      done: true,
      current: report.status === "NEW" && !aiDone,
    },
    {
      label: "AI Assessment",
      detail: aiDone ? `Completed${ai?.route ? ` · ${ai.route.replace("_", " ")}` : ""}` : ai?.analysisStatus === "FAILED" ? "Failed — HSE notified" : "Pending",
      done: aiDone,
      current: Boolean(ai && !aiDone),
    },
    {
      label: "HSE Review",
      detail: isAutoClose
        ? "Automatically closed — no review required"
        : review?.hseDecision
          ? review.hseDecision.replace(/_/g, " ")
          : report.status === "UNDER_REVIEW"
            ? "In progress"
            : report.status === "CLOSED" && aiDone
              ? "Not required"
              : "Pending",
      done: Boolean(review?.hseDecision) || isAutoClose,
      current: report.status === "UNDER_REVIEW" && !review?.hseDecision && !isAutoClose,
    },
    {
      label: "Closed",
      detail: report.status === "CLOSED" ? (isAutoClose ? "Automatically closed by SIF screening" : "Review complete") : "Pending",
      done: report.status === "CLOSED",
      current: false,
    },
  ];
  return (
    <ol className="timeline">
      {stages.map((s, i) => (
        <li key={s.label} className="timeline-item">
          {i < stages.length - 1 ? <span className="timeline-line" aria-hidden="true" /> : null}
          <span className={`timeline-dot ${s.done ? "done" : s.current ? "current" : ""}`} aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold text-[#14283F]">
              {s.label} {s.current ? <span className="text-[11px] font-medium text-[#C8791A]">· current</span> : null}
            </span>
            <span className="block text-[12.5px] text-[#6B7385]">{s.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [report, setReport] = useState<SafetyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [confirmScreen, setConfirmScreen] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchReportById(id);
      setReport(res.report);
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

  async function onAnalyze() {
    if (analyzing) return;
    setAnalyzing(true);
    setMsg(null);
    try {
      await analyzeReport(id);
      setMsg({ kind: "ok", text: "Precursor screening completed." });
      await load();
    } catch (err: unknown) {
      setMsg({ kind: "err", text: apiErrorMessage(err) });
    } finally {
      setAnalyzing(false);
    }
  }
  function onRequestAnalyze() {
    setConfirmScreen(true);
  }
  async function onConfirmAnalyze() {
    setConfirmScreen(false);
    await onAnalyze();
  }

  return (
    <AppShell title="Report Detail">
      <div className="space-y-5">
        <Link href="/reports" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#C8791A] hover:underline">
          <BackIcon className="h-4 w-4" /> Back to Reports
        </Link>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading || !report ? (
          <LoadingState message="Loading report…" />
        ) : (
          <>
            {/* HEADER CARD */}
            <div className="rounded-2xl border border-[#E7E1D4] bg-white p-5 shadow-[0_1px_2px_rgba(20,40,63,0.05)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-mono text-[22px] font-bold tracking-tight text-[#14283F] sm:text-[24px]">{report.reportNumber}</h1>
                    <TypeBadge value={report.reportType} />
                    <StatusBadge value={report.status} />
                  </div>
                  <p className="mt-2 text-[13px] text-[#6B7385]">
                    {report.date} · {report.site ? `${report.site.name}${report.site.code ? ` (${report.site.code})` : ""}` : "—"} · {report.activity}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <SifBadge value={report.aiAnalysis?.sifPotential ?? null} />
                    <PriorityBadge value={report.aiAnalysis?.priority ?? null} />
                    <RouteBadge route={report.aiAnalysis?.route} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={onRequestAnalyze} disabled={analyzing} className="button-primary disabled:opacity-50">
                    <BoltIcon className="h-4 w-4" />
                    {analyzing ? "Screening…" : "Run Screening"}
                  </button>
                  {report.status !== "CLOSED" ? (
                    <a href="#hse-review" className="button-secondary">
                      Review
                    </a>
                  ) : null}
                </div>
              </div>
              {msg ? (
                <p
                  className={`mt-4 rounded-xl border px-4 py-2.5 text-[13px] font-medium ${
                    msg.kind === "ok" ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]" : "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
                  }`}
                >
                  {msg.text}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
              {/* LEFT — report information */}
              <div className="space-y-5 lg:col-span-3">
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2 className="section-title">Report Information</h2>
                      <p className="section-subtitle">As submitted by the worker</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                      <Field label="Report Number" value={report.reportNumber} mono />
                      <Field label="Report Type" value={report.reportType.replace(/_/g, " ")} />
                      <Field label="Date" value={report.date} />
                      <Field label="Site" value={report.site ? `${report.site.name}${report.site.code ? ` (${report.site.code})` : ""}` : "—"} />
                      <Field label="Area / Activity" value={report.activity} />
                      <Field label="Equipment / Asset" value={report.equipment ?? "—"} />
                      <Field label="Location" value={report.location ?? "—"} />
                      <Field label="Language" value={report.language} />
                      <Field label="Source File" value={report.sourceFile ?? "—"} />
                      <Field
                        label="Submitted By"
                        value={(report as unknown as { creator?: { name?: string; email?: string } }).creator ? `${(report as unknown as { creator: { name: string; email: string } }).creator.name} (${(report as unknown as { creator: { name: string; email: string } }).creator.email})` : report.createdBy}
                      />
                    </dl>
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2 className="section-title">Observation</h2>
                      <p className="section-subtitle">Original worker description — immutable evidence</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    <blockquote className="whitespace-pre-wrap rounded-xl border border-[#E7E1D4] border-l-4 border-l-[#14283F] bg-[#FAF8F4] px-5 py-4 text-[14px] leading-relaxed text-[#14283F]">
                      {report.description}
                    </blockquote>
                  </div>
                </section>
                <section className="panel" id="activity">
                  <div className="panel-header">
                    <div>
                      <h2 className="section-title">Activity History</h2>
                      <p className="section-subtitle">Immutable audit trail — newest first</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    <ActivityHistory reportId={report.id} />
                  </div>
                </section>
              </div>

              {/* RIGHT — AI + review + status */}
              <div className="space-y-5 lg:col-span-2">
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2 className="section-title">Safety Intelligence Assessment</h2>
                      <p className="section-subtitle">Automated precursor screening</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    <AnalysisPanel analysis={report.aiAnalysis ?? null} />
                  </div>
                </section>
                <section className="panel" id="hse-review">
                  <div className="panel-header">
                    <div>
                      <h2 className="section-title">HSE Review</h2>
                      <p className="section-subtitle">Human decision — final authority</p>
                    </div>
                  </div>
                  <div className="panel-body">
                    {report.status === "CLOSED" && report.aiAnalysis?.route === "AUTO_CLOSE" && !(report as unknown as { latestReview?: unknown }).latestReview ? (
                      <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3.5">
                        <p className="text-[13.5px] font-semibold text-[#15803D]">Automatically closed by SIF screening</p>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-[#15803D]">Route AUTO_CLOSE — no SIF precursor signal. No human review was required.</p>
                      </div>
                    ) : report.status === "CLOSED" ? (
                      <p className="text-[13.5px] text-[#6B7385]">This report is closed — workflow complete.</p>
                    ) : (
                      <ReviewForm reportId={report.id} closed={false} onSubmitted={() => load()} />
                    )}
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-header">
                    <h2 className="section-title">Case Status</h2>
                  </div>
                  <div className="panel-body">
                    <CaseTimeline report={report} />
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </div>
      {confirmScreen ? (
        <Modal title="Run precursor screening?" description="The AI engine will assess this report for SIF precursors. Existing results will be replaced." onClose={() => setConfirmScreen(false)}>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmScreen(false)} className="button-secondary">
              Cancel
            </button>
            <button onClick={onConfirmAnalyze} className="button-primary">
              Run Screening
            </button>
          </div>
        </Modal>
      ) : null}
    </AppShell>
  );
}
