"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createRule, fetchRules, isUnauthorized, updateRule } from "@/lib/api";
import { apiErrorMessage, logout } from "@/lib/auth";
import type { LifeSavingRule } from "@/types/master";
import { AppShell } from "@/components/common/AppShell";
import { Card, EmptyState, ErrorState } from "@/components/common/States";
import { OfficialBadge, PrototypeBadge, StatusBadge } from "@/components/common/Badges";
import { PageHeader } from "@/components/ui/primitives";
import { AlertIcon, RulesIcon, SearchIcon } from "@/components/ui/Icons";
import { isAdmin, useCurrentUser } from "@/hooks/useCurrentUser";

export default function RulesPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const admin = isAdmin(user);
  const [items, setItems] = useState<LifeSavingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [formMsg, setFormMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (q?: string) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetchRules(q ? { search: q } : {});
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
      await createRule({ name: name.trim(), code: code.trim(), ...(description.trim() ? { description: description.trim() } : {}), isPrototype: true });
      setFormMsg({ kind: "ok", text: "Prototype rule created." });
      setName("");
      setCode("");
      setDescription("");
      await load(search.trim() || undefined);
    } catch (err: unknown) {
      setFormMsg({ kind: "err", text: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(r: LifeSavingRule) {
    setFormMsg(null);
    try {
      await updateRule(r.id, { status: r.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      await load(search.trim() || undefined);
    } catch (err: unknown) {
      setFormMsg({ kind: "err", text: apiErrorMessage(err) });
    }
  }

  const official = items.filter((r) => !r.isPrototype);
  const prototype = items.filter((r) => r.isPrototype);

  return (
    <AppShell title="Life-Saving Rules">
      <div className="space-y-5">
        <PageHeader eyebrow="HSE · Master Data" title="Life-Saving Rules" description="Safety reference library — official rules and AI prototype taxonomy." />

        <div className="flex gap-3 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4" role="note">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#B45309]" />
          <div>
            <p className="text-[13.5px] font-semibold text-[#92400E]">Prototype content — not official OIL methodology</p>
            <p className="mt-0.5 text-[13px] text-[#B45309]">Rules marked “Prototype” are integration scaffolding for the AI engine. Human HSE review remains the final decision.</p>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); load(search.trim() || undefined); }} className="filter-bar" role="search">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Search</span>
            <span className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input type="search" placeholder="Search name or code…" aria-label="Search rules" value={search} onChange={(e) => setSearch(e.target.value)} className="field w-full pl-9" />
            </span>
          </label>
          <div className="flex items-end">
            <button type="submit" className="button-primary">Search</button>
          </div>
        </form>

        {admin ? (
          <Card title="Create Prototype Rule" subtitle="Add a new rule to the prototype catalogue (HSE Admin)">
            <form onSubmit={onCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-white">Name *</span>
                <input required value={name} onChange={(e) => setName(e.target.value)} className="field w-full" aria-label="Rule name" placeholder="e.g. Isolate energy sources" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-white">Code *</span>
                <input required value={code} onChange={(e) => setCode(e.target.value)} className="field w-full" aria-label="Rule code" placeholder="e.g. SIF-PROTOTYPE-ENERGY" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[13px] font-semibold text-white">Description</span>
                <input value={description} onChange={(e) => setDescription(e.target.value)} className="field w-full" aria-label="Rule description" placeholder="Optional" />
              </label>
              <div className="sm:col-span-2">
                <button type="submit" disabled={busy} className="button-primary disabled:opacity-50">{busy ? "Creating…" : "Create prototype rule"}</button>
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-live="polite" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="panel space-y-2 p-5">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<RulesIcon className="h-5 w-5" />} message="No life-saving rules found. Refine your search." />
        ) : (
          <>
            {official.length > 0 ? (
              <section aria-label="Official rules">
                <h2 className="mb-3 text-[15px] font-bold tracking-tight text-white">
                  Official Rules <span className="ml-1 rounded-full bg-[#F0FDF4] px-2 py-0.5 text-[11px] font-bold text-[#15803D]">{official.length}</span>
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {official.map((r) => (
                    <RuleCard key={r.id} rule={r} admin={admin} onToggle={() => toggleStatus(r)} />
                  ))}
                </div>
              </section>
            ) : null}
            {prototype.length > 0 ? (
              <section aria-label="Prototype rules">
                <h2 className="mb-3 text-[15px] font-bold tracking-tight text-white">
                  Prototype Taxonomy <span className="ml-1 rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-bold text-[#B45309]">{prototype.length}</span>
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {prototype.map((r) => (
                    <RuleCard key={r.id} rule={r} admin={admin} onToggle={() => toggleStatus(r)} />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}

function RuleCard({ rule, admin, onToggle }: { rule: LifeSavingRule; admin: boolean; onToggle: () => void }) {
  return (
    <article className="panel flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14.5px] font-bold tracking-tight text-white">{rule.name}</h3>
          <p className="mt-1 font-mono text-[12px] text-[#64748B]">{rule.code}</p>
        </div>
        {rule.isPrototype ? <PrototypeBadge /> : <OfficialBadge />}
      </div>
      {rule.description ? <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-[#94A3B8]">{rule.description}</p> : null}
      <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3.5">
        <StatusBadge value={rule.status} />
        {admin ? (
          <button onClick={onToggle} className="button-secondary h-8 px-3 text-[12px]">
            {rule.status === "ACTIVE" ? "Deactivate" : "Activate"}
          </button>
        ) : null}
      </div>
    </article>
  );
}
