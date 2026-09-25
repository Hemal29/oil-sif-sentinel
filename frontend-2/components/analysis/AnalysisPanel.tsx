"use client";
import { useEffect, useState } from "react";
import { fetchRuleById } from "@/lib/api";
import type { AIAnalysis } from "@/types/report";
import { PriorityBadge, SifBadge } from "@/components/common/Badges";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[#F2EEE5] py-2.5 last:border-0">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">{label}</dt>
      <dd className="mt-1 text-[13px] text-[#14283F]">{children}</dd>
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
    return <div className="rounded-[6px] border border-dashed border-[#E7E1D4] bg-[#FAF8F4] px-4 py-6 text-center"><p className="text-[13px] font-medium text-[#6B7385]">No assessment available for this report. Use Analyze Report to run the precursor screening.</p></div>;
  }
  if (analysis.analysisStatus === "PENDING") {
    return <div className="rounded-[6px] border border-[#D9D0BE] bg-[#F2EEE5] px-4 py-5 text-center"><p className="text-[13px] font-semibold text-[#14283F]">Screening pending</p><p className="mt-1 text-[12px] text-[#6B7385]">The precursor screening has not completed for this report.</p></div>;
  }
  if (analysis.analysisStatus === "FAILED") {
    return <div className="rounded-[6px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-5 text-center"><p className="text-[13px] font-semibold text-[#991B1B]">Screening failed</p><p className="mt-1 text-[12px] text-[#B91C1C]">The last screening attempt failed. Retry analysis.</p></div>;
  }

  const layered = analysis.route != null || analysis.riskScore != null;
  const abstained = analysis.route === "ABSTAIN";
  const riskPct = analysis.riskScore != null ? (analysis.riskScore * 100).toFixed(1) : null;
  const evidence = analysis.evidence ?? [];

  return (
    <div>
      {/* Enterprise header */}
      <div className="rounded-[6px] border border-[#E7E1D4] bg-[#FAF8F4] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#14283F]">Safety Intelligence Assessment</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#9BA3AF]">Automated Precursor Screening — Decision Support Only</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <SifBadge value={analysis.sifPotential} />
            {analysis.priority ? <PriorityBadge value={analysis.priority} /> : null}
            <span className="rounded-[4px] border border-[#E7E1D4] bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#6B7385]">{analysis.analysisStatus}</span>
          </div>
        </div>
        <p className="mt-2 border-t border-[#F2EEE5] pt-2 text-[12px] leading-relaxed text-[#6B7385]">
          {analysis.sifPotential === true ? "Screening flagged as SIF potential." : analysis.sifPotential === false ? "Screening flagged as non-SIF." : "SIF potential could not be determined."}
          {analysis.confidence !== null ? ` · ${(analysis.confidence * 100).toFixed(1)}% confidence` : ""} Requires HSE review.
        </p>
      </div>

      {/* Structured grid */}
      <div className="mt-4 grid grid-cols-1 gap-0 rounded-[6px] border border-[#E7E1D4] bg-white sm:grid-cols-2">
        <div className="border-b border-[#F2EEE5] px-4 py-3 sm:border-r">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">Route</p>
          <p className="mt-1 text-[13px] font-semibold text-[#14283F]">{analysis.route ? analysis.route.replace("_"," ") : "—"}</p>
        </div>
        <div className="border-b border-[#F2EEE5] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">Priority</p>
          <p className="mt-1">{analysis.priority ? <PriorityBadge value={analysis.priority} /> : <span className="text-[13px] text-[#9BA3AF]">—</span>}</p>
        </div>
        <div className="border-b border-[#F2EEE5] px-4 py-3 sm:border-r">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">Risk Score</p>
          <p className="mt-1 text-[13px] tabular-nums text-[#14283F]">{riskPct !== null ? `${riskPct}%` : "—"} <span className="text-[11px] text-[#9BA3AF]">heuristic — not calibrated probability</span></p>
        </div>
        <div className="border-b border-[#F2EEE5] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">SIF Potential</p>
          <p className="mt-1">{abstained ? <span className="rounded-[4px] bg-[#F2EEE5] border border-[#E7E1D4] px-2 py-0.5 text-[11px] font-bold uppercase text-[#6B7385]">Insufficient Information</span> : <SifBadge value={analysis.sifPotential} />}</p>
        </div>
        <div className="border-b border-[#F2EEE5] px-4 py-3 sm:border-r">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">Primary Precursor</p>
          <p className="mt-1 text-[13px] text-[#14283F]">{analysis.primaryRule ?? "—"}</p>
        </div>
        <div className="border-b border-[#F2EEE5] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">Hazard Energy</p>
          <p className="mt-1 text-[13px] text-[#14283F]">{analysis.hazardEnergy ?? "—"}</p>
        </div>
        <div className="border-b border-[#F2EEE5] px-4 py-3 sm:border-r">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">Barriers Failed</p>
          <p className="mt-1 text-[13px] text-[#14283F]">{analysis.barriersFailed && analysis.barriersFailed.length ? analysis.barriersFailed.join("; ") : "—"}</p>
        </div>
        <div className="border-b border-[#F2EEE5] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">Assets</p>
          <p className="mt-1 text-[13px] text-[#14283F]">{analysis.assets && analysis.assets.length ? analysis.assets.join(", ") : "—"}</p>
        </div>
        {layered ? (
          <>
            <div className="border-b border-[#F2EEE5] px-4 py-3 sm:border-r">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">Matched Rules</p>
              <p className="mt-1 text-[13px] font-medium text-[#14283F]">{analysis.matchedRules && analysis.matchedRules.length ? analysis.matchedRules.map(r=>r.code).join(", ") : "None"}</p>
            </div>
            <div className="border-b border-[#F2EEE5] px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">Secondary Rules</p>
              <p className="mt-1 text-[13px] text-[#14283F]">{analysis.secondaryRules && analysis.secondaryRules.length ? analysis.secondaryRules.join(", ") : "—"}</p>
            </div>
            <div className="px-4 py-3 sm:border-r">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">Life-Saving Rule</p>
              <p className="mt-1 text-[13px] font-medium text-[#14283F]">{ruleLabel ?? analysis.lifeSavingRuleId ?? "—"}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">Extraction</p>
              <p className="mt-1 text-[12px] text-[#14283F]">{analysis.extractionStatus ?? "—"}{analysis.repairAttempts ? ` · ${analysis.repairAttempts} repair` : ""}{analysis.failureReason ? ` · ${analysis.failureReason}` : ""}</p>
            </div>
          </>
        ) : null}
      </div>

      {analysis.rationale ? (
        <div className="mt-4 rounded-[6px] border border-[#E7E1D4] bg-[#FAF8F4] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">Rationale</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#14283F]">{analysis.rationale}</p>
        </div>
      ) : null}

      {abstained && analysis.clarificationRequest ? (
        <div className="mt-4 rounded-[6px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
          <p className="text-[12px] font-bold text-[#7A5A00]">Additional information required</p>
          <p className="mt-1 text-[12px] text-[#5D4400]">{analysis.clarificationRequest.reason}</p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-[13px] text-[#5D4400]">{analysis.clarificationRequest.suggestedQuestions.map((q,i)=><li key={i}>{q}</li>)}</ul>
        </div>
      ) : null}

      <div className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">Evidence — exact phrases from report</p>
        {evidence.length === 0 ? <p className="mt-2 text-[13px] text-[#9BA3AF]">No evidence phrases returned.</p> : (
          <ul className="mt-2 space-y-2">
            {evidence.map((e,i)=>(
              <li key={i} className="rounded-[4px] border border-[#E7E1D4] border-l-4 border-l-[#14283F] bg-[#FAF8F4] px-3 py-2 text-[13px] leading-relaxed text-[#14283F]">“{e}”</li>
            ))}
          </ul>
        )}
      </div>

      {analysis.extractedEntities ? (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">Extracted Entities</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {( [["Equipment", analysis.extractedEntities.equipment],["Hazards", analysis.extractedEntities.hazards],["Barriers", analysis.extractedEntities.barriers],["Activities", analysis.extractedEntities.activities]] as [string, string[]][]).map(([label, vals])=>(
              <div key={label} className="rounded-[4px] border border-[#E7E1D4] bg-[#FAF8F4] px-3 py-2.5"><p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7385]">{label}</p>{vals.length===0?<p className="mt-1 text-[12px] text-[#9BA3AF]">None</p>:<div className="mt-1.5 flex flex-wrap gap-1.5">{vals.map((v:string,i:number)=><span key={i} className="rounded-full border border-[#E7E1D4] bg-white px-2 py-0.5 text-[12px] text-[#14283F]">{v}</span>)}</div>}</div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-4 rounded-[4px] border border-[#E7E1D4] bg-[#FAF8F4] px-3 py-2 text-[11px] leading-relaxed text-[#6B7385]">
        Automated assessment is decision support and requires HSE review. Model: {analysis.modelName ?? "sif-engine"} · Version: {analysis.modelVersion ?? "—"} {analysis.schemaVersion ? `· Schema ${analysis.schemaVersion}` : ""}
      </p>
    </div>
  );
}
