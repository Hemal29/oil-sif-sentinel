"""SIF assessment pipeline: screening -> rules -> risk -> route -> extraction.

Worker/HSE Report -> screening -> deterministic triggers -> risk scoring ->
route decision -> (generative extraction for UNCERTAIN/PRIORITY) ->
validation/repair -> assessment object. ABSTAIN returns clarification
questions. Never invents evidence; HSE review remains authoritative.
"""

import os
import time
from datetime import datetime, timezone

from extraction.extractor import MODEL_VERSION_RULEBASED, get_provider
from extraction.repair import MAX_REPAIR_ATTEMPTS, repair_extraction
from extraction.validator import validate_extraction
from schemas.assessment import SCHEMA_VERSION, validate_assessment
from triage.clarification import build_clarification
from triage.risk import score_risk
from triage.router import decide_route
from triage.rules import TAXONOMY_VERSION
from triage.screening import screen


def _utcnow():
    return datetime.now(timezone.utc).isoformat()


def _reconcile_result(result, screening):
    """Consistency guarantee: deterministic screening + extraction must agree
    with the final routing.

    - A critical deterministic trigger (confirmed isolation/lockout failure)
      can never be AUTO_CLOSEd or forced to NON-SIF by a low score.
    - An extraction identifying a critical isolation/LOTO barrier can never
      coexist with a NON-SIF / AUTO_CLOSE verdict.

    Any reconciliation is performed, and the reason is appended to
    ``metadata.routeReason`` so the escalation stays auditable and explainable.
    """
    recon = []
    matched = result["triage"]["ruleBasedSignal"]["matchedRules"]
    critical = screening.get("critical") or any(m.get("critical") for m in matched)

    if critical:
        if result["triage"]["route"] != "PRIORITY":
            result["triage"]["route"] = "PRIORITY"
            result["triage"]["requiresHumanReview"] = True
            result["triage"]["escalatedToExtraction"] = True
            recon.append("critical deterministic trigger escalated to PRIORITY")
        if result["assessment"]["sifPotential"] != "YES":
            result["assessment"]["sifPotential"] = "YES"
            recon.append("critical deterministic trigger forces SIF=YES")

    barriers = [str(b).lower() for b in result["assessment"].get("barriersFailed") or []]
    isolation_barrier = any("isolation" in b or "lockout" in b or "loto" in b or "tag" in b for b in barriers)
    if isolation_barrier and result["assessment"]["sifPotential"] != "YES":
        result["assessment"]["sifPotential"] = "YES"
        recon.append("extraction isolation barrier present with non-SIF verdict -> reconciled to SIF=YES")
    if isolation_barrier and result["triage"]["route"] == "AUTO_CLOSE":
        result["triage"]["route"] = "UNCERTAIN"
        result["triage"]["requiresHumanReview"] = True
        result["triage"]["escalatedToExtraction"] = True
        recon.append("extraction isolation barrier present with AUTO_CLOSE -> reconciled to UNCERTAIN")

    if recon and isinstance(result.get("metadata"), dict):
        reason = result["metadata"].get("routeReason", "")
        result["metadata"]["routeReason"] = (reason + "; " if reason else "") + "; ".join(recon)
    return result


def assess_report(record_id, text, metadata=None, provider_name=None):
    """Run the full layered assessment. Returns the assessment dict."""
    received_at = _utcnow()
    started = time.perf_counter()
    provider_name = provider_name or os.environ.get("SIF_EXTRACTION_PROVIDER", "rule-based")

    screening = screen(text)
    matched = screening["matchedRules"]
    risk = score_risk(text, matched)
    route, requires_review, escalated, route_reason = decide_route(text, screening, risk["risk_score"])

    if route == "ABSTAIN":
        sif_potential = "INSUFFICIENT_INFORMATION"
    elif route == "AUTO_CLOSE":
        sif_potential = "NO"
    else:
        sif_potential = "YES"

    extraction_info = {"status": "skipped", "modelVersion": None, "repairAttempts": 0, "failureReason": None}
    extracted = {
        "activity": None,
        "primary_rule": None,
        "secondary_rules": [],
        "hazard_energy": None,
        "event_status": "UNKNOWN",
        "barriers_failed": [],
        "assets": [],
        "evidence": [],
        "rationale": route_reason + ".",
    }
    clarification = None

    if route in ("UNCERTAIN", "PRIORITY"):
        provider = get_provider(provider_name)
        try:
            extracted = provider.extract(text, matched)
            errors = validate_extraction(extracted, text)
            if not errors:
                extraction_info = {
                    "status": "success",
                    "modelVersion": MODEL_VERSION_RULEBASED if provider_name == "rule-based" else provider_name,
                    "repairAttempts": 0,
                    "failureReason": None,
                }
            else:
                repaired, attempts = repair_extraction(extracted, text)
                re_errors = validate_extraction(repaired, text)
                if not re_errors:
                    extracted = repaired
                    extraction_info = {
                        "status": "repaired",
                        "modelVersion": MODEL_VERSION_RULEBASED if provider_name == "rule-based" else provider_name,
                        "repairAttempts": attempts,
                        "failureReason": None,
                    }
                else:
                    extraction_info = {
                        "status": "failed",
                        "modelVersion": MODEL_VERSION_RULEBASED if provider_name == "rule-based" else provider_name,
                        "repairAttempts": MAX_REPAIR_ATTEMPTS,
                        "failureReason": "; ".join(re_errors[:5]),
                    }
        except RuntimeError as exc:  # pending provider (local-7b/hosted)
            extraction_info = {
                "status": "pending-provider",
                "modelVersion": provider_name,
                "repairAttempts": 0,
                "failureReason": str(exc)[:500],
            }
    elif route == "ABSTAIN":
        clarification = build_clarification(route_reason, matched)

    result = {
        "schemaVersion": SCHEMA_VERSION,
        "recordId": record_id,
        "metadata": {
            "taxonomyVersion": TAXONOMY_VERSION,
            "scoreKind": risk["score_kind"],
            "routeReason": route_reason,
            "provider": provider_name,
            **(metadata or {}),
        },
        "receivedAt": received_at,
        "processedAt": _utcnow(),
        "processingMs": int((time.perf_counter() - started) * 1000),
        "triage": {
            "route": route,
            "requiresHumanReview": requires_review,
            "escalatedToExtraction": escalated,
            "riskScore": risk["risk_score"],
            "ruleBasedSignal": {"triggered": screening["triggered"], "matchedRules": matched},
        },
        "assessment": {
            "sifPotential": sif_potential,
            "activity": extracted.get("activity"),
            "primaryRule": extracted.get("primary_rule"),
            "secondaryRules": extracted.get("secondary_rules") or [],
            "hazardEnergy": extracted.get("hazard_energy"),
            "eventStatus": extracted.get("event_status") or "UNKNOWN",
            "barriersFailed": extracted.get("barriers_failed") or [],
            "assets": extracted.get("assets") or [],
            "rationale": extracted.get("rationale"),
            "evidence": extracted.get("evidence") or [],
        },
        "extraction": extraction_info,
        "clarificationRequest": clarification,
    }
    # Section 6: reconcile deterministic screening + extraction with routing
    # before final validation (never emit contradictory AUTO_CLOSE + barrier).
    result = _reconcile_result(result, screening)
    # Internal self-check: never emit an invalid assessment.
    errors = validate_assessment(result)
    if errors:
        raise RuntimeError("assessment pipeline produced invalid output: %s" % "; ".join(errors))
    return result
