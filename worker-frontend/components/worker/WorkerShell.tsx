"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { fetchCurrentUser, getStoredUser, logout } from "@/lib/auth";
import { fetchUnreadCount, fetchNotifications, markNotificationRead, markAllNotificationsRead, type Notification } from "@/lib/api";
import type { User } from "@/types/user";
import { AmbientDots } from "@/components/ui/AmbientDots";
import {
  BellIcon,
  DocIcon,
  EditIcon,
  HomeIcon,
  LogoutIcon,
  MenuIcon,
  PlusIcon,
  ReportsIcon,
  SearchIcon,
  UserIcon,
  XIcon,
} from "@/components/ui/Icons";

const WORKER_NAV = [
  { href: "/", label: "Dashboard", icon: HomeIcon },
  { href: "/reports", label: "My Reports", icon: ReportsIcon },
  { href: "/reports/new", label: "New Report", icon: EditIcon },
  { href: "/notifications", label: "Notifications", icon: BellIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/reports") return pathname === "/reports" || (pathname.startsWith("/reports/") && !pathname.startsWith("/reports/new"));
  return pathname === href || pathname.startsWith(href + "/");
}

function cn(...c: (string | boolean | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

function OilDrop({ className }: { className?: string }) {
  return (
    <svg className={className ?? "h-5 w-5"} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2C12 2 5.5 10.2 5.5 15a6.5 6.5 0 0013 0C18.5 10.2 12 2 12 2zm0 17.5a4 4 0 01-4-4c0-.6.13-1.28.38-2.02.32.4.7.76 1.12 1.06V15a2.5 2.5 0 005 0v-.46c.42-.3.8-.66 1.12-1.06.25.74.38 1.42.38 2.02a4 4 0 01-4 4z" />
    </svg>
  );
}

export function WorkerShell({ title, children }: { title: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) setNavOpen(true);
  }, []);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    router.push(q ? `/reports?search=${encodeURIComponent(q)}` : "/reports");
  }

  useEffect(() => {
    setUser(getStoredUser());
    fetchCurrentUser().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
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

  function onLogout() {
    logout();
    router.push("/login");
  }

  const initials = user ? user.name.charAt(0).toUpperCase() : "W";

  const bellButton = (
    <div className="relative" ref={bellRef}>
      <button
        onClick={() => {
          setBellOpen((v) => !v);
          setProfileOpen(false);
        }}
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={bellOpen}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-white/60 hover:bg-white/[0.06] hover:text-white hover:border-white/10"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#00E5FF] px-1 text-[9px] font-bold leading-none text-[#0A0D12]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
      {bellOpen ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[360px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[14px] border border-white/10 bg-[#151C26] shadow-[0_16px_40px_rgba(0,0,0,0.45)]" role="menu" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-3">
            <span className="text-[13.5px] font-bold text-white">Notifications</span>
            <button onClick={handleMarkAllRead} className="text-[12px] font-semibold text-[#00E5FF] hover:underline">
              Mark all as read
            </button>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[13.5px] font-semibold text-white">You&apos;re all caught up</p>
                <p className="mt-1 text-[12.5px] text-white/50">No new notifications.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  role="menuitem"
                  onClick={() => handleNotificationClick(n)}
                  className={cn("flex w-full gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors last:border-0 hover:bg-white/[0.03]", !n.isRead ? "bg-[rgba(0,229,255,0.06)]" : "")}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(0,229,255,0.12)] text-[#00E5FF]" aria-hidden="true">
                    <BellIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[13.5px]", !n.isRead ? "font-semibold text-white" : "font-medium text-white/70")}>{n.title}</span>
                    <span className="block truncate text-[12px] text-white/45">{n.message}</span>
                    <span className="block font-mono text-[11px] text-white/30">
                      {new Date(n.createdAt).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-white/5 bg-white/[0.02] text-center">
            <Link href="/notifications" onClick={() => setBellOpen(false)} className="block px-4 py-2.5 text-[12.5px] font-semibold text-[#00E5FF] hover:underline">
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );

  const avatarButton = (
    <div className="relative" ref={profileRef}>
      <button
        onClick={() => {
          setProfileOpen((v) => !v);
          setBellOpen(false);
        }}
        aria-label="Open profile menu"
        aria-haspopup="menu"
        aria-expanded={profileOpen}
        className="flex items-center gap-2.5 rounded-[10px] border border-transparent py-1.5 pl-1.5 pr-2 hover:bg-white/[0.06] hover:border-white/10"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(0,229,255,0.12)] text-[13px] font-bold text-[#00E5FF] ring-1 ring-[#00E5FF]/20">{initials}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[140px] truncate text-[13px] font-semibold text-white">{user?.name ?? "…"}</span>
          <span className="block font-mono text-[11px] font-medium uppercase tracking-widest text-white/40">Worker</span>
        </span>
        <svg className="hidden h-4 w-4 text-white/30 sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {profileOpen ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[240px] overflow-hidden rounded-[14px] border border-white/10 bg-[#151C26] py-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)]" role="menu" aria-label="Profile menu">
          <div className="border-b border-white/5 bg-white/[0.02] px-4 py-3">
            <p className="truncate text-[13.5px] font-semibold text-white">{user ? user.name : "Worker"}</p>
            <p className="truncate font-mono text-[12px] text-white/40">{user?.email ?? ""}</p>
          </div>
          <Link href="/profile" role="menuitem" onClick={() => setProfileOpen(false)} className="block px-4 py-2.5 text-[13.5px] font-medium text-white/70 hover:bg-white/[0.04] hover:text-white">
            Profile
          </Link>
          <Link href="/reports" role="menuitem" onClick={() => setProfileOpen(false)} className="block px-4 py-2.5 text-[13.5px] font-medium text-white/70 hover:bg-white/[0.04] hover:text-white">
            My Reports
          </Link>
          <div className="border-t border-white/5 py-1.5">
            <button role="menuitem" onClick={onLogout} className="block w-full px-4 py-2.5 text-left text-[13.5px] font-medium text-[#EF4444] hover:bg-[rgba(239,68,68,0.08)]">
              Logout
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="relative min-h-screen bg-[#0A0D12]">
      <AmbientDots />
      <div className="relative z-[1] mx-auto flex w-full max-w-[1400px] items-start">
        {/* Desktop sidebar — elevated slate */}
        <aside className={cn("sticky top-0 hidden h-screen w-[260px] shrink-0 border-r border-white/5 bg-[#151C26]", navOpen ? "lg:block" : "lg:hidden")} aria-label="Worker navigation">
          <div className="flex h-full flex-col">
            <Link href="/" className="flex items-center gap-2.5 border-b border-white/5 px-5 pb-5 pt-6" aria-label="OIL SIF Sentinel Worker home">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[rgba(0,229,255,0.10)] text-[#00E5FF] ring-1 ring-[#00E5FF]/20">
                <OilDrop className="h-5 w-5" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block font-display text-[14px] font-bold tracking-tight text-white">OIL SIF Sentinel</span>
                <span className="block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">Worker Safety Portal</span>
              </span>
            </Link>
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <ul className="space-y-1">
                {WORKER_NAV.map((n) => {
                  const active = isActive(pathname, n.href);
                  const Icon = n.icon;
                  return (
                    <li key={n.href} className="relative">
                      {active ? <span className="absolute bottom-1.5 left-0 top-1.5 w-[2px] rounded-full bg-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.5)]" aria-hidden="true" /> : null}
                      <Link
                        href={n.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-[44px] items-center gap-3 rounded-[10px] px-3 pl-4 text-[13.5px] transition-colors",
                          active ? "bg-[rgba(0,229,255,0.10)] font-semibold text-[#00E5FF]" : "font-medium text-white/55 hover:bg-white/[0.04] hover:text-white"
                        )}
                      >
                        <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-[#00E5FF]" : "text-white/25")} />
                        {n.label}
                        {n.href === "/notifications" && unreadCount > 0 ? (
                          <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#00E5FF] px-1.5 font-mono text-[10px] font-bold tabular-nums text-[#0A0D12]">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="border-t border-white/5 p-3">
              <Link
                href="/profile"
                aria-current={isActive(pathname, "/profile") ? "page" : undefined}
                className={cn(
                  "flex h-[42px] items-center gap-3 rounded-[10px] px-3 text-[13.5px] transition-colors",
                  isActive(pathname, "/profile") ? "bg-[rgba(0,229,255,0.10)] font-semibold text-[#00E5FF]" : "font-medium text-white/55 hover:bg-white/[0.04] hover:text-white"
                )}
              >
                <UserIcon className={cn("h-[18px] w-[18px] shrink-0", isActive(pathname, "/profile") ? "text-[#00E5FF]" : "text-white/25")} />
                Profile
              </Link>
              <button onClick={onLogout} className="mt-1 flex h-[42px] w-full items-center gap-3 rounded-[10px] px-3 text-[13.5px] font-medium text-white/55 hover:bg-white/[0.04] hover:text-white">
                <LogoutIcon className="h-[18px] w-[18px] shrink-0 text-white/25" /> Logout
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Top header — dark charcoal, blurred */}
          <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0D1117]/80 backdrop-blur-xl">
            <div className="flex h-[64px] items-center gap-3 px-4 sm:px-6">
              <button onClick={() => setNavOpen((v) => !v)} className="rounded-[10px] p-2 text-white/50 hover:bg-white/[0.06] hover:text-white" aria-label="Toggle navigation">
                <MenuIcon className="h-5 w-5" />
              </button>
              <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="OIL SIF Sentinel Worker home">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[rgba(0,229,255,0.10)] text-[#00E5FF] ring-1 ring-white/10">
                  <OilDrop className="h-5 w-5" />
                </span>
                <span className="hidden min-w-0 leading-tight min-[420px]:block">
                  <span className="block font-display text-[14px] font-bold tracking-tight text-white">OIL SIF Sentinel</span>
                  <span className="block font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">Worker Safety Portal</span>
                </span>
              </Link>
              <form onSubmit={onSearchSubmit} role="search" aria-label="Search your reports" className="mx-auto hidden w-full max-w-[520px] flex-1 md:block">
                <span className="relative block">
                  <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/25" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search your reports..."
                    aria-label="Search your reports"
                    className="field h-10 w-full border-white/10 bg-[#10151E] pl-10 text-[13.5px] placeholder:text-white/30"
                  />
                </span>
              </form>
              <div className="ml-auto flex shrink-0 items-center gap-1.5 md:ml-0">
                {bellButton}
                {avatarButton}
              </div>
            </div>
            <form onSubmit={onSearchSubmit} role="search" aria-label="Search your reports" className="px-4 pb-3 md:hidden">
              <span className="relative block">
                <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/25" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your reports..."
                  aria-label="Search your reports"
                  className="field h-10 w-full border-white/10 bg-[#10151E] pl-10 text-[13.5px] placeholder:text-white/30"
                />
              </span>
            </form>
          </header>

          {/* Page content — ensure sharp, distraction-free above dots */}
          <main className="relative mx-auto w-full max-w-[1100px] px-4 pb-28 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10">{children}</main>
        </div>
      </div>

      {/* Mobile drawer */}
      {navOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-[#0A0D12]/70 backdrop-blur-sm" onClick={() => setNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] border-r border-white/10 bg-[#151C26] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <span className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[rgba(0,229,255,0.10)] text-[#00E5FF]">
                  <OilDrop className="h-[18px] w-[18px]" />
                </span>
                <span className="font-display text-[14px] font-bold text-white">OIL SIF Sentinel</span>
              </span>
              <button onClick={() => setNavOpen(false)} aria-label="Close navigation" className="rounded-lg p-1.5 text-white/50 hover:bg-white/5">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <nav className="px-3 py-4" aria-label="Mobile worker navigation">
              <ul className="space-y-1">
                {[...WORKER_NAV, { href: "/profile", label: "Profile", icon: UserIcon }].map((n) => {
                  const active = isActive(pathname, n.href);
                  const Icon = n.icon;
                  return (
                    <li key={n.href}>
                      <Link
                        href={n.href}
                        onClick={() => setNavOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-[46px] items-center gap-3 rounded-[10px] px-3 text-[14px] transition-colors",
                          active ? "bg-[rgba(0,229,255,0.10)] font-semibold text-[#00E5FF]" : "font-medium text-white/55 hover:bg-white/[0.04]"
                        )}
                      >
                        <Icon className={cn("h-5 w-5 shrink-0", active ? "text-[#00E5FF]" : "text-white/25")} />
                        {n.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <button onClick={() => { setNavOpen(false); onLogout(); }} className="mt-2 flex h-[46px] w-full items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium text-white/55 hover:bg-white/[0.04]">
                <LogoutIcon className="h-5 w-5 shrink-0 text-white/25" /> Logout
              </button>
            </nav>
          </aside>
        </div>
      ) : null}

      {/* Mobile bottom navigation — dark */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-[#0D1117]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Worker navigation">
        <ul className="mx-auto grid w-full max-w-[560px] grid-cols-5 items-stretch px-2">
          <BottomItem href="/" label="Home" icon={<HomeIcon className="h-[22px] w-[22px]" />} active={isActive(pathname, "/")} />
          <BottomItem href="/reports" label="Reports" icon={<ReportsIcon className="h-[22px] w-[22px]" />} active={pathname === "/reports" || (pathname.startsWith("/reports/") && !pathname.startsWith("/reports/new"))} />
          <li className="flex items-stretch justify-center py-1.5">
            <Link
              href="/reports/new"
              aria-label="New report"
              aria-current={isActive(pathname, "/reports/new") ? "page" : undefined}
              className="flex w-full flex-col items-center justify-center gap-0.5 rounded-2xl bg-[#00E5FF] px-1 py-1.5 text-[#0A0D12] shadow-[0_4px_16px_rgba(0,229,255,0.35)] transition-colors hover:bg-[#00C8E0]"
            >
              <PlusIcon className="h-6 w-6" />
              <span className="text-[10px] font-bold leading-tight">New</span>
            </Link>
          </li>
          <BottomItem
            href="/notifications"
            label="Alerts"
            icon={<BellIcon className="h-[22px] w-[22px]" />}
            active={isActive(pathname, "/notifications")}
            badge={unreadCount}
          />
          <BottomItem href="/profile" label="Profile" icon={<UserIcon className="h-[22px] w-[22px]" />} active={isActive(pathname, "/profile")} />
        </ul>
      </nav>
    </div>
  );
}

function BottomItem({ href, label, icon, active, badge }: { href: string; label: string; icon: React.ReactNode; active: boolean; badge?: number }) {
  return (
    <li className="flex items-stretch">
      <Link
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex w-full flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-2 transition-colors",
          active ? "text-[#00E5FF]" : "text-white/35 hover:text-white/60"
        )}
      >
        {badge != null && badge > 0 ? (
          <span className="absolute right-1/2 top-1 flex h-4 min-w-[16px] translate-x-4 items-center justify-center rounded-full bg-[#00E5FF] px-1 font-mono text-[9px] font-bold leading-none text-[#0A0D12]">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
        {icon}
        <span className={cn("text-[10px] font-semibold leading-tight", active ? "font-bold" : "")}>{label}</span>
      </Link>
    </li>
  );
}

// Re-exported so existing pages keep working if they import header icons indirectly.
export { DocIcon, MenuIcon, XIcon };
