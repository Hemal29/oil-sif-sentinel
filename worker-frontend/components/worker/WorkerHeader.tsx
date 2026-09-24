"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { fetchCurrentUser, getStoredUser, logout } from "@/lib/auth";
import { fetchUnreadCount, fetchNotifications, markNotificationRead, markAllNotificationsRead, type Notification } from "@/lib/api";
import type { User } from "@/types/user";

const WORKER_NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/reports", label: "My Reports" },
  { href: "/reports/new", label: "New Report" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function WorkerHeader({ title }: { title: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setUser(getStoredUser());
    fetchCurrentUser().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setProfileOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileOpen]);

  const refreshUnread = async () => {
    try { const r = await fetchUnreadCount(); setUnreadCount(r.count); } catch {}
  };
  const refreshNotifications = async () => {
    try {
      const r = await fetchNotifications({ limit: 8 });
      setNotifications(r.items);
    } catch {}
  };
  useEffect(() => {
    refreshUnread();
    const id = setInterval(refreshUnread, 25000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!bellOpen) return;
    refreshNotifications();
    refreshUnread();
    function handleClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    function handleEscape(e: KeyboardEvent) { if (e.key === "Escape") setBellOpen(false); }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [bellOpen]);

  async function handleNotificationClick(n: Notification) {
    try { if (!n.isRead) { await markNotificationRead(n.id); setUnreadCount((c) => Math.max(0, c - 1)); setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x)); } } catch {}
    setBellOpen(false);
    if (n.reportId) {
      router.push(`/reports/${n.reportId}`);
    } else {
      router.push("/notifications");
    }
  }
  async function handleMarkAllRead() {
    try { await markAllNotificationsRead(); setUnreadCount(0); setNotifications((prev) => prev.map((x) => ({ ...x, isRead: true }))); } catch {}
  }

  function onLogout() { logout(); router.push("/login"); }

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0D1117]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[56px] w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded p-1.5 text-white/50 hover:bg-white/10 lg:hidden" aria-label="Toggle navigation">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Link href="/" className="flex items-center gap-2.5 min-w-0" aria-label="OIL SIF Sentinel Worker">
            <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[rgba(0,229,255,0.10)] text-[12px] font-extrabold text-[#00E5FF] ring-1 ring-white/10">OS</span>
            <span className="min-w-0 hidden sm:block">
              <span className="block font-display text-[12px] font-bold uppercase tracking-[0.12em] text-white leading-none">OIL SIF Sentinel</span>
              <span className="block font-mono text-[11px] font-normal text-white/40 leading-none mt-0.5">{title} — Worker Portal</span>
            </span>
            <span className="sm:hidden font-display text-[12px] font-bold text-white">{title}</span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex ml-4" aria-label="Worker navigation">
            {WORKER_NAV.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                  className={`rounded-[8px] px-3 py-1.5 text-[13px] font-medium ${active ? "bg-[rgba(0,229,255,0.12)] text-[#00E5FF]" : "text-white/50 hover:bg-white/[0.05] hover:text-white"}`}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setBellOpen((v) => !v)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setBellOpen((v) => !v); } }}
              aria-label="Notifications"
              aria-haspopup="menu"
              aria-expanded={bellOpen}
              className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white border border-white/10 hover:bg-white/[0.10] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a2.25 2.25 0 01-3.714 0M5.25 9a6.75 6.75 0 0113.5 0c0 3.866 1.5 5.25 1.5 6.75H3.75c0-1.5 1.5-2.884 1.5-6.75z" />
              </svg>
              {unreadCount > 0 ? <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#00E5FF] px-1 font-mono text-[10px] font-bold leading-none text-[#0A0D12] ring-1 ring-white/20">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
            </button>
            {bellOpen ? (
              <div className="absolute right-0 top-[calc(100%+8px)] w-[360px] max-w-[calc(100vw-16px)] overflow-hidden rounded-[12px] border border-white/10 bg-[#151C26] shadow-[0_16px_40px_rgba(0,0,0,0.45)] z-50" role="menu" aria-label="Notifications">
                <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-3 py-2">
                  <span className="text-[13px] font-semibold text-white">Notifications</span>
                  <button onClick={handleMarkAllRead} className="text-[11px] font-semibold text-[#00E5FF] hover:underline">Mark all as read</button>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-3 py-6 text-center text-[13px] text-white/40">No notifications yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <button key={n.id} role="menuitem" onClick={() => handleNotificationClick(n)} className={`flex w-full gap-2 border-b border-white/5 px-3 py-2.5 text-left hover:bg-white/[0.03] ${!n.isRead ? "bg-[rgba(0,229,255,0.06)]" : ""}`}>
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${!n.isRead ? "bg-[#00E5FF]" : "bg-transparent"}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[13px] ${!n.isRead ? "font-semibold text-white" : "font-medium text-white/70"}`}>{n.title}</span>
                          <span className="block truncate text-[11px] text-white/40">{n.message.slice(0,80)}</span>
                          <span className="block font-mono text-[10px] text-white/25">{new Date(n.createdAt).toLocaleString([], { month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" })}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
                <div className="border-t border-white/5 bg-white/[0.02] text-center">
                  <a href="/notifications" onClick={() => setBellOpen(false)} className="block px-3 py-2 text-[12px] font-semibold text-[#00E5FF] hover:underline">View all notifications</a>
                </div>
              </div>
            ) : null}
          </div>
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((v) => !v)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setProfileOpen((v) => !v); } }}
              aria-label="Open profile menu"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white ring-1 ring-white/10 hover:bg-white/[0.10] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0" />
              </svg>
            </button>
            {profileOpen ? (
              <div className="absolute right-0 top-[calc(100%+8px)] w-[220px] overflow-hidden rounded-[12px] border border-white/10 bg-[#151C26] shadow-[0_16px_40px_rgba(0,0,0,0.45)] z-50" role="menu" aria-label="Profile menu">
                <div className="flex items-center gap-3 border-b border-white/5 bg-white/[0.02] px-3 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0A0D12] text-[11px] font-bold text-[#00E5FF] ring-1 ring-white/10">
                    {user ? user.name.charAt(0).toUpperCase() : "W"}
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-[13px] font-semibold leading-none text-white">{user ? user.name : "Worker User"}</span>
                    <span className="block truncate font-mono text-[11px] font-medium uppercase tracking-wide text-white/40 leading-none mt-1">Worker</span>
                  </span>
                </div>
                <nav className="py-1" aria-label="Profile navigation">
                  <Link href="/profile" role="menuitem" onClick={() => setProfileOpen(false)} className="flex w-full items-center px-3 py-2 text-[13px] font-medium text-white/70 hover:bg-white/[0.04] hover:text-white">Profile</Link>
                  <Link href="/reports" role="menuitem" onClick={() => setProfileOpen(false)} className="flex w-full items-center px-3 py-2 text-[13px] font-medium text-white/70 hover:bg-white/[0.04] hover:text-white">My Reports</Link>
                </nav>
                <div className="border-t border-white/5 py-1">
                  <button role="menuitem" onClick={() => { setProfileOpen(false); onLogout(); }} className="flex w-full items-center px-3 py-2 text-left text-[13px] font-medium text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)]">Logout</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {mobileOpen ? (
        <nav className="border-t border-white/5 lg:hidden" aria-label="Mobile worker navigation">
          <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8 py-2">
            {WORKER_NAV.map((n) => {
              const active = isActive(pathname, n.href);
              return <Link key={n.href} href={n.href} onClick={() => setMobileOpen(false)} className={`block rounded px-3 py-2 text-sm font-medium ${active ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white"}`}>{n.label}</Link>;
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
