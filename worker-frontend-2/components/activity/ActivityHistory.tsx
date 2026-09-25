"use client";
import { useCallback, useEffect, useState } from "react";
import { fetchMyReportAudit, type AuditEventItem } from "@/lib/worker";
import { LoadingState } from "@/components/common/States";

const EVENT_LABELS: Record<string, string> = {
  REPORT_SUBMITTED: "Report Submitted",
  REPORT_UPDATED: "Report Updated",
  AI_ASSESSMENT_STARTED: "AI Assessment Started",
  AI_ASSESSMENT_COMPLETED: "AI Assessment Completed",
  AI_ASSESSMENT_FAILED: "AI Assessment",
  REPORT_AUTO_CLOSED: "Report Closed",
  HSE_REVIEW_STARTED: "HSE Review Started",
  HSE_NEEDS_MORE_INFO: "Additional Information Requested",
  HSE_REVIEW_CONFIRMED: "HSE Review — Confirmed",
  HSE_REVIEW_REJECTED: "HSE Review — Rejected",
  REPORT_CLOSED: "Report Closed",
};

function actorLabel(ev: AuditEventItem, currentUserId?: string): string {
  if (ev.actorType === "AI") return "AI Engine";
  if (ev.actorType === "SYSTEM") return "System";
  if (ev.actorType === "HSE") return "HSE Reviewer";
  if (currentUserId && ev.actor?.id === currentUserId) return "You";
  return "Worker";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Worker-safe summaries only: no internal IDs, no technical failure detail.
function eventSummary(ev: AuditEventItem): string | null {
  const meta = (ev.metadata ?? {}) as Record<string, unknown>;
  switch (ev.eventType) {
    case "REPORT_SUBMITTED":
      return "You submitted this report";
    case "AI_ASSESSMENT_COMPLETED": {
      const parts: string[] = [];
      if (typeof meta.route === "string" && meta.route) parts.push(meta.route.replace("_", " "));
      if (typeof meta.riskScore === "number") parts.push(`Risk ${(meta.riskScore * 100).toFixed(0)}%`);
      return parts.length > 0 ? parts.join(" · ") : "Completed";
    }
    case "AI_ASSESSMENT_STARTED":
      return "Assessment in progress";
    case "AI_ASSESSMENT_FAILED":
      return "HSE has been notified";
    case "REPORT_AUTO_CLOSED":
      return "Automatically closed — no further action required";
    case "HSE_REVIEW_STARTED":
      return "Your report is being reviewed";
    case "HSE_NEEDS_MORE_INFO":
      return "Additional information requested";
    case "HSE_REVIEW_CONFIRMED":
      return "Confirmed";
    case "HSE_REVIEW_REJECTED":
      return "Not confirmed";
    case "REPORT_UPDATED": {
      if (Array.isArray(meta.changedFields) && meta.changedFields.length > 0) {
        return `Updated: ${(meta.changedFields as unknown[]).map(String).join(", ")}`;
      }
      return "Updated";
    }
    case "REPORT_CLOSED":
      return "Review complete";
    default:
      return null;
  }
}

export function ActivityHistory({ reportId, currentUserId }: { reportId: string; currentUserId?: string }) {
  const [items, setItems] = useState<AuditEventItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (p: number, append: boolean) => {
    if (append) setLoadingMore(true); else { setLoading(true); setError(""); }
    try {
      const res = await fetchMyReportAudit(reportId, { page: p, limit: 20 });
      setItems((prev) => (append ? [...prev, ...res.items] : res.items));
      setPage(res.pagination.page);
      setTotalPages(Math.max(1, res.pagination.totalPages));
    } catch {
      if (!append) setError("Unable to load activity history.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [reportId]);

  useEffect(() => { load(1, false); }, [load]);

  return (
    <div>
      {loading ? (
        <LoadingState message="Loading activity history…" />
      ) : error ? (
        <div className="rounded-[4px] border border-[#F5C6C6] bg-[#FCE8E9] px-3 py-3 text-center">
          <p className="text-[13px] font-semibold text-[#9B1C1C]">Unable to load activity history.</p>
          <button onClick={() => load(1, false)} className="button-secondary mt-2 px-3 py-1 text-[12px]">Retry</button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-[#627D98]">Activity history is not available for this report.</p>
      ) : (
        <>
          <ol className="timeline">
            {items.map((ev, i) => {
              const summary = eventSummary(ev);
              const meta = (ev.metadata ?? {}) as Record<string, unknown>;
              return (
                <li key={ev.id} className="timeline-item">
                  {i < items.length - 1 ? <span className="timeline-line" aria-hidden="true" /> : null}
                  <span className="timeline-dot done" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-[#102A43]">{EVENT_LABELS[ev.eventType] ?? ev.eventType}</span>
                    {summary ? <span className="block text-[12px] text-[#627D98]">{summary}</span> : null}
                    {typeof meta.comment === "string" && meta.comment ? (
                      <span className="mt-1 block whitespace-pre-wrap break-words rounded-[4px] border border-[#D9E2EC] bg-[#F8FAFC] px-2 py-1.5 text-[12px] leading-relaxed text-[#243B53]">
                        {meta.comment}
                      </span>
                    ) : null}
                    <span className="block text-[11px] text-[#8A9BB0]">{actorLabel(ev, currentUserId)} · {formatTime(ev.createdAt)}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          {page < totalPages ? (
            <div className="mt-3 flex justify-center">
              <button onClick={() => load(page + 1, true)} disabled={loadingMore} className="button-secondary px-4 py-1.5 text-[12px] disabled:opacity-50">
                {loadingMore ? "Loading…" : "Show more"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
