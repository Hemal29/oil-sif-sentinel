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
    <div className="flex min-h-[150px] items-center gap-4 rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:min-h-[160px] sm:p-6">
      {icon ? (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FEF3E7] text-[#D97706] [&_svg]:h-[22px] [&_svg]:w-[22px]">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block text-[11.5px] font-bold uppercase tracking-[0.07em] text-[#64748B]">{label}</span>
        <span className="mt-1 block text-[30px] font-bold leading-none tracking-tight text-[#0F172A] tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {hint ? <span className="mt-1.5 block text-[12.5px] text-[#64748B]">{hint}</span> : null}
      </span>
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5" aria-hidden="true">
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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#0F172A]/50 p-4"
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
          "w-full rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.25)]",
          wide ? "max-w-[640px]" : "max-w-[480px]"
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#EDF1F6] px-5 py-4">
          <div>
            <h2 className="text-[16px] font-bold tracking-tight text-[#0F172A]">{title}</h2>
            {description ? <p className="mt-1 text-[13px] text-[#64748B]">{description}</p> : null}
          </div>
          <button onClick={onClose} aria-label="Close dialog" className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
