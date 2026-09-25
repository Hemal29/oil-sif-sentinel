"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ActivityAnalytic,
  DashboardDistributions,
  DashboardTrend,
  RuleAnalytic,
  SiteAnalytic,
} from "@/types/dashboard";
import { ChartCard } from "./Cards";
import { EmptyState } from "./States";

const TYPE_LABELS: Record<string, string> = {
  UNSAFE_ACT: "Unsafe Act",
  UNSAFE_CONDITION: "Unsafe Condition",
  NEAR_MISS: "Near Miss",
};

const BLUE = "#C8791A";
const SLATE = "#9BA3AF";
const PALE = "#D9D0BE";
const GRID = "#E7E1D4";

const AXIS_TICK = { fontSize: 11, fill: "#6B7385" };

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-md">
      {label !== undefined ? (
        <p className="mb-1 text-xs font-semibold text-slate-800">{label}</p>
      ) : null}
      {payload.map((entry: any, i: number) => (
        <p key={i} className="flex items-center justify-between gap-4 text-xs tabular-nums text-slate-600">
          <span>
            <span
              className="mr-1.5 inline-block h-2 w-2 rounded-full"
              style={{ background: entry.color ?? entry.payload?.fill }}
            />
            {entry.name}
          </span>
          <span className="font-semibold text-slate-900">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

function LegendText({ value }: { value?: string }) {
  return <span className="text-xs text-slate-600">{value}</span>;
}

export function TrendChart({ data }: { data: DashboardTrend | null }) {
  const points = data?.points ?? [];
  return (
    <ChartCard
      title="Reports Trend"
      subtitle={data ? `Grouped by ${data.bucket} · SIF = AI-flagged analyses` : undefined}
    >
      {points.length === 0 ? (
        <EmptyState message="No reports available for this period." />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK} minTickGap={28} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} />
              <Tooltip content={<ChartTooltip />} />
              <Legend formatter={(v) => <LegendText value={v} />} iconSize={10} />
              <Area
                type="monotone"
                dataKey="totalReports"
                name="Total reports"
                stroke={BLUE}
                strokeWidth={2}
                fill={BLUE}
                fillOpacity={0.07}
                dot={false}
                activeDot={{ r: 3 }}
              />
              <Area
                type="monotone"
                dataKey="sifReports"
                name="SIF reports (AI)"
                stroke={SLATE}
                strokeWidth={2}
                fill={SLATE}
                fillOpacity={0.1}
                dot={false}
                activeDot={{ r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

function DonutWithTotal({
  entries,
  colors,
  total,
  totalLabel,
  height = 220,
}: {
  entries: { name: string; key: string; value: number }[];
  colors: Record<string, string>;
  total: number;
  totalLabel: string;
  height?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-[220px]" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={entries}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={2}
              strokeWidth={1}
              stroke="#ffffff"
            >
              {entries.map((e) => (
                <Cell key={e.key} fill={colors[e.key] ?? "#9BA3AF"} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold tabular-nums text-slate-900">{total.toLocaleString()}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{totalLabel}</p>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {entries.map((e) => (
          <li key={e.key} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colors[e.key] ?? "#9BA3AF" }} />
              <span className="whitespace-normal">{e.name}</span>
            </span>
            <span className="shrink-0 font-bold tabular-nums text-slate-900">{e.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReportTypePie({ data }: { data: DashboardDistributions | null }) {
  const order: (keyof DashboardDistributions["reportType"])[] = ["UNSAFE_ACT", "UNSAFE_CONDITION", "NEAR_MISS"];
  const entries = data ? order.map((k) => ({ name: TYPE_LABELS[k], key: k, value: data.reportType[k] ?? 0 })) : [];
  const total = entries.reduce((n, e) => n + e.value, 0);
  const max = Math.max(1, ...entries.map((e) => e.value));
  return (
    <ChartCard title="Report Type Distribution" subtitle="Share of reports by category">
      {total === 0 ? (
        <EmptyState message="No reports available for this period." />
      ) : (
        <ul className="space-y-4 py-1">
          {entries.map((e) => (
            <li key={e.key}>
              <div className="mb-1.5 flex items-start justify-between gap-3 text-[13px]">
                <span className="min-w-0 font-medium text-slate-700">{e.name}</span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                  {e.value.toLocaleString()}
                  <span className="ml-2 font-medium text-slate-500">{((e.value / total) * 100).toFixed(0)}%</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#E7E1D4]" role="img" aria-label={`${e.name}: ${e.value} reports`}>
                <div className="h-full rounded-full bg-[#C8791A]" style={{ width: `${(e.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}

export function SifPie({ data }: { data: DashboardDistributions | null }) {
  const entries = data
    ? [
        { name: "SIF Potential", key: "sif", value: data.sif.sif },
        { name: "Non-SIF", key: "nonSif", value: data.sif.nonSif },
        { name: "Unanalyzed", key: "unanalyzed", value: data.sif.unanalyzed },
      ]
    : [];
  const colors: Record<string, string> = { sif: BLUE, nonSif: SLATE, unanalyzed: PALE };
  const total = entries.reduce((n, e) => n + e.value, 0);
  return (
    <ChartCard
      title="SIF Distribution"
      subtitle="AI-flagged SIF potential · missing analysis means Unanalyzed, not non-SIF"
    >
      {total === 0 ? (
        <EmptyState message="No completed AI analyses available." />
      ) : (
        <DonutWithTotal entries={entries} colors={colors} total={total} totalLabel="Reports" />
      )}
    </ChartCard>
  );
}

export function PriorityChart({ data }: { data: DashboardDistributions | null }) {
  const entries = data
    ? [
        { name: "High / Critical", key: "high", value: (data.priority.HIGH ?? 0) + (data.priority.CRITICAL ?? 0) },
        { name: "Medium", key: "medium", value: data.priority.MEDIUM ?? 0 },
        { name: "Low", key: "low", value: data.priority.LOW ?? 0 },
      ]
    : [];
  const colors: Record<string, string> = { high: BLUE, medium: SLATE, low: PALE };
  const total = entries.reduce((n, e) => n + e.value, 0);
  return (
    <ChartCard
      title="Priority Distribution"
      subtitle="AI priority only — not an official OIL risk score"
    >
      {total === 0 ? (
        <EmptyState message="No completed AI analyses available." />
      ) : (
        <DonutWithTotal entries={entries} colors={colors} total={total} totalLabel="Analyzed" />
      )}
    </ChartCard>
  );
}

export function SiteChart({ items }: { items: SiteAnalytic[] }) {
  const top = items.slice(0, 8);
  return (
    <ChartCard title="Reports by Site" subtitle="Top sites by report count">
      {top.length === 0 ? (
        <EmptyState message="No reports available for this period." />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }} barCategoryGap="24%">
              <CartesianGrid stroke="#E7E1D4" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "#E7E1D4" }} />
              <YAxis type="category" dataKey="siteName" width={110} tick={{ ...AXIS_TICK, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F2EEE5" }} />
              <Legend formatter={(v) => <LegendText value={v} />} iconSize={10} />
              <Bar dataKey="reportCount" name="Reports" fill="#C8791A" barSize={12} radius={[0, 3, 3, 0]} />
              <Bar dataKey="sifCount" name="SIF (AI)" fill="#9BA3AF" barSize={12} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function ActivityChart({ items }: { items: ActivityAnalytic[] }) {
  const top = items.slice(0, 8);
  return (
    <ChartCard title="Reports by Activity" subtitle="Uses the report activity field">
      {top.length === 0 ? (
        <EmptyState message="No reports available for this period." />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }} barCategoryGap="24%">
              <CartesianGrid stroke="#E7E1D4" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "#E7E1D4" }} />
              <YAxis type="category" dataKey="activity" width={110} tick={{ ...AXIS_TICK, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F2EEE5" }} />
              <Legend formatter={(v) => <LegendText value={v} />} iconSize={10} />
              <Bar dataKey="reportCount" name="Reports" fill="#C8791A" barSize={12} radius={[0, 3, 3, 0]} />
              <Bar dataKey="sifCount" name="SIF (AI)" fill="#9BA3AF" barSize={12} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function RuleChart({ items }: { items: RuleAnalytic[] }) {
  const top = items.slice(0, 8);
  return (
    <ChartCard
      title="Life-Saving Rule Distribution"
      subtitle="Completed AI analyses with a resolved rule — prototype rules are labelled"
    >
      {top.length === 0 ? (
        <EmptyState message="No resolved Life-Saving Rules for this period." />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }} barCategoryGap="24%">
              <CartesianGrid stroke="#E7E1D4" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "#E7E1D4" }} />
              <YAxis type="category" dataKey="ruleCode" width={90} tick={{ ...AXIS_TICK, fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F2EEE5" }} />
              <Legend formatter={(v) => <LegendText value={v} />} iconSize={10} />
              <Bar dataKey="reportCount" name="Reports" fill="#C8791A" barSize={12} radius={[0, 3, 3, 0]} />
              <Bar dataKey="sifCount" name="SIF (AI)" fill="#9BA3AF" barSize={12} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
