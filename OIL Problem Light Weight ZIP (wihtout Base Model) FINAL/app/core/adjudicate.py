"""Pure adjudication between the deterministic fast lane and the LLM output.

Kept separate from the FastAPI route so it can be unit-tested without the
transformers/peft runtime. Contract: a critical deterministic finding always
wins over a low or noisy LLM score and can never end in AUTO_CLOSE + NON-SIF.
"""

from typing import Any, Dict, List

from app.schemas.payload import Barrier


def adjudicate(fast: Dict, raw_output: Dict, raw_barriers: Any) -> Dict[str, Any]:
    """Return the overridden triage/assessment fields for the response.

    ``fast`` is the result of ``fastlane_screen``; ``raw_output`` is the raw
    LLM JSON (already parsed/validated upstream).
    """
    secondary_rules: List[str] = []
    if isinstance(raw_output.get("secondary_rules"), list):
        secondary_rules = list(raw_output["secondary_rules"])

    is_sif = raw_output.get("sif_potential") == "yes"
    route = "priority" if is_sif else "auto_close"
    risk_score = 0.94 if is_sif else 0.05
    requires_human_review = is_sif
    sif_potential = raw_output.get("sif_potential", "no")
    primary_rule = raw_output.get("primary_rule", "none")
    rationale = raw_output.get("rationale", "") if is_sif else ""
    barriers: List[Barrier] = list(raw_barriers or [])

    # --- Deterministic override ---------------------------------------
    if fast["critical"]:
        codes = [m["code"] for m in fast["matched_rules"]]
        phrases = ", ".join(m["phrase"] for m in fast["matched_rules"] if m.get("phrase"))
        reason = "Deterministic rule matched: %s (%s)" % (
            ", ".join(codes), phrases or "isolation/exposure evidence")

        if not is_sif:
            rationale = (
                "%s. A critical SIF precursor was found by the deterministic "
                "rule engine, so the LLM NON-SIF verdict is overridden and "
                "routed to human review." % reason
            )
        elif not rationale:
            rationale = reason

        is_sif = True
        sif_potential = "yes"
        route = "priority"
        requires_human_review = True
        risk_score = max(risk_score, 0.94)

        deterministic_primary = "energy_isolation" if "energy_isolation" in codes else codes[0]
        if primary_rule in (None, "", "none", "None"):
            primary_rule = deterministic_primary
        elif primary_rule != deterministic_primary and deterministic_primary == "energy_isolation":
            secondary_rules.append(primary_rule)
            primary_rule = deterministic_primary

        if "energy_isolation" in codes:
            names = {b.name for b in barriers}
            if "isolation_not_applied" not in names:
                barriers.append(Barrier(type="procedural", name="isolation_not_applied"))
            if "lockout_tagout_not_applied" not in names:
                barriers.append(Barrier(type="procedural", name="lockout_tagout_not_applied"))

    hazard_energy = raw_output.get("hazard_energy", "none_identified")
    if fast["critical"] and hazard_energy in (None, "", "none_identified"):
        if "energy_isolation" in fast.get("codes", []):
            hazard_energy = "electrical"
            primary_rule = primary_rule or "energy_isolation"

    # --- Section 6 consistency: extraction barrier vs verdict -----------
    barrier_names = " ".join(str(b.name).lower() for b in barriers)
    if ("isolation" in barrier_names or "lockout" in barrier_names) and sif_potential != "yes":
        sif_potential = "yes"
        is_sif = True
        if rationale == "":
            rationale = "Isolation/lockout barrier identified by extraction."
        if route == "auto_close":
            route = "priority"
            requires_human_review = True
            risk_score = max(risk_score, 0.75)

    return {
        "route": route,
        "risk_score": risk_score,
        "requires_human_review": requires_human_review,
        "sif_potential": sif_potential,
        "primary_rule": primary_rule or "none",
        "secondary_rules": secondary_rules,
        "hazard_energy": hazard_energy,
        "event_status": raw_output.get("event_status", "unclear"),
        "barriers": barriers,
        "rationale": rationale,
        "is_sif": is_sif,
    }