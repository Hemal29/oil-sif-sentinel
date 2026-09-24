"use client";

import { cn } from "@/lib/utils";

/* Industrial high-contrast palette: teal / amber / crimson / safe */
const BADGE_STYLES: Record<string, string> = {
  NEW: "badge-neutral",
  ANALYZED: "badge-info",
  UNDER_REVIEW: "badge-medium",
  CLOSED: "badge-success",
  CONFIRMED: "badge-success",
  REJECTED: "badge-critical",
  NEEDS_MORE_INFO: "badge-medium",
  LOW: "badge-neutral",
  MEDIUM: "badge-neutral",
  HIGH: "badge-info",
  CRITICAL: "badge-critical",
  SIF: "badge-info",
  "NON-SIF": "badge-neutral",
  UNANALYZED: "badge-neutral",
  INSUFFICIENT: "badge-neutral",
  PENDING: "badge-neutral",
  FAILED: "badge-neutral",
  ACTIVE: "badge-info",
  INACTIVE: "badge-neutral",
  Prototype: "badge-medium",
  Official: "badge-info",
};

function BaseBadge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-[3px] text-[11px] font-semibold uppercase tracking-[0.05em]",
        className
      )}
      style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const style = BADGE_STYLES[value] ?? "badge-neutral";
  return <BaseBadge className={style}>{value}</BaseBadge>;
}

export function PriorityBadge({ value }: { value: string | null }) {
  if (!value) return <BaseBadge className="badge-neutral">—</BaseBadge>;
  const style = BADGE_STYLES[value] ?? "badge-neutral";
  return <BaseBadge className={style}>{value}</BaseBadge>;
}

export function SifBadge({ value }: { value: boolean | string | null }) {
  if (value === null || value === undefined) return <BaseBadge className="badge-neutral">Unanalyzed</BaseBadge>;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "yes" || lower === "true" || lower === "sif") return <BaseBadge className={BADGE_STYLES.SIF}>SIF</BaseBadge>;
    if (lower === "no" || lower === "false" || lower === "non-sif") return <BaseBadge className={BADGE_STYLES["NON-SIF"]}>Non-SIF</BaseBadge>;
    if (lower === "insufficient_information" || lower === "insufficient" || lower === "insufficient_information ") return <BaseBadge className={BADGE_STYLES.INSUFFICIENT}>Insufficient</BaseBadge>;
    if (lower === "insufficient_information".toUpperCase().toLowerCase()) return <BaseBadge className={BADGE_STYLES.INSUFFICIENT}>Insufficient</BaseBadge>;
  }
  // boolean path
  return (
    <BaseBadge className={value ? BADGE_STYLES.SIF : BADGE_STYLES["NON-SIF"]}>
      {value ? "SIF" : "Non-SIF"}
    </BaseBadge>
  );
}

function normalizeSif(value: boolean | string | null | undefined): boolean | string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const l = value.toLowerCase();
    if (l === "yes" || l === "true") return true;
    if (l === "no" || l === "false") return false;
    if (l.includes("insufficient")) return "insufficient_information";
  }
  return value;
}

/** Derive AI assessment display from the actual report + analysis state.
 *  Implements spec §3 exact logic: null => UNANALYZED, PENDING => Pending, FAILED => Failed, COMPLETED => actual sifPotential (boolean or string). */
export function AiAssessmentBadge({ report }: { report: { status: string; aiAnalysis?: { sifPotential: boolean | string | null; analysisStatus?: string; status?: string } | null } }) {
  const hasField = Object.prototype.hasOwnProperty.call(report, "aiAnalysis");
  if (!hasField || report.aiAnalysis === undefined) {
    // Field absent — API intentionally omitted relation. Do not fabricate UNANALYZED.
    return <BaseBadge className="badge-neutral">—</BaseBadge>;
  }
  const a = report.aiAnalysis;
  if (a === null) return <BaseBadge className="badge-neutral">Unanalyzed</BaseBadge>;
  const st = (a as { analysisStatus?: string; status?: string }).analysisStatus ?? (a as { status?: string }).status ?? null;
  if (st === "PENDING") return <BaseBadge className="badge-neutral">Pending</BaseBadge>;
  if (st === "FAILED") return <BaseBadge className="badge-neutral">Failed</BaseBadge>;
  if (st === "COMPLETED") return <SifBadge value={(a.sifPotential as boolean | string | null) ?? null} />;
  // Fallback for legacy rows without status but with sifPotential
  if (a.sifPotential !== undefined && a.sifPotential !== null) return <SifBadge value={a.sifPotential as boolean | string | null} />;
  return <BaseBadge className="badge-neutral">Unanalyzed</BaseBadge>;
}

export function getSifForTable(report: { aiAnalysis?: { sifPotential: boolean | string | null; analysisStatus?: string; status?: string } | null }): boolean | string | null | "PENDING" | "FAILED" | "UNANALYZED" | "ABSENT" {
  const hasField = Object.prototype.hasOwnProperty.call(report, "aiAnalysis");
  if (!hasField || report.aiAnalysis === undefined) return "ABSENT";
  if (report.aiAnalysis === null) return "UNANALYZED";
  const st = (report.aiAnalysis as { analysisStatus?: string; status?: string }).analysisStatus ?? (report.aiAnalysis as { status?: string }).status ?? null;
  if (st === "PENDING") return "PENDING";
  if (st === "FAILED") return "FAILED";
  if (st === "COMPLETED") return (report.aiAnalysis.sifPotential as boolean | string | null) ?? null;
  return report.aiAnalysis.sifPotential ?? "UNANALYZED";
}

export function getPriorityForTable(report: { aiAnalysis?: { priority?: string | null; analysisStatus?: string; status?: string } | null }): string | null | "PENDING" | "FAILED" | "ABSENT" {
  const hasField = Object.prototype.hasOwnProperty.call(report, "aiAnalysis");
  if (!hasField || report.aiAnalysis === undefined) return "ABSENT";
  if (report.aiAnalysis === null) return null;
  const st = (report.aiAnalysis as { analysisStatus?: string; status?: string }).analysisStatus ?? (report.aiAnalysis as { status?: string }).status ?? null;
  if (st === "PENDING" || st === "FAILED") return st;
  if (st === "COMPLETED") return report.aiAnalysis.priority ?? null;
  return report.aiAnalysis.priority ?? null;
}

export function DecisionBadge({ value }: { value: string }) {
  const style = BADGE_STYLES[value] ?? "badge-neutral";
  return <BaseBadge className={style}>{value.replace("_", " ")}</BaseBadge>;
}

export function TypeBadge({ value }: { value: string }) {
  const labels: Record<string, string> = {
    UNSAFE_ACT: "Unsafe Act",
    UNSAFE_CONDITION: "Unsafe Condition",
    NEAR_MISS: "Near Miss",
  };
  return <BaseBadge className="badge-info">{labels[value] ?? value}</BaseBadge>;
}

export function OfficialBadge() {
  return <BaseBadge className={BADGE_STYLES.Official}>Official</BaseBadge>;
}

export function PrototypeBadge() {
  return <BaseBadge className={BADGE_STYLES.Prototype}>Prototype</BaseBadge>;
}
