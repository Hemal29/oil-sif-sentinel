"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fetchCurrentUser, getStoredUser, logout } from "@/lib/auth";
import { fetchNotifications, fetchUnreadCount, markNotificationRead, markAllNotificationsRead, type Notification } from "@/lib/api";
import type { User } from "@/types/user";
import {
  ActivitiesIcon,
  BellIcon,
  CalendarIcon,
  DashboardIcon,
  ImportsIcon,
  LogoutIcon,
  MenuIcon,
  PatternsIcon,
  ReportsIcon,
  ReviewsIcon,
  RulesIcon,
  SearchIcon,
  SettingsIcon,
  SitesIcon,
  UserIcon,
  XIcon,
} from "@/components/ui/Icons";

const NAV_GROUPS: { label: string | null; items: { href: string; label: string; icon: (p: { className?: string }) => React.ReactNode }[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: DashboardIcon }],
  },
  {
    label: "Safety Management",
    items: [
      { href: "/reports", label: "Reports", icon: ReportsIcon },
      { href: "/reviews", label: "Reviews", icon: ReviewsIcon },
      { href: "/patterns", label: "Patterns", icon: PatternsIcon },
      { href: "/notifications", label: "Notifications", icon: BellIcon },
    ],
  },
  {
    label: "Master Data",
    items: [
      { href: "/sites", label: "Sites", icon: SitesIcon },
      { href: "/activities", label: "Activities", icon: ActivitiesIcon },
      { href: "/rules", label: "Life-Saving Rules", icon: RulesIcon },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/imports", label: "Imports", icon: ImportsIcon },
      { href: "/profile", label: "Settings", icon: SettingsIcon },
    ],
  },
];

const CRUMBS: { match: (p: string) => boolean; trail: string[] }[] = [
  { match: (p) => p === "/dashboard", trail: ["HSE", "Dashboard"] },
  { match: (p) => p === "/reports", trail: ["HSE", "Reports"] },
  { match: (p) => p.startsWith("/reports/"), trail: ["HSE", "Reports", "Report Detail"] },
  { match: (p) => p.startsWith("/reviews"), trail: ["HSE", "Reviews", "Action Center"] },
  { match: (p) => p.startsWith("/patterns"), trail: ["HSE", "Safety Patterns"] },
  { match: (p) => p.startsWith("/sites"), trail: ["HSE", "Master Data", "Sites"] },
  { match: (p) => p.startsWith("/activities"), trail: ["HSE", "Master Data", "Activities"] },
  { match: (p) => p.startsWith("/rules"), trail: ["HSE", "Master Data", "Life-Saving Rules"] },
  { match: (p) => p.startsWith("/imports") || p.startsWith("/analyze"), trail: ["HSE", "Imports"] },
  { match: (p) => p.startsWith("/notifications"), trail: ["HSE", "Notifications"] },
  { match: (p) => p.startsWith("/profile"), trail: ["HSE", "Settings", "Profile"] },
];

