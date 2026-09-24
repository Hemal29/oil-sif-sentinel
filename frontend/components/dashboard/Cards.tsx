"use client";

import type { DashboardOverview } from "@/types/dashboard";
import { ChartCard, KpiCard } from "@/components/common/States";

export { ChartCard };

function TotalIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6M9 8h6M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" />
    </svg>
  );
}

function SifIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    </svg>
  );
}

function PriorityIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 21h18M12 3v10m0 0l-4-4m4 4l4-4" />
    </svg>
  );
}

function ReviewIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

const KPI_DEFS: {
  key: keyof DashboardOverview;
  label: string;
  hint: string;
  variant: "default" | "critical" | "high" | "medium" | "success" | "primary";
  icon: React.ReactNode;
}[] = [
  { key: "totalReports", label: "Total Reports", hint: "Reports in selected period", variant: "primary", icon: <TotalIcon /> },
  { key: "sifPotential", label: "SIF Potential", hint: "AI-flagged reports", variant: "critical", icon: <SifIcon /> },
  { key: "highPriority", label: "High / Critical", hint: "Requires attention", variant: "high", icon: <PriorityIcon /> },
  { key: "pendingReviews", label: "Pending HSE Reviews", hint: "Awaiting HSE decision", variant: "success", icon: <ReviewIcon /> },
  { key: "priorityReports", label: "Priority Reports", hint: "AI route: PRIORITY", variant: "critical", icon: <PriorityIcon /> },
  { key: "aiUncertain", label: "AI Uncertain", hint: "AI route: UNCERTAIN", variant: "medium", icon: <SifIcon /> },
  { key: "aiAbstained", label: "AI Abstained", hint: "Needs more information", variant: "medium", icon: <ReviewIcon /> },
  { key: "autoClosed", label: "Auto Closed", hint: "AI route: AUTO_CLOSE", variant: "success", icon: <TotalIcon /> },
];

export function KpiCards({ data }: { data: DashboardOverview | null }) {
  if (!data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="panel animate-pulse space-y-3 p-4">
            <div className="skeleton h-3 w-24 rounded skeleton" />
            <div className="skeleton h-9 w-16 rounded skeleton" />
            <div className="skeleton h-3 w-32 rounded skeleton" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {KPI_DEFS.filter((k) => typeof data[k.key] === "number").map((k) => (
        <KpiCard key={k.key} label={k.label} value={data[k.key] as number} hint={k.hint} variant={k.variant} icon={k.icon} />
      ))}
    </div>
  );
}
