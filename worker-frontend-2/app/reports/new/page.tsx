"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { fetchSites, isUnauthorized } from "@/lib/api";
import { logout } from "@/lib/auth";
import { createWorkerReport, createDraft, getDraft, updateDraft, submitDraft, type CreateWorkerReportPayload } from "@/lib/worker";
import type { ReportType, SafetyReport } from "@/types/report";
import { useWorkerUser, workerErrorMessage } from "@/components/worker/workerGuard";
import { WorkerShell } from "@/components/worker/WorkerShell";
import { Card, ErrorState, LoadingState } from "@/components/common/States";

const REPORT_TYPE_OPTIONS: { value: ReportType; label: string; hint: string }[] = [
  { value: "UNSAFE_ACT", label: "Unsafe Act", hint: "An unsafe action by a person" },
  { value: "UNSAFE_CONDITION", label: "Unsafe Condition", hint: "An unsafe workplace condition" },
  { value: "NEAR_MISS", label: "Near Miss", hint: "An incident that nearly caused harm" },
];

interface SiteOption { id: string; name: string; code: string | null; }

const inputCls = "field w-full";
const labelCls = "mb-1.5 block text-[13.5px] font-semibold text-[#0F172A]";
const errorCls = "mt-1.5 text-[13px] font-medium text-[#991B1B]";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function WorkerSubmitPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draftId");
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
  const [confirming, setConfirming] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [created, setCreated] = useState<SafetyReport | null>(null);

  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [draftError, setDraftError] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    fetchSites({ limit: 100 })
      .then((d) => setSites(d.items.map((s) => ({ id: s.id, name: s.name, code: s.code }))))
      .catch(() => setSitesError(true));
  }, []);

  useEffect(() => {
    if (!initialDraftId || !user) return;
    setLoadingDraft(true);
    getDraft(initialDraftId)
      .then((res) => {
        const d = res.draft;
        if (d.reportType) setReportType(d.reportType as ReportType);
        if (d.siteId) setSiteId(d.siteId);
        if (d.activity) setActivity(d.activity);
        if (d.equipment) setEquipment(d.equipment);
        if (d.description) setDescription(d.description);
        if (d.date) setDate(d.date.slice(0, 10));
        setDraftId(d.id);
      })
      .catch(() => setDraftError("Unable to load draft."))
      .finally(() => setLoadingDraft(false));
  }, [initialDraftId, user]);

  function getDraftPayload() {
    return {
      reportType: reportType || undefined,
      siteId: siteId || undefined,
      activity: activity.trim() || undefined,
      equipment: equipment.trim() || undefined,
      description: description.trim() || undefined,
      date: date || undefined,
    };
  }

  function hasDraftData(): boolean {
    return !!(reportType || siteId || activity.trim() || equipment.trim() || description.trim() || date);
  }

  async function saveDraft(manual = false) {
    if (!user || !hasDraftData()) return;
    const payload = getDraftPayload();
    // Only save if at least one field changed from empty? For auto-save we already check hasDraftData
    if (Object.keys(payload).length === 0) return;
    if (manual) setSavingDraft(true);
    else setDraftStatus("saving");
    setDraftError("");
    try {
      if (draftId) {
        const res = await updateDraft(draftId, payload);
        setDraftId(res.draft.id);
        setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        setDraftStatus("saved");
      } else {
        const res = await createDraft(payload);
        setDraftId(res.draft.id);
        // Update URL without navigation to reflect draftId
        const url = new URL(window.location.href);
        url.searchParams.set("draftId", res.draft.id);
        window.history.replaceState({}, "", url.toString());
        setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        setDraftStatus("saved");
      }
    } catch (err: unknown) {
      if (isUnauthorized(err)) { logout(); router.push("/login?expired=1"); return; }
      const msg = workerErrorMessage(err, "Save failed");
      setDraftError(msg);
      setDraftStatus("error");
    } finally {
      if (manual) setSavingDraft(false);
    }
  }

  // Auto-save debounced 1000ms
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    if (!user || loadingDraft) return;
    if (!hasDraftData()) return;
    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    setDraftStatus("saving");
    autoSaveTimeout.current = setTimeout(() => { void saveDraft(false); }, 1000);
    return () => { if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current); };
  }, [reportType, siteId, activity, equipment, description, date]);

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
    setSubmitting(true);
    setSubmitError("");
    setConfirming(false);
    try {
      if (draftId) {
        // Ensure latest draft is saved before submit
        await updateDraft(draftId, getDraftPayload()).catch(() => {});
        const res = await submitDraft(draftId);
        setCreated(res.report);
        window.scrollTo({ top: 0 });
      } else {
        const payload: CreateWorkerReportPayload = {
          date,
          siteId,
          activity: activity.trim(),
          reportType: reportType as ReportType,
          description: description.trim(),
          ...(equipment.trim() ? { equipment: equipment.trim() } : {}),
        };
        const res = await createWorkerReport(payload);
        setCreated(res.report);
        window.scrollTo({ top: 0 });
      }
    } catch (err: unknown) {
      if (isUnauthorized(err)) { logout(); router.push("/login?expired=1"); return; }
      setSubmitError(workerErrorMessage(err, "Unable to submit your report. Please try again."));
    } finally { setSubmitting(false); }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (confirming) {
      void submit();
      return;
    }
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const first = document.querySelector<HTMLElement>("[data-error='true'] input, [data-error='true'] select, [data-error='true'] textarea");
      first?.focus();
      return;
    }
    setConfirming(true);
    window.scrollTo({ top: 0 });
  }

  if (!user) {
    return (
      <WorkerShell title="New Report">
        <div className="mx-auto w-full max-w-[720px]"><LoadingState message="Loading…" /></div>
      </WorkerShell>
    );
  }

  if (loadingDraft) {
    return (
      <WorkerShell title="New Report">
        <div className="mx-auto w-full max-w-[720px]"><LoadingState message="Loading draft…" /></div>
      </WorkerShell>
    );
  }

  if (created) {
    return (
      <WorkerShell title="New Report">
        <div className="mx-auto w-full max-w-[720px]">
          <section className="panel p-6 text-center sm:p-10" aria-live="polite">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FEF3E7] text-[#D97706]">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
            </span>
            <p className="eyebrow mt-4">Submission received</p>
            <h1 className="page-title mt-2">Report Submitted</h1>
            <p className="mx-auto mt-2 max-w-[52ch] text-[14px] text-[#475569]">Your safety observation has been submitted successfully.</p>
            <dl className="mx-auto mt-5 max-w-[420px] rounded-2xl bg-[#F8FAFC] px-5 py-4 text-left">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[13px] text-[#64748B]">Report Number</dt>
                <dd className="font-mono text-[14px] font-bold text-[#0F172A]">{created.reportNumber}</dd>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4 border-t border-[#E2E8F0] pt-2">
                <dt className="text-[13px] text-[#64748B]">Status</dt>
                <dd className="text-[13px] font-semibold text-[#0F172A]">Submitted</dd>
              </div>
            </dl>
            <div className="mx-auto mt-5 max-w-[420px] rounded-2xl border border-[#E2E8F0] px-5 py-4 text-left">
              <p className="text-[13.5px] font-bold text-[#0F172A]">What happens next?</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#475569]">The HSE team will review your report. You can track its progress under My Reports.</p>
            </div>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Link href={`/reports/${created.id}`} className="button-primary min-h-[48px] px-6">View Report</Link>
              <Link href="/" className="button-secondary min-h-[48px] px-6">Back to Dashboard</Link>
            </div>
          </section>
        </div>
      </WorkerShell>
    );
  }

  return (
    <WorkerShell title="New Report">
      <div className="mx-auto w-full max-w-[720px]">
        <div>
          <h1 className="page-title">Report a Safety Observation</h1>
          <p className="page-subtitle">Tell us what you observed. Your report helps prevent serious incidents.</p>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-2.5" aria-live="polite">
          <p className="flex items-center gap-2 text-[12.5px] font-medium text-[#64748B]">
            <span className={`h-2 w-2 rounded-full ${draftStatus === "saving" ? "animate-pulse bg-[#D97706]" : draftStatus === "saved" ? "bg-[#15803D]" : draftStatus === "error" ? "bg-[#DC2626]" : "bg-[#CBD5E1]"}`} aria-hidden="true" />
            {draftStatus === "saving" ? "Saving..." : draftStatus === "saved" && lastSavedAt ? `Saved · Last saved ${lastSavedAt}` : draftStatus === "error" ? "Save failed — will retry" : "Draft auto-save is on"}
          </p>
          {draftError ? <span className="text-[12px] font-medium text-[#991B1B]">{draftError}</span> : null}
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-3 space-y-5" aria-label="Submit safety report">
          {submitError ? <ErrorState message={submitError} onRetry={() => submit()} /> : null}
          {confirming ? (
            <div className="rounded-2xl border border-[#FBD8A0] bg-[#FEF3E7] p-5" role="group" aria-label="Confirm submission">
              <p className="text-[15px] font-bold text-[#0F172A]">Ready to submit?</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-[#475569]">Please review your observation before sending it to the HSE team.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button type="submit" disabled={submitting} className="button-primary min-h-[48px] flex-1 px-6 disabled:opacity-50">
                  {submitting ? "Submitting report…" : "Submit Report"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} disabled={submitting} className="button-secondary min-h-[48px] px-6 disabled:opacity-50">
                  Back
                </button>
              </div>
            </div>
          ) : null}

          <Card title="Report Type" subtitle="Select the category that best fits your observation.">
            <div role="radiogroup" aria-label="Report type" aria-required="true" data-error={Boolean(errors.reportType)}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {REPORT_TYPE_OPTIONS.map((o) => {
                  const selected = reportType === o.value;
                  return (
                    <label
                      key={o.value}
                      className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                        selected ? "border-[#D97706] bg-[#FEF3E7] ring-1 ring-[#D97706]" : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
                      }`}
                    >
                      <span className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="reportType"
                          value={o.value}
                          checked={selected}
                          onChange={() => { setReportType(o.value); setErrors((p) => ({ ...p, reportType: "" })); }}
                          className="mt-1 h-5 w-5 accent-[#D97706]"
                        />
                        <span>
                          <span className="block text-[14px] font-bold text-[#0F172A]">{o.label}</span>
                          <span className="mt-0.5 block text-[12.5px] leading-relaxed text-[#64748B]">{o.hint}</span>
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
                placeholder={"Describe what you observed, where it happened, what people were doing, and what could have happened."}
                rows={7}
                className={`${inputCls} min-h-[160px] resize-y`}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? "worker-description-error worker-description-help" : "worker-description-help"}
              />
              <p id="worker-description-help" className="mt-1.5 text-[13px] text-[#64748B]">
                Please provide enough detail for the HSE team to understand the situation.
              </p>
              {errors.description ? <p role="alert" id="worker-description-error" className={errorCls}>{errors.description}</p> : null}
            </div>
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button type="submit" disabled={submitting} className="button-primary min-h-[48px] flex-1 px-6 text-[15px] disabled:opacity-50 sm:flex-none sm:px-8" aria-busy={submitting}>
              {submitting ? "Submitting report…" : "Submit Report"}
            </button>
            <button type="button" onClick={() => saveDraft(true)} disabled={savingDraft} className="button-secondary min-h-[48px] px-6 disabled:opacity-50">
              {savingDraft ? "Saving..." : "Save Draft"}
            </button>
            <Link href="/" className="button-ghost px-4 text-center">Cancel</Link>
          </div>
        </form>
      </div>
    </WorkerShell>
  );
}

export default function WorkerSubmitPage() {
  return (
    <Suspense fallback={<WorkerShell title="New Report"><div className="mx-auto w-full max-w-[720px]"><LoadingState message="Loading…" /></div></WorkerShell>}>
      <WorkerSubmitPageInner />
    </Suspense>
  );
}
