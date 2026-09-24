"use client";

import { useEffect, useRef } from "react";
import { XIcon } from "./Icons";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  icon,
  accent = "navy",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  accent?: "navy" | "red" | "orange" | "amber" | "green" | "blue" | "slate";
}) {
  void accent;
  return (
    <div className="group rounded-[12px] border border-white/[0.08] bg-[#131B24] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.45)] backdrop-blur-[8px] transition-all duration-200 hover:border-[rgba(0,229,255,0.16)] hover:shadow-[0_0_20px_rgba(0,229,255,0.08),0_4px_24px_rgba(0,0,0,0.45)] hover:bg-[#161F2B]">
      <div className="flex items-center gap-2.5">
        {icon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[rgba(0,229,255,0.10)] text-[#00E5FF] ring-1 ring-[rgba(0,229,255,0.14)] [&_svg]:h-4 [&_svg]:w-4">
            {icon}
          </span>
        ) : null}
        <p className="text-[11.5px] font-bold uppercase tracking-[0.07em] text-[#94A3B8]">{label}</p>
      </div>
      <p className="mt-3 text-[32px] font-bold leading-none tracking-tight text-white tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {hint ? <p className="mt-2 text-[12.5px] leading-relaxed text-[#64748B]">{hint}</p> : null}
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="rounded-[12px] border border-white/[0.08] bg-[#131B24] p-5" aria-hidden="true">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-3 h-8 w-20" />
      <div className="skeleton mt-3 h-3 w-32" />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-subtitle">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Modal({
  title,
  description,
  children,
  onClose,
  wide,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#080A0E]/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={cn(
          "w-full rounded-[14px] border border-white/[0.08] bg-[#161F2B] shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-[8px]",
          wide ? "max-w-[640px]" : "max-w-[480px]"
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-[16px] font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-heading)" }}>{title}</h2>
            {description ? <p className="mt-1 text-[13px] text-[#94A3B8]">{description}</p> : null}
          </div>
          <button onClick={onClose} aria-label="Close dialog" className="rounded-lg p-1.5 text-[#64748B] hover:bg-white/[0.06] hover:text-white">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
