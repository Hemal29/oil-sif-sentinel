"use client";

export function SkeletonCard() {
  return (
    <div className="panel animate-pulse p-5">
      <div className="h-3 w-24 rounded skeleton" />
      <div className="mt-3 h-8 w-1/2 rounded skeleton" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="panel animate-pulse p-5">
      <div className="h-4 w-32 rounded skeleton" />
      <div className="mt-4 h-56 rounded skeleton" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse rounded-[12px] border border-white/[0.08] bg-[#131B24] p-5">
      <div className="h-4 w-24 rounded skeleton" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-8 rounded skeleton" />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-[12px] border border-dashed border-white/[0.10] bg-[#131B24]/60 px-4 py-8 text-center backdrop-blur-[8px]">
      <p className="text-sm font-medium text-[#94A3B8]">{message}</p>
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-[12px] border border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.10)] p-6 text-center backdrop-blur-[8px]">
      <p className="text-sm font-semibold text-[#F87171]">Something went wrong</p>
      <p className="mt-1 text-sm text-[#FCA5A5]">Unable to load this data. {message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-[8px] bg-[#F59E0B] px-4 py-2 text-sm font-semibold text-[#0B0E14] hover:bg-[#FFB020]"
      >
        Retry
      </button>
    </div>
  );
}
