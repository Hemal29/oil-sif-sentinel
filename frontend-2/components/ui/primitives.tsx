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
    <div className="rounded-[14px] border border-[#E7E1D4] bg-white p-5 shadow-[0_1px_2px_rgba(20,40,63,0.05)] transition-shadow hover:shadow-[0_8px_20px_rgba(20,40,63,0.08)]">
      <div className="flex items-center gap-2.5">
        {icon ? <span className="shrink-0 text-[#C8791A] [&_svg]:h-5 [&_svg]:w-5">{icon}</span> : null}
        <p className="text-[11.5px] font-bold uppercase tracking-[0.07em] text-[#6B7385]">{label}</p>
      </div>
      <p className="mt-3 font-heading text-[32px] font-extrabold leading-none tracking-tight text-[#14283F] tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {hint ? <p className="mt-2 text-[12.5px] leading-relaxed text-[#6B7385]">{hint}</p> : null}
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-[#E7E1D4] bg-white p-5" aria-hidden="true">
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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#14283F]/50 p-4"
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
          "w-full rounded-2xl border border-[#E7E1D4] bg-white shadow-[0_24px_64px_rgba(20,40,63,0.25)]",
          wide ? "max-w-[640px]" : "max-w-[480px]"
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#EFEADF] px-5 py-4">
          <div>
            <h2 className="text-[16px] font-bold tracking-tight text-[#14283F]">{title}</h2>
            {description ? <p className="mt-1 text-[13px] text-[#6B7385]">{description}</p> : null}
          </div>
          <button onClick={onClose} aria-label="Close dialog" className="rounded-lg p-1.5 text-[#6B7385] hover:bg-[#F2EEE5] hover:text-[#14283F]">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
