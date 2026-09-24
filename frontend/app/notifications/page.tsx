"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type Notification } from "@/lib/api";
import { isUnauthorized } from "@/lib/api";
import { logout } from "@/lib/auth";
import { AppShell } from "@/components/common/AppShell";
import { EmptyState, ErrorState } from "@/components/common/States";
import { PageHeader } from "@/components/ui/primitives";
import { BellIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

function timeAgo(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function HseNotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");
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
        setTotal(r.pagination.total);
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
    load(1);
  }, [load]);

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

  const visible = filter === "unread" ? items.filter((n) => !n.isRead) : items;
  const unread = items.filter((n) => !n.isRead).length;

  return (
    <AppShell title="Notifications">
      <div className="space-y-5">
        <PageHeader
          eyebrow="HSE · Safety Management"
          title="Notification Center"
          description="HSE alerts, review updates and system messages."
          actions={
            <button onClick={handleMarkAll} className="button-secondary">
              Mark all as read
            </button>
          }
        />

        <div className="flex items-center gap-1.5" role="tablist" aria-label="Notification filter">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-all",
                filter === f ? "bg-[#00E5FF] text-[#080A0E] shadow-[0_0_12px_rgba(0,229,255,0.30)]" : "border border-white/[0.06] bg-[#131B24] text-[#64748B] hover:bg-white/[0.04] hover:text-[#CBD5E1]"
              )}
            >
              {f === "all" ? `All (${total})` : `Unread (${unread})`}
            </button>
          ))}
        </div>

        {error ? (
          <ErrorState message={error} onRetry={() => load(page)} />
        ) : loading ? (
          <div className="panel space-y-2 p-5" aria-live="polite" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<BellIcon className="h-5 w-5" />}
            message={filter === "unread" ? "You're all caught up. No unread notifications." : "No notifications yet. HSE alerts and review updates will appear here."}
          />
        ) : (
          <div className="panel overflow-hidden">
            <ul className="divide-y divide-white/[0.06]">
              {visible.map((n) => (
                <li key={n.id}>
                  <button onClick={() => handleClick(n)} className={cn("flex w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.04]", !n.isRead ? "bg-[rgba(0,229,255,0.06)]" : "bg-transparent")}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(0,229,255,0.12)] text-[#00E5FF] ring-1 ring-[rgba(0,229,255,0.18)]" aria-hidden="true">
                      <BellIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={cn("text-[13.5px]", !n.isRead ? "font-bold text-white" : "font-medium text-[#CBD5E1]")}>{n.title}</span>
                        {!n.isRead ? <span className="badge badge-info">New</span> : <span className="badge badge-neutral">Read</span>}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-relaxed text-[#94A3B8]">{n.message}</span>
                      <span className="mt-1 block text-[11.5px] text-[#94A3B8]">{timeAgo(n.createdAt)}</span>
                    </span>
                    {n.reportId ? <span className="shrink-0 self-center text-[12.5px] font-semibold text-[#00E5FF]">Open →</span> : null}
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3.5">
              <button disabled={page <= 1} onClick={() => load(page - 1)} className="button-secondary px-4 text-[13px] disabled:opacity-40">
                Previous
              </button>
              <span className="text-[13px] tabular-nums text-[#64748B]">
                Page {page} of {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => load(page + 1)} className="button-secondary px-4 text-[13px] disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
