"use client";
import { useCallback, useEffect, useState } from "react";
import { fetchReportAudit, type AuditEventItem } from "@/lib/api";
import { LoadingState } from "@/components/common/States";

const EVENT_LABELS: Record<string, string> = {
  REPORT_SUBMITTED: "Report Submitted",
  REPORT_UPDATED: "Report Updated",
  AI_ASSESSMENT_STARTED: "AI Assessment Started",
  AI_ASSESSMENT_COMPLETED: "AI Assessment Completed",
  AI_ASSESSMENT_FAILED: "AI Assessment Failed",
  REPORT_AUTO_CLOSED: "Report Automatically Closed",
  HSE_REVIEW_STARTED: "HSE Review Started",
  HSE_NEEDS_MORE_INFO: "Additional Information Requested",
  HSE_REVIEW_CONFIRMED: "HSE Decision — Confirmed",
  HSE_REVIEW_REJECTED: "HSE Decision — Rejected",
  REPORT_CLOSED: "Report Closed",
};

function actorLabel(ev: AuditEventItem): string {
  if (ev.actorType === "AI") return "AI Engine";
  if (ev.actorType === "SYSTEM") return "System";
  if (ev.actorType === "HSE") return ev.actor?.name ? `${ev.actor.name} · HSE` : "HSE Reviewer";
  return ev.actor?.name ?? "Worker";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function EventDetail({ ev }: { ev: AuditEventItem }) {
  const meta = (ev.metadata ?? {}) as Record<string, unknown>;
  const chips: string[] = [];
  if (typeof meta.route === "string" && meta.route) chips.push(meta.route.replace("_", " "));
  if (typeof meta.riskScore === "number") chips.push(`Risk ${(meta.riskScore * 100).toFixed(0)}%`);
  if (typeof meta.sifPotential === "boolean") chips.push(meta.sifPotential ? "SIF: YES" : "SIF: NO");
  if (typeof meta.decision === "string" && meta.decision) chips.push(String(meta.decision).replace(/_/g, " "));
  if (Array.isArray(meta.changedFields) && meta.changedFields.length > 0) {
    chips.push(`Fields: ${(meta.changedFields as unknown[]).map(String).join(", ")}`);
  }
  return (
    <span className="min-w-0">
      <span className="block text-[13px] font-semibold text-[#14283F]">{EVENT_LABELS[ev.eventType] ?? ev.eventType}</span>
      <span className="block text-[12px] text-[#6B7385]">Actor: {actorLabel(ev)} · {formatTime(ev.createdAt)}</span>
      {chips.length > 0 ? <span className="block text-[12px] text-[#6B7385]">{chips.join(" · ")}</span> : null}
      {typeof meta.comment === "string" && meta.comment ? (
        <span className="mt-1 block whitespace-pre-wrap break-words rounded-[4px] border border-[#E7E1D4] bg-[#FAF8F4] px-2 py-1.5 text-[12px] leading-relaxed text-[#14283F]">
          {meta.comment}
        </span>
      ) : null}
    </span>
  );
}

export function ActivityHistory({ reportId }: { reportId: string }) {
  const [items, setItems] = useState<AuditEventItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (p: number, append: boolean) => {
    if (append) setLoadingMore(true); else { setLoading(true); setError(""); }
    try {
      const res = await fetchReportAudit(reportId, { page: p, limit: 20 });
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
        <div className="rounded-[4px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-3 text-center">
          <p className="text-[13px] font-semibold text-[#991B1B]">Unable to load activity history.</p>
          <button onClick={() => load(1, false)} className="button-secondary mt-2 px-3 py-1 text-[12px]">Retry</button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-[#6B7385]">Activity history is not available for this report.</p>
      ) : (
        <>
          <ol className="timeline">
            {items.map((ev, i) => (
              <li key={ev.id} className="timeline-item">
                {i < items.length - 1 ? <span className="timeline-line" aria-hidden="true" /> : null}
                <span className="timeline-dot done" aria-hidden="true" />
                <EventDetail ev={ev} />
              </li>
            ))}
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
