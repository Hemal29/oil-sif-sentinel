"use client";
import { cn } from "@/lib/utils";
import { InboxIcon } from "@/components/ui/Icons";

export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="space-y-3 py-6" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-[#00E5FF]" aria-hidden="true" />
        <span className="text-[13px] font-medium text-white/50">{message}</span>
      </div>
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-3 w-full" />
        ))}
      </div>
    </div>
  );
}
export function SkeletonCard() {
  return (
    <div className="panel animate-pulse space-y-3 p-5">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton h-7 w-1/2" />
    </div>
  );
}
export function SkeletonChart() {
  return (
    <div className="panel animate-pulse p-5">
      <div className="skeleton h-4 w-32" />
      <div className="skeleton mt-4 h-48" />
    </div>
  );
}
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="panel animate-pulse space-y-2 p-5">
      <div className="skeleton h-4 w-24" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-9" />
      ))}
    </div>
  );
}

export function EmptyState({ message, action, icon }: { message: string; action?: { label: string; href: string }; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#151C26] px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03] text-white/30">
        {icon ?? <InboxIcon className="h-5 w-5" />}
      </div>
      <p className="max-w-[52ch] text-[14px] font-semibold text-white">{message}</p>
      {action ? (
        <a href={action.href} className="button-primary mt-5 px-5 text-[13px]">
          {action.label}
        </a>
      ) : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-[rgba(239,68,68,0.20)] bg-[rgba(239,68,68,0.08)] px-5 py-6 text-center">
      <p className="text-[14px] font-semibold text-[#FCA5A5]">Unable to load data</p>
      <p className="mx-auto mt-1 max-w-[60ch] text-[13px] text-[#FCA5A5]/80">{message}</p>
      <p className="mt-1 text-[12px] text-[#FCA5A5]/60">Please check your connection and try again.</p>
      <button onClick={onRetry} className="button-secondary mt-4 px-5 text-[13px] border-[rgba(239,68,68,0.20)] hover:bg-[rgba(239,68,68,0.10)]">
        Try again
      </button>
    </div>
  );
}

export function Card({ title, subtitle, children, className, actions }: { title?: string; subtitle?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("panel", className)}>
      {title || subtitle || actions ? (
        <div className="panel-header">
          <div className="min-w-0">
            {title ? <h2 className="section-title">{title}</h2> : null}
            {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="panel-body">{children}</div>
    </section>
  );
}
export function ChartCard({ title, subtitle, children, className }: { title?: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("panel", className)}>
      {title || subtitle ? (
        <div className="panel-header">
          <div>
            {title ? <h3 className="section-title">{title}</h3> : null}
            {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
          </div>
        </div>
      ) : null}
      <div className="panel-body">{children}</div>
    </section>
  );
}
export function KpiCard({ label, value, hint, icon, variant = "primary" }: { label: string; value: number; hint: string; icon?: React.ReactNode; variant?: "primary" | "critical" | "high" | "medium" | "success" | "default" }) {
  const accent: Record<string, string> = {
    primary: "bg-[rgba(0,229,255,0.12)] text-[#00E5FF]",
    critical: "bg-[rgba(239,68,68,0.12)] text-[#EF4444]",
    high: "bg-[rgba(245,158,11,0.12)] text-[#F59E0B]",
    medium: "bg-[rgba(245,158,11,0.12)] text-[#F59E0B]",
    success: "bg-[rgba(16,185,129,0.12)] text-[#10B981]",
    default: "bg-[rgba(0,229,255,0.10)] text-[#00E5FF]",
  };
  return (
    <div className="rounded-2xl border border-white/5 bg-[#151C26] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-white/40">{label}</p>
        {icon ? (
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]", accent[variant])}>{icon}</span>
        ) : null}
      </div>
      <p className="mt-2 font-display text-[30px] font-bold leading-none tracking-tight text-white tabular-nums">{value.toLocaleString()}</p>
      <p className="mt-2 text-[12px] text-white/45">{hint}</p>
    </div>
  );
}
export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-[18px] font-bold tracking-tight text-white">{title}</h2>
      {description ? <p className="mt-1 text-[13px] text-white/45">{description}</p> : null}
    </div>
  );
}
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="page-title text-white">{title}</h1>
        {description ? <p className="page-subtitle text-white/50">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
export const TH = "whitespace-nowrap px-3 py-2.5 text-left font-mono text-[11px] font-bold uppercase tracking-wide text-white/35 bg-[#0A0D12] border-b border-white/5";
export const TD = "whitespace-nowrap px-3 py-2.5 text-[13px] text-white border-b border-white/5";
export function ScrollTable({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}
