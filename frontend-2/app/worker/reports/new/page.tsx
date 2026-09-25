"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchSites, isUnauthorized } from "@/lib/api";
import { logout } from "@/lib/auth";
import { createWorkerReport, type CreateWorkerReportPayload } from "@/lib/worker";
import type { ReportType, SafetyReport } from "@/types/report";
import { useWorkerUser, workerErrorMessage } from "@/components/worker/workerGuard";
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { Card, ErrorState, LoadingState, PageHeader } from "@/components/common/States";

const REPORT_TYPE_OPTIONS: { value: ReportType; label: string; hint: string }[] = [
  { value: "UNSAFE_ACT", label: "Unsafe Act", hint: "An unsafe action by a person" },
  { value: "UNSAFE_CONDITION", label: "Unsafe Condition", hint: "An unsafe workplace condition" },
  { value: "NEAR_MISS", label: "Near Miss", hint: "An incident that nearly caused harm" },
];

interface SiteOption { id: string; name: string; code: string | null; }

const inputCls = "field w-full px-3 py-2 text-sm";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";
const errorCls = "mt-1 text-[13px] text-red-700";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function WorkerSubmitPage() {
  const router = useRouter();
  const user = useWorkerUser();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [sitesError, setSitesError] = useState(false);

  const [reportType, setReportType] = useState<ReportType | "">("");
  const [siteId, setSiteId] = useState("");
  const [activity, setActivity] = useState("");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [equipment, setEquipment] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [created, setCreated] = useState<SafetyReport | null>(null);

  useEffect(() => {
    fetchSites({ limit: 100 })
      .then((d) => setSites(d.items.map((s) => ({ id: s.id, name: s.name, code: s.code }))))
      .catch(() => setSitesError(true));
  }, []);

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!reportType) next.reportType = "Report type is required.";
    if (!siteId) next.site = "Please select a site.";
    if (!activity.trim()) next.activity = "Please enter the area or activity.";
    if (!date) next.date = "Please select a date.";
    else if (date > todayISO()) next.date = "Date cannot be in the future.";
    const desc = description.trim();
    if (!desc) next.description = "Please provide a description.";
    else if (desc.length < 20) next.description = "Description must contain meaningful information.";
    return next;
  }

  async function submit() {
    if (submitting) return;
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const first = document.querySelector<HTMLElement>("[data-error='true'] input, [data-error='true'] select, [data-error='true'] textarea");
      first?.focus();
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    const payload: CreateWorkerReportPayload = {
      date,
      siteId,
      activity: activity.trim(),
      reportType: reportType as ReportType,
      description: description.trim(),
      ...(equipment.trim() ? { equipment: equipment.trim() } : {}),
    };
    try {
      const res = await createWorkerReport(payload);
      setCreated(res.report);
      window.scrollTo({ top: 0 });
    } catch (err: unknown) {
      if (isUnauthorized(err)) { logout(); router.push("/login?expired=1"); return; }
      setSubmitError(workerErrorMessage(err, "Unable to submit your report. Please try again."));
    } finally { setSubmitting(false); }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submit();
  }

  if (!user) {
    return (
      <main className="page-canvas">
        <WorkerHeader title="Submit Safety Report" />
        <div className="mx-auto w-[min(100%-2rem,1100px)] py-6"><LoadingState message="Loading…" /></div>
      </main>
    );
  }

  if (created) {
    return (
      <main className="page-canvas">
        <WorkerHeader title="Submit Safety Report" />
        <div className="mx-auto w-[min(100%-2rem,720px)] py-6">
          <section className="panel p-6 sm:p-8" aria-live="polite">
            <p className="eyebrow">Submission received</p>
            <h1 className="page-title mt-2">Report submitted successfully</h1>
            <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Report number</dt>
                <dd className="font-semibold text-slate-900">{created.reportNumber}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Status</dt>
                <dd className="font-semibold text-slate-900">Submitted</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-slate-600">Your report has been submitted for assessment.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href={`/worker/reports/${created.id}`} className="button-primary px-4 py-2 text-sm">View Report</Link>
              <Link href="/worker" className="button-secondary px-4 py-2 text-sm">Back to Dashboard</Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page-canvas">
      <WorkerHeader title="Submit Safety Report" />
      <div className="mx-auto w-[min(100%-2rem,720px)] py-6">
        <PageHeader
          title="Submit Safety Report"
          description="Provide the facts you observed. Do not worry about determining the risk level yourself."
        />

        <form onSubmit={onSubmit} noValidate className="mt-5 space-y-5" aria-label="Submit safety report">
          {submitError ? <ErrorState message={submitError} onRetry={() => submit()} /> : null}

          <Card title="Report Type" subtitle="Select the category that best fits your observation.">
            <div role="radiogroup" aria-label="Report type" aria-required="true" data-error={Boolean(errors.reportType)}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {REPORT_TYPE_OPTIONS.map((o) => {
                  const selected = reportType === o.value;
                  return (
                    <label
                      key={o.value}
                      className={`cursor-pointer rounded-md border px-3 py-2.5 transition-colors ${
                        selected ? "border-[#C8791A] bg-[#FCF0DE]/60 ring-1 ring-[#C8791A]" : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <span className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="reportType"
                          value={o.value}
                          checked={selected}
                          onChange={() => { setReportType(o.value); setErrors((p) => ({ ...p, reportType: "" })); }}
                          className="mt-1 h-4 w-4 accent-blue-800"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">{o.label}</span>
                          <span className="block text-xs text-slate-500">{o.hint}</span>
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            {errors.reportType ? <p role="alert" className={errorCls}>{errors.reportType}</p> : null}
          </Card>

          <Card title="Where and When" subtitle="Location and timing of the observation.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div data-error={Boolean(errors.site)}>
                <label htmlFor="worker-site" className={labelCls}>Site</label>
                <select
                  id="worker-site"
                  value={siteId}
                  onChange={(e) => { setSiteId(e.target.value); setErrors((p) => ({ ...p, site: "" })); }}
                  className={inputCls}
                  aria-invalid={Boolean(errors.site)}
                  aria-describedby={errors.site ? "worker-site-error" : undefined}
                >
                  <option value="">Select a site…</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>)}
                </select>
                {errors.site ? <p role="alert" id="worker-site-error" className={errorCls}>{errors.site}</p> : null}
                {sitesError ? <p className="mt-1 text-[13px] text-amber-700">Site list could not be loaded. Please try again later.</p> : null}
              </div>
              <div data-error={Boolean(errors.date)}>
                <label htmlFor="worker-date" className={labelCls}>Date</label>
                <input
                  id="worker-date"
                  type="date"
                  value={date}
                  max={todayISO()}
                  onChange={(e) => { setDate(e.target.value); setErrors((p) => ({ ...p, date: "" })); }}
                  className={inputCls}
                  aria-invalid={Boolean(errors.date)}
                  aria-describedby={errors.date ? "worker-date-error" : undefined}
                />
                {errors.date ? <p role="alert" id="worker-date-error" className={errorCls}>{errors.date}</p> : null}
              </div>
              <div className="sm:col-span-2" data-error={Boolean(errors.activity)}>
                <label htmlFor="worker-activity" className={labelCls}>Area / Activity</label>
                <input
                  id="worker-activity"
                  type="text"
                  value={activity}
                  onChange={(e) => { setActivity(e.target.value); setErrors((p) => ({ ...p, activity: "" })); }}
                  placeholder="e.g. Pump maintenance, Unit 5 walkway"
                  className={inputCls}
                  aria-invalid={Boolean(errors.activity)}
                  aria-describedby={errors.activity ? "worker-activity-error" : undefined}
                />
                {errors.activity ? <p role="alert" id="worker-activity-error" className={errorCls}>{errors.activity}</p> : null}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="worker-equipment" className={labelCls}>Equipment / Asset <span className="font-normal normal-case tracking-normal">(optional)</span></label>
                <input
                  id="worker-equipment"
                  type="text"
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  placeholder="e.g. P-214B"
                  className={inputCls}
                />
              </div>
            </div>
          </Card>

          <Card title="What Happened" subtitle="Factual details of what you observed.">
            <div data-error={Boolean(errors.description)}>
              <label htmlFor="worker-description" className={labelCls}>Description</label>
              <textarea
                id="worker-description"
                value={description}
                onChange={(e) => { setDescription(e.target.value); setErrors((p) => ({ ...p, description: "" })); }}
                placeholder={"Describe what you observed, what happened, and any immediate\nrisk or exposure."}
                rows={7}
                className={`${inputCls} min-h-36 resize-y leading-relaxed`}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? "worker-description-error worker-description-help" : "worker-description-help"}
              />
              <p id="worker-description-help" className="mt-1 text-[13px] text-slate-500">
                Use factual details. Include the activity, equipment involved, hazard observed, and what happened.
              </p>
              {errors.description ? <p role="alert" id="worker-description-error" className={errorCls}>{errors.description}</p> : null}
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={submitting} className="button-primary px-5 py-2 text-sm disabled:opacity-50" aria-busy={submitting}>
              {submitting ? "Submitting report…" : "Submit Report"}
            </button>
            <Link href="/worker" className="button-secondary px-5 py-2 text-sm">Cancel</Link>
          </div>
        </form>
      </div>
    </main>
  );
}
