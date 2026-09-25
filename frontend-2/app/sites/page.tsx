"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createSite, fetchSites, isUnauthorized, updateSite } from "@/lib/api";
import { apiErrorMessage, logout } from "@/lib/auth";
import type { Site } from "@/types/master";
import { AppShell } from "@/components/common/AppShell";
import { Card, EmptyState, ErrorState } from "@/components/common/States";
import { StatusBadge } from "@/components/common/Badges";
import { PageHeader } from "@/components/ui/primitives";
import { SearchIcon, SitesIcon } from "@/components/ui/Icons";
import { isAdmin, useCurrentUser } from "@/hooks/useCurrentUser";

export default function SitesPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const admin = isAdmin(user);
  const [items, setItems] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [formMsg, setFormMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (q?: string) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetchSites(q ? { search: q } : {});
        setItems(res.items);
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
    load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg(null);
    setBusy(true);
    try {
      await createSite({ name: name.trim(), code: code.trim(), ...(location.trim() ? { location: location.trim() } : {}), ...(description.trim() ? { description: description.trim() } : {}) });
      setFormMsg({ kind: "ok", text: "Site created." });
      setName("");
      setCode("");
      setLocation("");
      setDescription("");
      await load(search.trim() || undefined);
    } catch (err: unknown) {
      setFormMsg({ kind: "err", text: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(s: Site) {
    setFormMsg(null);
    try {
      await updateSite(s.id, { status: s.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      await load(search.trim() || undefined);
    } catch (err: unknown) {
      setFormMsg({ kind: "err", text: apiErrorMessage(err) });
    }
  }

  return (
    <AppShell title="Sites">
      <div className="space-y-5">
        <PageHeader eyebrow="HSE · Master Data" title="Sites" description="Manage operational locations used in safety reporting." />

        <form onSubmit={(e) => { e.preventDefault(); load(search.trim() || undefined); }} className="filter-bar" role="search">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">Search</span>
            <span className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9BA3AF]" />
              <input type="search" placeholder="Search name or code…" aria-label="Search sites" value={search} onChange={(e) => setSearch(e.target.value)} className="field w-full pl-9" />
            </span>
          </label>
          <div className="flex items-end">
            <button type="submit" className="button-primary">Search</button>
          </div>
        </form>

        {admin ? (
          <Card title="Create Site" subtitle="Add a new operational location (HSE Admin)">
            <form onSubmit={onCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#14283F]">Name *</span>
                <input required value={name} onChange={(e) => setName(e.target.value)} className="field w-full" aria-label="Site name" placeholder="e.g. Refinery Unit 3" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#14283F]">Code *</span>
                <input required value={code} onChange={(e) => setCode(e.target.value)} className="field w-full" aria-label="Site code" placeholder="e.g. RU-03" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#14283F]">Location</span>
                <input value={location} onChange={(e) => setLocation(e.target.value)} className="field w-full" aria-label="Site location" placeholder="Optional" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-[#14283F]">Description</span>
                <input value={description} onChange={(e) => setDescription(e.target.value)} className="field w-full" aria-label="Site description" placeholder="Optional" />
              </label>
              <div className="sm:col-span-2">
                <button type="submit" disabled={busy} className="button-primary disabled:opacity-50">{busy ? "Creating…" : "Create site"}</button>
                {formMsg ? (
                  <p className={`mt-2.5 rounded-xl border px-3 py-2 text-[13px] font-medium ${formMsg.kind === "ok" ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]" : "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"}`}>{formMsg.text}</p>
                ) : null}
              </div>
            </form>
          </Card>
        ) : null}

        {error ? (
          <ErrorState message={error} onRetry={() => load()} />
        ) : loading ? (
          <div className="panel overflow-hidden" aria-live="polite" aria-busy="true">
            <div className="space-y-2 p-5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-12" />
              ))}
            </div>
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<SitesIcon className="h-5 w-5" />} message="No sites found. Refine your search or ask an HSE admin to add a location." />
        ) : (
          <section className="panel overflow-hidden">
            <div className="panel-header">
              <h2 className="section-title">{items.length} Site{items.length === 1 ? "" : "s"}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Location</th>
                    <th>Status</th>
                    {admin ? <th>Action</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id}>
                      <td className="text-[13.5px] font-semibold text-[#14283F]">{s.name}</td>
                      <td className="font-mono text-[12px] text-[#4C5566]">{s.code}</td>
                      <td className="max-w-[220px] truncate text-[13px] text-[#4C5566]">{s.location ?? "—"}</td>
                      <td>
                        <StatusBadge value={s.status} />
                      </td>
                      {admin ? (
                        <td>
                          <button onClick={() => toggleStatus(s)} className="button-secondary h-8 px-3 text-[12px]">
                            {s.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
