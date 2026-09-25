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
    <header className="sticky top-0 z-40 bg-[#102A43] border-b border-[#0B1F33]">
      <div className="mx-auto flex h-[56px] w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded p-1.5 text-slate-300 hover:bg-white/10 lg:hidden" aria-label="Toggle navigation">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Link href="/" className="flex items-center gap-2.5 min-w-0" aria-label="OIL SIF Sentinel Worker">
            <span className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-white/[0.08] text-[12px] font-extrabold text-white ring-1 ring-white/15">OS</span>
            <span className="min-w-0 hidden sm:block">
              <span className="block text-[12px] font-bold uppercase tracking-[0.12em] text-white leading-none">OIL SIF Sentinel</span>
              <span className="block text-[11px] font-normal text-[#8FA8C3] leading-none mt-0.5">{title} — Worker Portal</span>
            </span>
            <span className="sm:hidden text-[12px] font-bold text-white">{title}</span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex ml-4" aria-label="Worker navigation">
            {WORKER_NAV.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                  className={`rounded-[4px] px-3 py-1.5 text-[13px] font-medium ${active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/[0.06] hover:text-white"}`}>
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
              className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a2.25 2.25 0 01-3.714 0M5.25 9a6.75 6.75 0 0113.5 0c0 3.866 1.5 5.25 1.5 6.75H3.75c0-1.5 1.5-2.884 1.5-6.75z" />
              </svg>
              {unreadCount > 0 ? <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#C62828] px-1 text-[10px] font-bold leading-none text-white ring-1 ring-white">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
            </button>
            {bellOpen ? (
              <div className="absolute right-0 top-[calc(100%+8px)] w-[360px] max-w-[calc(100vw-16px)] overflow-hidden rounded-[6px] border border-[#D9E2EC] bg-white shadow-[0_8px_24px_rgba(16,42,67,0.15)] z-50" role="menu" aria-label="Notifications">
                <div className="flex items-center justify-between border-b border-[#E8EEF4] bg-[#F8FAFC] px-3 py-2">
                  <span className="text-[13px] font-semibold text-[#102A43]">Notifications</span>
                  <button onClick={handleMarkAllRead} className="text-[11px] font-semibold text-[#1565C0] hover:underline">Mark all as read</button>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="px-3 py-6 text-center text-[13px] text-[#8A9BB0]">No notifications yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <button key={n.id} role="menuitem" onClick={() => handleNotificationClick(n)} className={`flex w-full gap-2 border-b border-[#F4F6F8] px-3 py-2.5 text-left hover:bg-[#F8FAFC] ${!n.isRead ? "bg-[#F4F6F8]/60" : ""}`}>
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${!n.isRead ? "bg-[#1565C0]" : "bg-transparent"}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-[13px] ${!n.isRead ? "font-semibold text-[#102A43]" : "font-medium text-[#243B53]"}`}>{n.title}</span>
                          <span className="block truncate text-[11px] text-[#627D98]">{n.message.slice(0,80)}</span>
                          <span className="block text-[10px] text-[#8A9BB0]">{new Date(n.createdAt).toLocaleString([], { month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" })}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
                <div className="border-t border-[#E8EEF4] bg-[#F8FAFC] text-center">
                  <a href="/notifications" onClick={() => setBellOpen(false)} className="block px-3 py-2 text-[12px] font-semibold text-[#1565C0] hover:underline">View all notifications</a>
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
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0" />
              </svg>
            </button>
            {profileOpen ? (
              <div className="absolute right-0 top-[calc(100%+8px)] w-[220px] overflow-hidden rounded-[6px] border border-[#D9E2EC] bg-white shadow-[0_4px_12px_rgba(16,42,67,0.12)] z-50" role="menu" aria-label="Profile menu">
                <div className="flex items-center gap-3 border-b border-[#E8EEF4] bg-[#F8FAFC] px-3 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#102A43] text-[11px] font-bold text-white">
                    {user ? user.name.charAt(0).toUpperCase() : "W"}
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-[13px] font-semibold leading-none text-[#102A43]">{user ? user.name : "Worker User"}</span>
                    <span className="block truncate text-[11px] font-medium uppercase tracking-wide text-[#627D98] leading-none mt-1">Worker</span>
                  </span>
                </div>
                <nav className="py-1" aria-label="Profile navigation">
                  <Link href="/profile" role="menuitem" onClick={() => setProfileOpen(false)} className="flex w-full items-center px-3 py-2 text-[13px] font-medium text-[#243B53] hover:bg-[#F4F6F8]">Profile</Link>
                  <Link href="/reports" role="menuitem" onClick={() => setProfileOpen(false)} className="flex w-full items-center px-3 py-2 text-[13px] font-medium text-[#243B53] hover:bg-[#F4F6F8]">My Reports</Link>
                </nav>
                <div className="border-t border-[#E8EEF4] py-1">
                  <button role="menuitem" onClick={() => { setProfileOpen(false); onLogout(); }} className="flex w-full items-center px-3 py-2 text-left text-[13px] font-medium text-[#C62828] hover:bg-[#FCE8E9]">Logout</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {mobileOpen ? (
        <nav className="border-t border-white/10 lg:hidden" aria-label="Mobile worker navigation">
          <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8 py-2">
            {WORKER_NAV.map((n) => {
              const active = isActive(pathname, n.href);
              return <Link key={n.href} href={n.href} onClick={() => setMobileOpen(false)} className={`block rounded px-3 py-2 text-sm font-medium ${active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>{n.label}</Link>;
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
