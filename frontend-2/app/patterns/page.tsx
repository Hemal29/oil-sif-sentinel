"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchPatterns, isUnauthorized, PatternItem } from "@/lib/api";
import { apiErrorMessage, logout } from "@/lib/auth";
import { AppShell } from "@/components/common/AppShell";
import { EmptyState, ErrorState } from "@/components/common/States";
import { StatusBadge } from "@/components/common/Badges";
import { PageHeader } from "@/components/ui/primitives";
import { PatternsIcon, SearchIcon } from "@/components/ui/Icons";

export default function PatternsPage() {
  const router = useRouter();
  const [items, setItems] = useState<PatternItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(
    async (p: number, q?: string) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetchPatterns({ page: p, limit: 20, search: q?.trim() || undefined });
        setItems(res.items);
        setTotal(res.pagination.total);
        setTotalPages(Math.max(1, res.pagination.totalPages));
        setPage(res.pagination.page);
      } catch (err: unknown) {
        if (isUnauthorized(err)) {
          logout();
          router.push("/login?expired=1");
          return;
        }
        setError(apiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    load(1, search);
  }
  function clear() {
    setSearch("");
    load(1, "");
  }

  return (
    <AppShell title="Safety Patterns">
      <div className="space-y-5">
        <PageHeader
          eyebrow="HSE · Safety Management"
          title="Safety Patterns"
          description="Recurring SIF precursor patterns detected across validated safety reports."
        />

        <form onSubmit={onSearch} className="filter-bar" role="search">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">Search</span>
            <span className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9BA3AF]" />
              <input
                type="search"
                placeholder="Search name or code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="field w-full pl-9"
                aria-label="Search patterns"
              />
            </span>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="button-primary">
              Search
            </button>
            <button type="button" onClick={clear} className="button-secondary">
              Clear
            </button>
          </div>
        </form>

        {error ? (
          <ErrorState message={error} onRetry={() => load(page, search)} />
        ) : loading ? (
          <div className="panel overflow-hidden" aria-live="polite" aria-busy="true">
            <div className="space-y-2 p-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-12" />
              ))}
            </div>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<PatternsIcon className="h-5 w-5" />}
            message="No safety patterns yet. Patterns will appear here as enough validated report data becomes available."
          />
        ) : (
          <div className="panel overflow-hidden">
            <div className="panel-header">
              <h2 className="section-title">
                {total.toLocaleString()} Pattern{total === 1 ? "" : "s"}
              </h2>
              <span className="text-[12px] tabular-nums text-[#6B7385]">
                Page {page} of {totalPages}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[760px]">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id}>
                      <td className="text-[13.5px] font-semibold text-[#14283F]">{p.name}</td>
                      <td className="font-mono text-[12px] text-[#4C5566]">{p.code ?? "—"}</td>
                      <td className="max-w-[360px] truncate text-[13px] text-[#4C5566]" title={p.description ?? ""}>
                        {p.description ?? <span className="text-[#9BA3AF]">—</span>}
                      </td>
                      <td>
                        <StatusBadge value={p.status} />
                      </td>
                      <td>
                        <Link href={`/patterns/${p.id}`} className="text-[12.5px] font-semibold text-[#C8791A] hover:underline">
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[#E7E1D4] px-5 py-3.5">
              <button disabled={page <= 1} onClick={() => load(page - 1, search)} className="button-secondary px-4 text-[13px] disabled:opacity-40">
                Previous
              </button>
              <span className="text-[13px] tabular-nums text-[#6B7385]">
                Page {page} of {totalPages} · {total.toLocaleString()} total
              </span>
              <button disabled={page >= totalPages} onClick={() => load(page + 1, search)} className="button-secondary px-4 text-[13px] disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
