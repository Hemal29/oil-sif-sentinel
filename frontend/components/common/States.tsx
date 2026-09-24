"use client";
import { cn } from "@/lib/utils";
import { InboxIcon } from "@/components/ui/Icons";

export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="space-y-3 py-6" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-[#00E5FF]" aria-hidden="true" />
        <span className="text-[13px] font-medium text-[#94A3B8]">{message}</span>
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
    <div className="flex flex-col items-center justify-center rounded-[12px] border border-dashed border-white/[0.10] bg-[#131B24]/60 px-6 py-12 text-center backdrop-blur-[8px]">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[12px] border border-white/[0.08] bg-white/[0.04] text-[#64748B]">
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
    <div className="rounded-[12px] border border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.08)] px-5 py-6 text-center backdrop-blur-[8px]">
      <p className="text-[14px] font-semibold text-[#F87171]">Unable to load data</p>
      <p className="mx-auto mt-1 max-w-[60ch] text-[13px] text-[#FCA5A5]">{message}</p>
      <p className="mt-1 text-[12px] text-[#FCA5A5]/70">Please check your connection and try again.</p>
      <button onClick={onRetry} className="button-secondary mt-4 px-5 text-[13px]">
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
    primary: "bg-[rgba(0,229,255,0.14)] text-[#00E5FF] ring-[rgba(0,229,255,0.20)]",
    critical: "bg-[rgba(239,68,68,0.14)] text-[#F87171] ring-[rgba(239,68,68,0.22)]",
    high: "bg-[rgba(245,158,11,0.14)] text-[#F59E0B] ring-[rgba(245,158,11,0.22)]",
    medium: "bg-[rgba(245,158,11,0.10)] text-[#F59E0B] ring-[rgba(245,158,11,0.16)]",
    success: "bg-[rgba(16,185,129,0.14)] text-[#34D399] ring-[rgba(16,185,129,0.20)]",
    default: "bg-[rgba(0,229,255,0.14)] text-[#00E5FF] ring-[rgba(0,229,255,0.20)]",
  };
  return (
    <div className="group rounded-[12px] border border-white/[0.08] bg-[#131B24] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.45)] backdrop-blur-[8px] transition-all duration-200 hover:border-[rgba(0,229,255,0.14)] hover:bg-[#161F2B] hover:shadow-[0_0_20px_rgba(0,229,255,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">{label}</p>
        {icon ? (
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ring-1", accent[variant])}>{icon}</span>
        ) : null}
      </div>
      <p className="mt-2 text-[30px] font-bold leading-none tracking-tight text-white tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>{value.toLocaleString()}</p>
      <p className="mt-2 text-[12px] text-[#64748B]">{hint}</p>
    </div>
  );
}
export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[18px] font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-heading)" }}>{title}</h2>
      {description ? <p className="mt-1 text-[13px] text-[#94A3B8]">{description}</p> : null}
    </div>
  );
}
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-subtitle">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
export const TH = "whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-[#94A3B8] bg-[#0B0E14] border-b border-white/[0.06]";
export const TD = "whitespace-nowrap px-3 py-2.5 text-[13px] text-white border-b border-white/[0.05]";
export function ScrollTable({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}
