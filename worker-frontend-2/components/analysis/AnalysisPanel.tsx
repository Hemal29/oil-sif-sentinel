"use client";
import { useEffect, useState } from "react";
import { fetchRuleById } from "@/lib/api";
import type { AIAnalysis } from "@/types/report";
import { PriorityBadge, SifBadge } from "@/components/common/Badges";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[#E8EEF4] py-2.5 last:border-0">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-[#627D98]">{label}</dt>
      <dd className="mt-1 text-[13px] text-[#243B53]">{children}</dd>
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
    return <div className="rounded-[6px] border border-dashed border-[#D9E2EC] bg-[#F8FAFC] px-4 py-6 text-center"><p className="text-[13px] font-medium text-[#627D98]">No assessment available for this report. Use Analyze Report to run the precursor screening.</p></div>;
  }
  if (analysis.analysisStatus === "PENDING") {
    return <div className="rounded-[6px] border border-[#BCCCDC] bg-[#F4F6F8] px-4 py-5 text-center"><p className="text-[13px] font-semibold text-[#102A43]">Screening pending</p><p className="mt-1 text-[12px] text-[#627D98]">The precursor screening has not completed for this report.</p></div>;
  }
  if (analysis.analysisStatus === "FAILED") {
    return <div className="rounded-[6px] border border-[#F5C6C6] bg-[#FCE8E9] px-4 py-5 text-center"><p className="text-[13px] font-semibold text-[#9B1C1C]">Screening failed</p><p className="mt-1 text-[12px] text-[#7A1F1F]">The last screening attempt failed. Retry analysis.</p></div>;
  }

  const layered = analysis.route != null || analysis.riskScore != null;
  const abstained = analysis.route === "ABSTAIN";
  const riskPct = analysis.riskScore != null ? (analysis.riskScore * 100).toFixed(1) : null;
  const evidence = analysis.evidence ?? [];

  return (
    <div>
      {/* Enterprise header */}
      <div className="rounded-[6px] border border-[#D9E2EC] bg-[#F8FAFC] px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#102A43]">Safety Intelligence Assessment</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#8A9BB0]">Automated Precursor Screening — Decision Support Only</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <SifBadge value={analysis.sifPotential} />
            {analysis.priority ? <PriorityBadge value={analysis.priority} /> : null}
            <span className="rounded-[4px] border border-[#D9E2EC] bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#627D98]">{analysis.analysisStatus}</span>
          </div>
        </div>
        <p className="mt-2 border-t border-[#E8EEF4] pt-2 text-[12px] leading-relaxed text-[#627D98]">
          {analysis.sifPotential === true ? "Screening flagged as SIF potential." : analysis.sifPotential === false ? "Screening flagged as non-SIF." : "SIF potential could not be determined."}
          {analysis.confidence !== null ? ` · ${(analysis.confidence * 100).toFixed(1)}% confidence` : ""} Requires HSE review.
        </p>
      </div>

      {/* Structured grid */}
      <div className="mt-4 grid grid-cols-1 gap-0 rounded-[6px] border border-[#D9E2EC] bg-white sm:grid-cols-2">
        <div className="border-b border-[#E8EEF4] px-4 py-3 sm:border-r">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#627D98]">Route</p>
          <p className="mt-1 text-[13px] font-semibold text-[#102A43]">{analysis.route ? analysis.route.replace("_"," ") : "—"}</p>
        </div>
        <div className="border-b border-[#E8EEF4] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#627D98]">Priority</p>
          <p className="mt-1">{analysis.priority ? <PriorityBadge value={analysis.priority} /> : <span className="text-[13px] text-[#8A9BB0]">—</span>}</p>
        </div>
        <div className="border-b border-[#E8EEF4] px-4 py-3 sm:border-r">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#627D98]">Risk Score</p>
          <p className="mt-1 text-[13px] tabular-nums text-[#243B53]">{riskPct !== null ? `${riskPct}%` : "—"} <span className="text-[11px] text-[#8A9BB0]">heuristic — not calibrated probability</span></p>
        </div>
        <div className="border-b border-[#E8EEF4] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#627D98]">SIF Potential</p>
          <p className="mt-1">{abstained ? <span className="rounded-[4px] bg-[#F4F6F8] border border-[#D9E2EC] px-2 py-0.5 text-[11px] font-bold uppercase text-[#627D98]">Insufficient Information</span> : <SifBadge value={analysis.sifPotential} />}</p>
        </div>
        <div className="border-b border-[#E8EEF4] px-4 py-3 sm:border-r">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#627D98]">Primary Precursor</p>
          <p className="mt-1 text-[13px] text-[#243B53]">{analysis.primaryRule ?? "—"}</p>
        </div>
        <div className="border-b border-[#E8EEF4] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#627D98]">Hazard Energy</p>
          <p className="mt-1 text-[13px] text-[#243B53]">{analysis.hazardEnergy ?? "—"}</p>
        </div>
        <div className="border-b border-[#E8EEF4] px-4 py-3 sm:border-r">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#627D98]">Barriers Failed</p>
          <p className="mt-1 text-[13px] text-[#243B53]">{analysis.barriersFailed && analysis.barriersFailed.length ? analysis.barriersFailed.join("; ") : "—"}</p>
        </div>
        <div className="border-b border-[#E8EEF4] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#627D98]">Assets</p>
          <p className="mt-1 text-[13px] text-[#243B53]">{analysis.assets && analysis.assets.length ? analysis.assets.join(", ") : "—"}</p>
        </div>
        {layered ? (
          <>
            <div className="border-b border-[#E8EEF4] px-4 py-3 sm:border-r">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#627D98]">Matched Rules</p>
              <p className="mt-1 text-[13px] font-medium text-[#243B53]">{analysis.matchedRules && analysis.matchedRules.length ? analysis.matchedRules.map(r=>r.code).join(", ") : "None"}</p>
            </div>
            <div className="border-b border-[#E8EEF4] px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#627D98]">Secondary Rules</p>
              <p className="mt-1 text-[13px] text-[#243B53]">{analysis.secondaryRules && analysis.secondaryRules.length ? analysis.secondaryRules.join(", ") : "—"}</p>
            </div>
            <div className="px-4 py-3 sm:border-r">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#627D98]">Life-Saving Rule</p>
              <p className="mt-1 text-[13px] font-medium text-[#243B53]">{ruleLabel ?? analysis.lifeSavingRuleId ?? "—"}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#627D98]">Extraction</p>
              <p className="mt-1 text-[12px] text-[#243B53]">{analysis.extractionStatus ?? "—"}{analysis.repairAttempts ? ` · ${analysis.repairAttempts} repair` : ""}{analysis.failureReason ? ` · ${analysis.failureReason}` : ""}</p>
            </div>
          </>
        ) : null}
      </div>

      {analysis.rationale ? (
        <div className="mt-4 rounded-[6px] border border-[#D9E2EC] bg-[#F8FAFC] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#627D98]">Rationale</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#243B53]">{analysis.rationale}</p>
        </div>
      ) : null}

      {abstained && analysis.clarificationRequest ? (
        <div className="mt-4 rounded-[6px] border border-[#E8D9A8] bg-[#FFF8E1] px-4 py-3">
          <p className="text-[12px] font-bold text-[#7A5A00]">Additional information required</p>
          <p className="mt-1 text-[12px] text-[#5D4400]">{analysis.clarificationRequest.reason}</p>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-[13px] text-[#5D4400]">{analysis.clarificationRequest.suggestedQuestions.map((q,i)=><li key={i}>{q}</li>)}</ul>
        </div>
      ) : null}

      <div className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#627D98]">Evidence — exact phrases from report</p>
        {evidence.length === 0 ? <p className="mt-2 text-[13px] text-[#8A9BB0]">No evidence phrases returned.</p> : (
          <ul className="mt-2 space-y-2">
            {evidence.map((e,i)=>(
              <li key={i} className="rounded-[4px] border border-[#D9E2EC] border-l-4 border-l-[#102A43] bg-[#F8FAFC] px-3 py-2 text-[13px] leading-relaxed text-[#243B53]">“{e}”</li>
            ))}
          </ul>
        )}
      </div>

      {analysis.extractedEntities ? (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#627D98]">Extracted Entities</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {( [["Equipment", analysis.extractedEntities.equipment],["Hazards", analysis.extractedEntities.hazards],["Barriers", analysis.extractedEntities.barriers],["Activities", analysis.extractedEntities.activities]] as [string, string[]][]).map(([label, vals])=>(
              <div key={label} className="rounded-[4px] border border-[#D9E2EC] bg-[#F8FAFC] px-3 py-2.5"><p className="text-[11px] font-bold uppercase tracking-wide text-[#627D98]">{label}</p>{vals.length===0?<p className="mt-1 text-[12px] text-[#8A9BB0]">None</p>:<div className="mt-1.5 flex flex-wrap gap-1.5">{vals.map((v:string,i:number)=><span key={i} className="rounded-full border border-[#D9E2EC] bg-white px-2 py-0.5 text-[12px] text-[#243B53]">{v}</span>)}</div>}</div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-4 rounded-[4px] border border-[#D9E2EC] bg-[#F8FAFC] px-3 py-2 text-[11px] leading-relaxed text-[#627D98]">
        Automated assessment is decision support and requires HSE review. Model: {analysis.modelName ?? "sif-engine"} · Version: {analysis.modelVersion ?? "—"} {analysis.schemaVersion ? `· Schema ${analysis.schemaVersion}` : ""}
      </p>
    </div>
  );
}
