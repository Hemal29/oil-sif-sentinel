"use client";

export function SkeletonCard() {
  return (
    <div className="panel animate-pulse p-5">
      <div className="h-3 w-24 rounded bg-slate-200" />
      <div className="mt-3 h-8 w-1/2 rounded bg-slate-200" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="panel animate-pulse p-5">
      <div className="h-4 w-32 rounded bg-slate-200" />
      <div className="mt-4 h-56 rounded bg-slate-100" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse rounded-lg border border-slate-200 bg-white p-5">
      <div className="h-4 w-24 rounded bg-slate-200" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-8 rounded bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded border border-dashed border-slate-300 bg-[#FAF8F4] px-4 py-8 text-center">
      <p className="text-sm font-medium text-slate-500">{message}</p>
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm font-semibold text-red-800">Something went wrong</p>
      <p className="mt-1 text-sm text-red-700">Unable to load this data. {message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
      >
        Retry
      </button>
    </div>
  );
}
