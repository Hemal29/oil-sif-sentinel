"use client";
import { useEffect, useState } from "react";
import { fetchRuleById } from "@/lib/api";
import type { AIAnalysis } from "@/types/report";
import { PriorityBadge, SifBadge } from "@/components/common/Badges";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/5 py-2.5 last:border-0">
      <dt className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/35">{label}</dt>
      <dd className="mt-1 text-[13px] text-white/80">{children}</dd>
    </div>
  );
}

export function AnalysisPanel({ analysis }: { analysis: AIAnalysis | null }) {
  const [ruleLabel, setRuleLabel] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (analysis?.lifeSavingRuleId) {
      fetchRuleById(analysis.lifeSavingRuleId).then((d) => { if (!cancelled) setRuleLabel(`${d.rule.code} — ${d.rule.name}`); }).catch(() => { if (!cancelled) setRuleLabel(null); });
    } else setRuleLabel(null);
    return () => { cancelled = true; };
  }, [analysis?.lifeSavingRuleId]);

  if (!analysis) {
    return <div className="rounded-[12px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center"><p className="text-[13px] font-medium text-white/40">No assessment available for this report. Use Analyze Report to run the precursor screening.</p></div>;
  }
  if (analysis.analysisStatus === "PENDING") {
    return <div className="rounded-[12px] border border-white/10 bg-white/[0.03] px-4 py-5 text-center"><p className="font-display text-[13px] font-semibold text-white">Screening pending</p><p className="mt-1 text-[12px] text-white/40">The precursor screening has not completed for this report.</p></div>;
  }
  if (analysis.analysisStatus === "FAILED") {
    return <div className="rounded-[12px] border border-[rgba(239,68,68,0.20)] bg-[rgba(239,68,68,0.08)] px-4 py-5 text-center"><p className="text-[13px] font-semibold text-[#FCA5A5]">Screening failed</p><p className="mt-1 text-[12px] text-[#FCA5A5]/70">The last screening attempt failed. Retry analysis.</p></div>;
  }

  const layered = analysis.route != null || analysis.riskScore != null;
  const abstained = analysis.route === "ABSTAIN";
  const riskPct = analysis.riskScore != null ? (analysis.riskScore * 100).toFixed(1) : null;
  const evidence = analysis.evidence ?? [];

  return (
    <div>
      {/* Industrial header */}
      <div className="rounded-[12px] border border-white/5 bg-white/[0.02] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-white">Safety Intelligence Assessment</p>
            <p className="mt-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-white/30">Automated Precursor Screening — Decision Support Only</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <SifBadge value={analysis.sifPotential} />
            {analysis.priority ? <PriorityBadge value={analysis.priority} /> : null}
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-white/40">{analysis.analysisStatus}</span>
          </div>
        </div>
        <p className="mt-2 border-t border-white/5 pt-2 text-[12px] leading-relaxed text-white/45">
          {analysis.sifPotential === true ? "Screening flagged as SIF potential." : analysis.sifPotential === false ? "Screening flagged as non-SIF." : "SIF potential could not be determined."}
          {analysis.confidence !== null ? ` · ${(analysis.confidence * 100).toFixed(1)}% confidence` : ""} Requires HSE review.
        </p>
      </div>

      {/* Structured grid */}
      <div className="mt-4 grid grid-cols-1 gap-0 rounded-[12px] border border-white/5 bg-[#151C26] sm:grid-cols-2">
        <div className="border-b border-white/5 px-4 py-3 sm:border-r sm:border-white/5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">Route</p>
          <p className="mt-1 text-[13px] font-semibold text-white">{analysis.route ? analysis.route.replace("_"," ") : "—"}</p>
        </div>
        <div className="border-b border-white/5 px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">Priority</p>
          <p className="mt-1">{analysis.priority ? <PriorityBadge value={analysis.priority} /> : <span className="text-[13px] text-white/25">—</span>}</p>
        </div>
        <div className="border-b border-white/5 px-4 py-3 sm:border-r">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">Risk Score</p>
          <p className="mt-1 font-mono text-[13px] tabular-nums text-white/80">{riskPct !== null ? `${riskPct}%` : "—"} <span className="font-sans text-[11px] text-white/30">heuristic — not calibrated probability</span></p>
        </div>
        <div className="border-b border-white/5 px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">SIF Potential</p>
          <p className="mt-1">{abstained ? <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 font-mono text-[11px] font-bold uppercase text-white/40">Insufficient Information</span> : <SifBadge value={analysis.sifPotential} />}</p>
        </div>
        <div className="border-b border-white/5 px-4 py-3 sm:border-r">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">Primary Precursor</p>
          <p className="mt-1 text-[13px] text-white/80">{analysis.primaryRule ?? "—"}</p>
        </div>
        <div className="border-b border-white/5 px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">Hazard Energy</p>
          <p className="mt-1 text-[13px] text-white/80">{analysis.hazardEnergy ?? "—"}</p>
        </div>
        <div className="border-b border-white/5 px-4 py-3 sm:border-r">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">Barriers Failed</p>
          <p className="mt-1 text-[13px] text-white/80">{analysis.barriersFailed && analysis.barriersFailed.length ? analysis.barriersFailed.join("; ") : "—"}</p>
        </div>
        <div className="border-b border-white/5 px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">Assets</p>
          <p className="mt-1 text-[13px] text-white/80">{analysis.assets && analysis.assets.length ? analysis.assets.join(", ") : "—"}</p>
        </div>
        {layered ? (
          <>
            <div className="border-b border-white/5 px-4 py-3 sm:border-r">
              <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">Matched Rules</p>
              <p className="mt-1 font-mono text-[13px] font-medium text-white/80">{analysis.matchedRules && analysis.matchedRules.length ? analysis.matchedRules.map(r=>r.code).join(", ") : "None"}</p>
            </div>
            <div className="border-b border-white/5 px-4 py-3">
              <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">Secondary Rules</p>
              <p className="mt-1 text-[13px] text-white/80">{analysis.secondaryRules && analysis.secondaryRules.length ? analysis.secondaryRules.join(", ") : "—"}</p>
            </div>
            <div className="px-4 py-3 sm:border-r">
              <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">Life-Saving Rule</p>
              <p className="mt-1 text-[13px] font-medium text-white/80">{ruleLabel ?? analysis.lifeSavingRuleId ?? "—"}</p>
            </div>
            <div className="px-4 py-3">
              <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">Extraction</p>
              <p className="mt-1 font-mono text-[12px] text-white/60">{analysis.extractionStatus ?? "—"}{analysis.repairAttempts ? ` · ${analysis.repairAttempts} repair` : ""}{analysis.failureReason ? ` · ${analysis.failureReason}` : ""}</p>
            </div>
          </>
        ) : null}
      </div>

      {analysis.rationale ? (
        <div className="mt-4 rounded-[12px] border border-white/5 bg-white/[0.02] px-4 py-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">Rationale</p>
          <p className="mt-1 text-[13px] leading-relaxed text-white/70">{analysis.rationale}</p>
        </div>
      ) : null}

      {abstained && analysis.clarificationRequest ? (
        <div className="mt-4 rounded-[12px] border border-[rgba(245,158,11,0.20)] bg-[rgba(245,158,11,0.08)] px-4 py-3">
          <p className="text-[12px] font-bold text-[#FCD34D]">Additional information required</p>
          <p className="mt-1 text-[12px] text-[#FDE68A]/80">{analysis.clarificationRequest.reason}</p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-[13px] text-[#FDE68A]">{analysis.clarificationRequest.suggestedQuestions.map((q,i)=><li key={i}>{q}</li>)}</ul>
        </div>
      ) : null}

      <div className="mt-4">
        <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">Evidence — exact phrases from report</p>
        {evidence.length === 0 ? <p className="mt-2 text-[13px] text-white/25">No evidence phrases returned.</p> : (
          <ul className="mt-2 space-y-2">
            {evidence.map((e,i)=>(
              <li key={i} className="rounded-[8px] border border-white/5 border-l-2 border-l-[#00E5FF] bg-white/[0.02] px-3 py-2 text-[13px] leading-relaxed text-white/70">“{e}”</li>
            ))}
          </ul>
        )}
      </div>

      {analysis.extractedEntities ? (
        <div className="mt-4">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">Extracted Entities</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {( [["Equipment", analysis.extractedEntities.equipment],["Hazards", analysis.extractedEntities.hazards],["Barriers", analysis.extractedEntities.barriers],["Activities", analysis.extractedEntities.activities]] as [string, string[]][]).map(([label, vals])=>(
              <div key={label} className="rounded-[8px] border border-white/5 bg-white/[0.02] px-3 py-2.5"><p className="font-mono text-[11px] font-bold uppercase tracking-wide text-white/30">{label}</p>{vals.length===0?<p className="mt-1 text-[12px] text-white/25">None</p>:<div className="mt-1.5 flex flex-wrap gap-1.5">{vals.map((v:string,i:number)=><span key={i} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[12px] text-white/70">{v}</span>)}</div>}</div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-4 rounded-[8px] border border-white/5 bg-white/[0.02] px-3 py-2 font-mono text-[11px] leading-relaxed text-white/30">
        Automated assessment is decision support and requires HSE review. Model: {analysis.modelName ?? "sif-engine"} · Version: {analysis.modelVersion ?? "—"} {analysis.schemaVersion ? `· Schema ${analysis.schemaVersion}` : ""}
      </p>
    </div>
  );
}
