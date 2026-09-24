"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type Notification } from "@/lib/api";
import { isUnauthorized } from "@/lib/api";
import { logout } from "@/lib/auth";
import { useWorkerUser } from "@/components/worker/workerGuard";
import { WorkerShell } from "@/components/worker/WorkerShell";
import { ErrorState, LoadingState, EmptyState } from "@/components/common/States";
import { PageHeader } from "@/components/ui/primitives";
import { BellIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function WorkerNotificationsPage() {
  const router = useRouter();
  const user = useWorkerUser();
  const [items, setItems] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (p = 1) => {
      setLoading(true);
      setError("");
      try {
        const r = await fetchNotifications({ page: p, limit: 20 });
        setItems(r.items);
        setPage(r.pagination.page);
        setTotalPages(Math.max(1, r.pagination.totalPages));
      } catch (err: unknown) {
        if (isUnauthorized(err)) {
          logout();
          router.push("/login?expired=1");
          return;
        }
        setError("Unable to load notifications.");
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    if (user) load(1);
  }, [user, load]);

  async function handleClick(n: Notification) {
    try {
      if (!n.isRead) {
        await markNotificationRead(n.id);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      }
    } catch {}
    if (n.reportId) router.push(`/reports/${n.reportId}`);
  }
  async function handleMarkAll() {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    } catch {}
  }

  return (
    <WorkerShell title="Notifications">
      <div className="mx-auto w-full max-w-[720px] space-y-4 sm:space-y-5">
        <PageHeader
          title="Notifications"
          description="Updates about your reports and HSE reviews."
          actions={
            <button onClick={handleMarkAll} className="button-secondary h-10 px-4 text-[13px]">
              Mark all as read
            </button>
          }
        />
        {!user ? (
          <LoadingState message="Loading…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => load(page)} />
        ) : loading ? (
          <div className="panel space-y-2 p-5" aria-live="polite" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-16" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<BellIcon className="h-5 w-5" />} message="You're all caught up. No new notifications." />
        ) : (
          <div className="panel overflow-hidden">
            <ul className="divide-y divide-white/5">
              {items.map((n) => (
                <li key={n.id}>
                  <button onClick={() => handleClick(n)} className={cn("flex w-full gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02] sm:px-5", !n.isRead ? "bg-[rgba(0,229,255,0.06)]" : "bg-transparent")}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(0,229,255,0.12)] text-[#00E5FF] ring-1 ring-[#00E5FF]/15" aria-hidden="true">
                      <BellIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={cn("text-[13.5px]", !n.isRead ? "font-bold text-white" : "font-medium text-white/70")}>{n.title}</span>
                        {!n.isRead ? <span className="badge badge-info">New</span> : <span className="badge badge-neutral">Read</span>}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-relaxed text-white/50">{n.message}</span>
                      <span className="mt-1 block font-mono text-[11.5px] text-white/25">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-white/5 px-4 py-3.5 sm:px-5">
              <button disabled={page <= 1} onClick={() => load(page - 1)} className="button-secondary h-10 px-4 text-[13px] disabled:opacity-40">
                Previous
              </button>
              <span className="font-mono text-[13px] tabular-nums text-white/35">
                Page {page} of {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => load(page + 1)} className="button-secondary h-10 px-4 text-[13px] disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </WorkerShell>
  );
}
