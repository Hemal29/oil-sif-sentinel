"use client";

import Link from "next/link";
import type { PendingReview, RecentReport, RuleAnalytic, SiteAnalytic, TopCount } from "@/types/dashboard";
import { ChartCard } from "./Cards";
import { EmptyState } from "./States";
import { PriorityBadge, SifBadge, StatusBadge, TypeBadge } from "@/components/common/Badges";

function ScrollTable({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

const TH = "whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
const TD = "whitespace-nowrap px-3 py-2.5 text-sm text-slate-700";

const TYPE_LABELS: Record<string, string> = {
  UNSAFE_ACT: "Unsafe Act",
  UNSAFE_CONDITION: "Unsafe Condition",
  NEAR_MISS: "Near Miss",
};

function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="whitespace-nowrap text-[13px] font-semibold text-[#C8791A] hover:text-[#A8620F] hover:underline">
      {children}
    </Link>
  );
}

export function SiteTable({ items }: { items: SiteAnalytic[] }) {
  return (
    <ChartCard title="Site Analytics" subtitle="Top sites by report count">
      {items.length === 0 ? (
        <EmptyState message="No reports available for this period." />
      ) : (
        <ScrollTable>
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className={TH}>Site</th>
                <th className={TH}>Reports</th>
                <th className={TH}>SIF (AI)</th>
                <th className={TH}>High / Critical</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.siteId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className={TD}>
                    <span className="font-medium text-slate-900">{s.siteName}</span>
                    {s.siteCode ? <span className="ml-2 text-xs tabular-nums text-slate-400">{s.siteCode}</span> : null}
                  </td>
                  <td className={`${TD} tabular-nums`}>{s.reportCount}</td>
                  <td className={`${TD} tabular-nums`}>{s.sifCount}</td>
                  <td className={`${TD} tabular-nums`}>{s.highCriticalCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      )}
    </ChartCard>
  );
}

export function RuleTable({ items }: { items: RuleAnalytic[] }) {
  return (
    <ChartCard title="Life-Saving Rule Breakdown" subtitle="Prototype rules are labelled">
      {items.length === 0 ? (
        <EmptyState message="No resolved Life-Saving Rules for this period." />
      ) : (
        <ScrollTable>
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className={TH}>Rule</th>
                <th className={TH}>Type</th>
                <th className={TH}>Reports</th>
                <th className={TH}>SIF (AI)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.ruleId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className={TD}>
                    <span className="font-semibold text-slate-900">{r.ruleCode}</span>
                    <span className="ml-2 text-slate-500">{r.ruleName}</span>
                  </td>
                  <td className={TD}>
                    {r.isPrototype ? (
                      <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                        Prototype
                      </span>
                    ) : (
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800">
                        Official
                      </span>
                    )}
                  </td>
                  <td className={`${TD} tabular-nums`}>{r.reportCount}</td>
                  <td className={`${TD} tabular-nums`}>{r.sifCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      )}
    </ChartCard>
  );
}

export function RecentReportsTable({ items }: { items: RecentReport[] }) {
  return (
    <ChartCard
      title="Recent Safety Reports"
      subtitle="Latest high-priority analyses · report number opens the investigation record"
    >
      {items.length === 0 ? (
        <EmptyState message="No high-priority reports found." />
      ) : (
        <ScrollTable>
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className={TH}>Report</th>
                <th className={TH}>Date</th>
                <th className={TH}>Type</th>
                <th className={TH}>Site</th>
                <th className={TH}>Activity</th>
                <th className={TH}>Status</th>
                <th className={TH}>SIF</th>
                <th className={TH}>Priority</th>
                <th className={TH}>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.analysisId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className={TD}>
                    <Link href={`/reports/${r.reportId}`} className="font-semibold text-[#C8791A] hover:underline">
                      {r.reportNumber}
                    </Link>
                  </td>
                  <td className={`${TD} tabular-nums`}>{r.date}</td>
                  <td className={TD}>
                    <TypeBadge value={r.reportType} />
                    <span className="sr-only">{TYPE_LABELS[r.reportType] ?? r.reportType}</span>
                  </td>
                  <td className={TD}>{r.siteName}</td>
                  <td className={`${TD} max-w-44 truncate`}>{r.activity || "—"}</td>
                  <td className={TD}>
                    <StatusBadge value={r.status} />
                  </td>
                  <td className={TD}>
                    <SifBadge value={r.sifPotential} />
                  </td>
                  <td className={TD}>
                    <PriorityBadge value={r.priority} />
                  </td>
                  <td className={TD}>
                    <ActionLink href={`/reports/${r.reportId}`}>View report →</ActionLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      )}
    </ChartCard>
  );
}

export function PendingReviewsTable({ items }: { items: PendingReview[] }) {  return (
    <ChartCard title="Pending HSE Reviews" subtitle="Reports awaiting a final HSE decision">
      {items.length === 0 ? (
        <EmptyState message="No pending reviews. The queue is clear." />
      ) : (
        <ScrollTable>
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className={TH}>Report</th>
                <th className={TH}>Date</th>
                <th className={TH}>Priority</th>
                <th className={TH}>SIF</th>
                <th className={TH}>Review status</th>
                <th className={TH}>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.reportId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className={TD}>
                    <Link href={`/reports/${r.reportId}`} className="font-semibold text-[#C8791A] hover:underline">
                      {r.reportNumber}
                    </Link>
                  </td>
                  <td className={`${TD} tabular-nums`}>{r.date}</td>
                  <td className={TD}>
                    <PriorityBadge value={r.priority} />
                  </td>
                  <td className={TD}>
                    <SifBadge value={r.sifPotential} />
                  </td>
                  <td className={TD}>
                    <StatusBadge value={r.status} />
                  </td>
                  <td className={TD}>
                    <ActionLink href={`/reports/${r.reportId}`}>Review →</ActionLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      )}
    </ChartCard>
  );
}

export function TopCountsTable({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: TopCount[];
}) {
  return (
    <ChartCard title={title} subtitle={subtitle}>
      {items.length === 0 ? (
        <EmptyState message="No AI-extracted data for this period yet." />
      ) : (
        <ScrollTable>
          <table className="w-full min-w-[320px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className={TH}>Name</th>
                <th className={TH}>Reports</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.name} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className={TD}>
                    <span className="font-medium text-slate-900">{r.name}</span>
                  </td>
                  <td className={`${TD} tabular-nums`}>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      )}
    </ChartCard>
  );
}
