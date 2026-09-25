"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { fetchCurrentUser, getStoredUser, logout } from "@/lib/auth";
import type { User } from "@/types/user";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reports", label: "Reports" },
  { href: "/analyze", label: "Analyze" },
  { href: "/reviews", label: "Reviews" },
  { href: "/sites", label: "Sites" },
  { href: "/activities", label: "Activities" },
  { href: "/rules", label: "Rules" },
];

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function AppHeader({ title }: { title: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    fetchCurrentUser()
      .then(setUser)
      .catch(() => {});
  }, []);

  function onLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 bg-[#14283F] text-slate-200 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_2px_8px_rgba(2,6,23,0.25)]">
      {/* Brand row */}
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 pt-3 sm:px-6">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3" aria-label="OIL SIF Sentinel — Dashboard">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/[0.08] text-sm font-extrabold tracking-tight text-white ring-1 ring-inset ring-white/20">
            OS
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-bold uppercase tracking-[0.18em] text-[#F0D8A8]">
              Oil SIF Sentinel
            </span>
            <span className="block truncate text-[15px] font-semibold leading-tight text-white">
              {title}
              <span className="ml-2 hidden text-xs font-normal text-slate-400 sm:inline">
                Safety Intelligence Platform
              </span>
            </span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-3">
          {user ? (
            <div className="hidden items-center gap-2 md:flex" aria-label="Signed-in user">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white ring-1 ring-inset ring-white/15">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="text-right leading-tight">
                <span className="block max-w-40 truncate text-[13px] font-semibold text-white">{user.name}</span>
                <span className="block text-[11px] font-medium uppercase tracking-wide text-[#F0D8A8]/90">
                  {user.role.replace("_", " ")}
                </span>
              </span>
            </div>
          ) : null}
          <button
            onClick={onLogout}
            className="rounded-md px-3 py-1.5 text-[13px] font-semibold text-slate-300 ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/10 hover:text-white"
          >
            Logout
          </button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Primary navigation */}
      <nav className="mx-auto hidden max-w-[1400px] items-center gap-1 px-4 pb-2.5 pt-2 sm:px-6 lg:flex" aria-label="Primary navigation">
        {NAV.map((n) => {
          const isActive = pathname === n.href || pathname.startsWith(`${n.href}/`);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative rounded-md px-3.5 py-2 text-[13.5px] font-medium transition-colors",
                isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
              )}
            >
              {n.label}
              {isActive ? (
                <span className="absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full bg-[#C8791A]" aria-hidden="true" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {menuOpen && (
        <nav className="border-t border-white/10 px-4 py-2 lg:hidden" aria-label="Mobile navigation">
          {NAV.map((n) => {
            const isActive = pathname === n.href || pathname.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2.5 text-sm font-medium",
                  isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                )}
              >
                {n.label}
              </Link>
            );
          })}
          {user ? (
            <p className="px-3 py-2 text-xs text-slate-400">
              Signed in as <span className="font-semibold text-slate-200">{user.name}</span>
              <span className="mx-1 text-slate-600">·</span>
              <span className="uppercase tracking-wide text-[#F0D8A8]/90">{user.role.replace("_", " ")}</span>
            </p>
          ) : null}
        </nav>
      )}
    </header>
  );
}
