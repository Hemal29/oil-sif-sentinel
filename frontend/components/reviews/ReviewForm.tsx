"use client";

import { useState } from "react";
import { submitReview } from "@/lib/api";
import { apiErrorMessage } from "@/lib/auth";
import type { HseDecision, ReasonCode } from "@/types/review";
import { HSE_DECISIONS, REASON_CODES } from "@/types/review";
import { DecisionBadge } from "@/components/common/Badges";
import { Modal } from "@/components/ui/primitives";

const DECISION_LABELS: Record<HseDecision, string> = {
  CONFIRMED: "Confirm",
  REJECTED: "Reject",
  NEEDS_MORE_INFO: "Needs More Info",
};

const DECISION_COLORS: Record<HseDecision, string> = {
  CONFIRMED: "bg-emerald-600 text-white",
  REJECTED: "bg-red-600 text-white",
  NEEDS_MORE_INFO: "bg-amber-600 text-white",
};

export function ReviewForm({
  reportId,
  closed,
  onSubmitted,
}: {
  reportId: string;
  closed: boolean;
  onSubmitted: (newStatus: string) => void;
}) {
  const [decision, setDecision] = useState<HseDecision>("CONFIRMED");
  const [comment, setComment] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function onRequestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (decision === "REJECTED" && !comment.trim()) {
      setFeedback({ kind: "err", text: "A comment is required when rejecting a report." });
      return;
    }
    setConfirmOpen(true);
  }

  async function onSubmit() {
    setConfirmOpen(false);
    setFeedback(null);
    setBusy(true);
    try {
      const res = await submitReview({ reportId, hseDecision: decision, ...(comment.trim() ? { comment: comment.trim() } : {}), ...(reasonCode ? { reasonCode: reasonCode as ReasonCode } : {}) });
      setFeedback({ kind: "ok", text: `Review recorded. Report status: ${res.reportStatus}.` });
      setComment("");
      setReasonCode("");
      onSubmitted(res.reportStatus);
    } catch (err: unknown) {
      setFeedback({ kind: "err", text: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (closed) {
    return (
      <div className="rounded-lg bg-white/[0.04] p-4 text-center">
        <p className="text-sm text-[#94A3B8]">This report is closed — no further HSE review can be recorded.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onRequestSubmit} className="space-y-4">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">HSE Decision</p>
        <div className="flex flex-wrap gap-2">
          {HSE_DECISIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDecision(d)}
              aria-pressed={decision === d}
              className={`rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-colors ${
                decision === d
                  ? DECISION_COLORS[d]
                  : "bg-[#131B24] text-[#94A3B8] ring-1 ring-[#CBD5E1] hover:bg-white/[0.04]"
              }`}
            >
              {DECISION_LABELS[d]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-[#94A3B8]">Selected: <DecisionBadge value={decision} /></p>
      </div>

      <div>
        <label className="block text-[13px] font-semibold text-white">
          Comment{decision === "REJECTED" ? " (required for rejection)" : " (optional)"}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="HSE reviewer comment…"
            className="field mt-1.5 w-full"
          />
        </label>
      </div>

      <div>
        <label className="block text-[13px] font-semibold text-white">
          Reason code (optional)
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="field mt-1.5 w-full bg-[#131B24]"
          >
            <option value="">None</option>
            {REASON_CODES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      </div>

      {feedback ? <p className={`rounded-xl border px-3 py-2 text-[13px] font-medium ${feedback.kind === "ok" ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]" : "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"}`}>{feedback.text}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="button-primary w-full disabled:opacity-50"
      >
        {busy ? "Submitting…" : `Submit: ${DECISION_LABELS[decision]}`}
      </button>
      {confirmOpen ? (
        <Modal
          title={`${DECISION_LABELS[decision]} this report?`}
          description="This decision updates the report status and is recorded permanently in the audit trail."
          onClose={() => setConfirmOpen(false)}
        >
          <dl className="space-y-2 rounded-xl bg-white/[0.04] px-4 py-3 text-[13px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="font-medium text-[#64748B]">Decision</dt>
              <dd><DecisionBadge value={decision} /></dd>
            </div>
            {reasonCode ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="font-medium text-[#64748B]">Reason code</dt>
                <dd className="font-mono text-[12px] text-white">{reasonCode}</dd>
              </div>
            ) : null}
            {comment.trim() ? (
              <div>
                <dt className="font-medium text-[#64748B]">Comment</dt>
                <dd className="mt-1 whitespace-pre-wrap text-white">{comment.trim()}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmOpen(false)} className="button-secondary">
              Cancel
            </button>
            <button type="button" onClick={onSubmit} disabled={busy} className={decision === "REJECTED" ? "button-danger" : "button-primary"}>
              {busy ? "Submitting…" : `Confirm ${DECISION_LABELS[decision]}`}
            </button>
          </div>
        </Modal>
      ) : null}
    </form>
  );
}