function cn(...c: (string | boolean | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

function formatRole(role: string) {
  return role.replace(/_/g, " ");
}

function formatDMY(iso: string) {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function todayDMY() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function shiftDMY(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Header date pill: reflects the page's real filter state from the URL
 *  (dashboard preset/custom range, reviews custom range). */
function HeaderDatePill() {
  const sp = useSearchParams();
  const dateFrom = sp.get("dateFrom");
  const dateTo = sp.get("dateTo");
  const preset = sp.get("preset");
  let text = todayDMY();
  if (dateFrom || dateTo) {
    text = `${dateFrom ? formatDMY(dateFrom) : "…"} — ${dateTo ? formatDMY(dateTo) : "…"}`;
  } else if (preset === "all") {
    text = "All time";
  } else if (preset === "7d" || preset === "30d" || preset === "90d" || preset === "1y") {
    const days = preset === "7d" ? 7 : preset === "30d" ? 30 : preset === "90d" ? 90 : 365;
    text = `${shiftDMY(days)} — ${todayDMY()}`;
  }
  return (
    <Link
      href="/dashboard"
      title="Open dashboard date range"
      className="hidden items-center gap-2 rounded-lg border border-[#E7E1D4] bg-white px-3 py-2 text-[12.5px] font-medium tabular-nums text-[#4C5566] hover:bg-[#FAF8F4] md:inline-flex"
    >
      <CalendarIcon className="h-4 w-4 text-[#9BA3AF]" />
      {text}
    </Link>
  );
}

function HeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/reports?search=${encodeURIComponent(query)}` : "/reports");
    if (pathname !== "/reports") setQ("");
  }
  return (
    <form onSubmit={onSubmit} role="search" aria-label="Global search" className="hidden min-w-0 flex-1 max-w-[420px] sm:block">
      <span className="relative block">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9BA3AF]" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search reports, sites, activities..."
          aria-label="Search reports, sites, activities"
          className="field h-10 w-full border-[#E7E1D4] bg-[#FAF8F4] pl-9 text-[13px]"
        />
      </span>
    </form>
  );
}

export function AppShell({ title, children }: { title?: string; children: React.ReactNode }) {
  void title;
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setUser(getStoredUser());
    fetchCurrentUser().then(setUser).catch(() => {});
  }, []);

  function onLogout() {
    logout();
    router.push("/login");
  }

  const refreshUnread = async () => {
    try {
      const r = await fetchUnreadCount();
      setUnreadCount(r.count);
    } catch {}
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
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setBellOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [bellOpen]);
  useEffect(() => {
    if (!userOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setUserOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [userOpen]);

  async function handleNotificationClick(n: Notification) {
    try {
      if (!n.isRead) {
        await markNotificationRead(n.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      }
    } catch {}
    setBellOpen(false);
    if (n.reportId) router.push(`/reports/${n.reportId}`);
    else router.push("/notifications");
  }
  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((x) => ({ ...x, isRead: true })));
    } catch {}
  }

  const crumbs = (CRUMBS.find((c) => c.match(pathname))?.trail ?? ["HSE"]).filter(Boolean);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const initials = user ? user.name.split(" ").map((w) => w.charAt(0)).join("").slice(0, 2).toUpperCase() : "–";

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-[#14283F] bg-[#14283F] px-5 pb-5 pt-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[#C8791A] text-white">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2C12 2 5.5 10.2 5.5 15a6.5 6.5 0 0013 0C18.5 10.2 12 2 12 2zm0 17.5a4 4 0 01-4-4c0-.6.13-1.28.38-2.02.32.4.7.76 1.12 1.06V15a2.5 2.5 0 005 0v-.46c.42-.3.8-.66 1.12-1.06.25.74.38 1.42.38 2.02a4 4 0 01-4 4z" />
          </svg>
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block font-heading text-[15px] font-bold tracking-tight text-white">OIL SIF Sentinel</span>
          <span className="block text-[11px] font-medium text-[#9BA3AF]">Safety Intelligence Platform</span>
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
        {NAV_GROUPS.map((g) => (
          <div key={g.label ?? "top"} className="mb-5 last:mb-0">
            {g.label ? <p className="px-3 pb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#9BA3AF]">{g.label}</p> : null}
            <ul className="space-y-0.5">
              {g.items.map((n) => {
                const active = isActive(n.href);
                const Icon = n.icon;
                return (
                  <li key={n.href} className="relative">
                    {active ? <span className="absolute bottom-1.5 left-0 top-1.5 w-1 rounded-full bg-[#C8791A]" aria-hidden="true" /> : null}
                    <Link
                      href={n.href}
                      onClick={() => setMobileOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-[42px] items-center gap-3 rounded-lg px-3 pl-4 text-[14px] transition-colors",
                        active ? "bg-[#FCF0DE] font-semibold text-[#C8791A]" : "font-medium text-[#4C5566] hover:bg-[#FCF0DE] hover:text-[#14283F]"
                      )}
                    >
                      <Icon className={cn("h-5 w-5 shrink-0", active ? "text-[#C8791A]" : "text-[#9BA3AF]")} />
                      {n.label}
                      {n.href === "/notifications" && unreadCount > 0 ? (
                        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C8791A] px-1.5 text-[10px] font-bold tabular-nums text-white">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-[#EFEADF] p-4">
        {user ? (
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FCF0DE] text-[12px] font-bold text-[#C8791A]">{initials}</span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-semibold text-[#14283F]">{user.name}</span>
              <span className="block truncate text-[11.5px] text-[#6B7385]">{user.email}</span>
            </span>
          </div>
        ) : null}
        <button onClick={onLogout} className="mt-3 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] font-medium text-[#4C5566] hover:bg-[#FAF8F4] hover:text-[#14283F]">
          <LogoutIcon className="h-[18px] w-[18px] text-[#9BA3AF]" /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#E7E1D4] bg-white">
        <div className="mx-auto flex h-[62px] w-full max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-[#4C5566] hover:bg-[#F2EEE5] lg:hidden" aria-label="Open navigation">
            <MenuIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <HeaderSearch />
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Suspense>
              <HeaderDatePill />
            </Suspense>
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => {
                  setBellOpen((v) => !v);
                  setUserOpen(false);
                }}
                aria-label="Notifications"
                aria-haspopup="menu"
                aria-expanded={bellOpen}
                className="relative flex h-10 w-10 items-center justify-center rounded-lg text-[#4C5566] hover:bg-[#F2EEE5] hover:text-[#14283F]"
              >
                <BellIcon className="h-5 w-5" />
                {unreadCount > 0 ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#C8791A] px-1 text-[9px] font-bold leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </button>
              {bellOpen ? (
                <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[380px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[14px] border border-[#E7E1D4] bg-white shadow-[0_12px_32px_rgba(20,40,63,0.14)]" role="menu" aria-label="Notifications">
                  <div className="flex items-center justify-between border-b border-[#EFEADF] bg-[#FAF8F4] px-4 py-3">
                    <span className="text-[13.5px] font-bold text-[#14283F]">Notifications</span>
                    <button onClick={handleMarkAllRead} className="text-[12px] font-semibold text-[#C8791A] hover:underline">
                      Mark all as read
                    </button>
                  </div>
                  <div className="max-h-[340px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-[13px] text-[#9BA3AF]">No notifications yet.</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          role="menuitem"
                          onClick={() => handleNotificationClick(n)}
                          className={cn("flex w-full gap-3 border-b border-[#F2EEE5] px-4 py-3 text-left transition-colors last:border-0 hover:bg-[#FAF8F4]", !n.isRead ? "bg-[#FCF0DE]" : "")}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FCF0DE] text-[#C8791A]" aria-hidden="true">
                            <BellIcon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn("block truncate text-[13.5px]", !n.isRead ? "font-semibold text-[#14283F]" : "font-medium text-[#3B4A61]")}>{n.title}</span>
                            <span className="block truncate text-[12px] text-[#6B7385]">{n.message}</span>
                            <span className="block text-[11px] text-[#9BA3AF]">
                              {new Date(n.createdAt).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="border-t border-[#EFEADF] bg-[#FAF8F4] text-center">
                    <Link href="/notifications" onClick={() => setBellOpen(false)} className="block px-4 py-2.5 text-[12.5px] font-semibold text-[#C8791A] hover:underline">
                      View all notifications
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="relative" ref={userRef}>
              <button
                onClick={() => {
                  setUserOpen((v) => !v);
                  setBellOpen(false);
                }}
                aria-label="User menu"
                aria-haspopup="menu"
                aria-expanded={userOpen}
                className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-1 hover:bg-[#FAF8F4]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FCF0DE] text-[12px] font-bold text-[#C8791A]">{initials}</span>
                <span className="hidden text-left leading-tight xl:block">
                  <span className="block max-w-[150px] truncate text-[13px] font-semibold text-[#14283F]">{user?.name ?? "…"}</span>
                  <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-[#6B7385]">{user ? formatRole(user.role) : ""}</span>
                </span>
                <svg className="hidden h-4 w-4 text-[#9BA3AF] xl:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {userOpen ? (
                <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[240px] overflow-hidden rounded-[14px] border border-[#E7E1D4] bg-white py-1.5 shadow-[0_12px_32px_rgba(20,40,63,0.14)]" role="menu" aria-label="User menu">
                  <div className="border-b border-[#EFEADF] px-4 py-3">
                    <p className="truncate text-[13.5px] font-semibold text-[#14283F]">{user?.name}</p>
                    <p className="truncate text-[12px] text-[#6B7385]">{user?.email}</p>
                  </div>
                  <Link href="/profile" onClick={() => setUserOpen(false)} role="menuitem" className="flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] font-medium text-[#3B4A61] hover:bg-[#FAF8F4]">
                    <UserIcon className="h-4 w-4 text-[#9BA3AF]" /> Profile
                  </Link>
                  <button onClick={onLogout} role="menuitem" className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13.5px] font-medium text-[#B91C1C] hover:bg-[#FEF2F2]">
                    <LogoutIcon className="h-4 w-4" /> Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] items-start">
        {/* Desktop sidebar */}
        <aside className="sticky top-[62px] hidden h-[calc(100vh-62px)] w-[232px] shrink-0 border-r border-[#E7E1D4] bg-white lg:block">{sidebar}</aside>
        {/* Mobile drawer */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="absolute inset-0 bg-[#14283F]/40" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white shadow-2xl">
              <button onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="absolute right-3 top-5 rounded-lg p-1.5 text-[#6B7385] hover:bg-[#F2EEE5]">
                <XIcon className="h-5 w-5" />
              </button>
              {sidebar}
            </aside>
          </div>
        ) : null}
        <main className="min-w-0 flex-1">
          {/* Breadcrumb */}
          <div className="border-b border-[#E7E1D4] bg-white">
            <nav aria-label="Breadcrumb" className="mx-auto w-full max-w-[1400px] px-4 py-2.5 sm:px-6 lg:px-8">
              <ol className="flex min-w-0 items-center gap-1.5 text-[12.5px]">
                {crumbs.map((c, i) => (
                  <li key={i} className="flex min-w-0 items-center gap-1.5">
                    {i > 0 ? (
                      <span className="text-[#D9D0BE]" aria-hidden="true">
                        ›
                      </span>
                    ) : null}
                    <span className={i === crumbs.length - 1 ? "truncate font-semibold text-[#14283F]" : "shrink-0 font-medium text-[#9BA3AF]"}>{c}</span>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
          <div className="app-content">{children}</div>
        </main>
      </div>
    </div>
  );
}

// Keep AppHeader as lightweight alias for backward-compat pages not yet migrated
export function AppHeader({ title }: { title: string }) {
  return (
    <div className="mb-5 flex h-[56px] items-center rounded-[14px] border border-[#E7E1D4] bg-[#14283F] px-5">
      <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-white">{title}</span>
      <span className="ml-2 hidden text-[11px] text-slate-400 sm:inline">— OIL SIF Sentinel</span>
    </div>
  );
}
