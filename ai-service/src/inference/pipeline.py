"""Prototype inference pipeline: deterministic keyword rules only.

Step 7: single source of truth is the layered assessment engine
(``inference.assess``). This module adapts its output to the frozen legacy
``/analyze`` contract so existing integrations keep working byte-for-byte
(same keys, same PROTO-* code namespace).
"""

from inference.assess import assess_report
from schemas.contract import MODEL_NAME, MODEL_VERSION

# Legacy frozen labels per rule family (unchanged from prototype v0.1.0).
LEGACY_INFO = {
    "SIF-PROTOTYPE-ENERGY-ISOLATION": {
        "activity": "Maintenance", "hazard": "Uncontrolled Energy",
        "barrierFailure": "Energy Isolation", "consequence": "Electrocution",
        "lifeSavingRuleCode": "PROTO-ENERGY-ISOLATION",
    },
    "SIF-PROTOTYPE-WORKING-AT-HEIGHT": {
        "activity": "Work at Height", "hazard": "Fall from Height",
        "barrierFailure": "Fall Protection", "consequence": "Fall Injury",
        "lifeSavingRuleCode": "PROTO-WORK-AT-HEIGHT",
    },
    "SIF-PROTOTYPE-CONFINED-SPACE": {
        "activity": "Confined Space Entry", "hazard": "Hazardous Atmosphere",
        "barrierFailure": "Confined Space Permit", "consequence": "Asphyxiation",
        "lifeSavingRuleCode": "PROTO-CONFINED-SPACE",
    },
    "SIF-PROTOTYPE-MECHANICAL-LIFTING": {
        "activity": "Lifting Operations", "hazard": "Suspended Load",
        "barrierFailure": "Exclusion Zone", "consequence": "Struck By Load",
        "lifeSavingRuleCode": "PROTO-LIFTING",
    },
    "SIF-PROTOTYPE-LINE-OF-FIRE": {
        "activity": "Lifting Operations", "hazard": "Suspended Load",
        "barrierFailure": "Exclusion Zone", "consequence": "Struck By Load",
        "lifeSavingRuleCode": "PROTO-LIFTING",
    },
    "SIF-PROTOTYPE-PRESSURE-RELEASE": {
        "activity": "Line Breaking", "hazard": "Pressurized Release",
        "barrierFailure": "Line Break Permit", "consequence": "Chemical Exposure",
        "lifeSavingRuleCode": "PROTO-LINE-BREAKING",
    },
    "SIF-PROTOTYPE-DRIVING": {
        "activity": "Vehicle Movement", "hazard": "Moving Vehicle",
        "barrierFailure": "Traffic Control", "consequence": "Vehicle Collision",
        "lifeSavingRuleCode": "PROTO-VEHICLE",
    },
    "SIF-PROTOTYPE-BYPASSING-CONTROLS": {
        "activity": None, "hazard": "Bypassed Safeguard",
        "barrierFailure": "Safety Interlock", "consequence": "Uncontrolled Operation",
        "lifeSavingRuleCode": "PROTO-BYPASSED-BARRIER",
    },
}


def match_rules(text):
    """Return [(rule, phrase)] for every taxonomy rule firing on text.

    Kept for backward compatibility. ``rule`` dicts expose the legacy keys
    (code/activity/hazard/barrierFailure/consequence/lifeSavingRuleCode/
    priority/confidence/phrases) derived from the versioned taxonomy.
    """
    from preprocessing.text import normalize
    from triage.rules import RULES
    from triage.screening import screen

    screening = screen(text)
    by_code = {rule["code"]: rule for rule in RULES}
    matched = []
    for match in screening["matchedRules"]:
        rule = by_code[match["code"]]
        info = LEGACY_INFO.get(rule["code"], {})
        matched.append((
            {
                "code": info.get("lifeSavingRuleCode", rule["code"]),
                "activity": info.get("activity"),
                "hazard": info.get("hazard"),
                "barrierFailure": info.get("barrierFailure"),
                "consequence": info.get("consequence"),
                "lifeSavingRuleCode": info.get("lifeSavingRuleCode"),
                "priority": "HIGH" if rule["severity_weight"] >= 0.8 else "MEDIUM",
                "confidence": rule["severity_weight"],
                "phrases": rule["phrases"],
            },
            match["phrase"],
        ))
    # Preserve legacy normalization path for callers importing normalize.
    _ = normalize
    return matched


def run_prototype(report_id, text, language=None):
    """Legacy /analyze handler: layered engine output mapped to the frozen
    legacy contract (same keys, PROTO-* namespace, prototype model id)."""
    result = assess_report(report_id, text, {"language": language} if language else {})
    triage = result["triage"]
    assessment = result["assessment"]
    risk = triage["riskScore"]

    if assessment["sifPotential"] != "YES":
        return {
            "sifPotential": False,
            "confidence": 0.35,
            "activity": None,
            "hazard": None,
            "barrierFailure": None,
            "consequence": None,
            "lifeSavingRuleCode": None,
            "priority": "LOW",
            "evidence": [],
            "extractedEntities": {
                "equipment": [],
                "hazards": [],
                "barriers": [],
                "activities": [],
            },
            "modelName": MODEL_NAME,
            "modelVersion": MODEL_VERSION,
        }

    info = LEGACY_INFO.get(assessment["primaryRule"], {})
    if risk >= 0.9:
        priority = "CRITICAL"
    elif risk >= 0.6:
        priority = "HIGH"
    else:
        priority = "MEDIUM"
    return {
        "sifPotential": True,
        "confidence": risk,
        "activity": info.get("activity"),
        "hazard": info.get("hazard"),
        "barrierFailure": info.get("barrierFailure"),
        "consequence": info.get("consequence"),
        "lifeSavingRuleCode": info.get("lifeSavingRuleCode"),
        "priority": priority,
        "evidence": assessment["evidence"],
        "extractedEntities": {
            "equipment": [a for a in assessment["assets"]],
            "hazards": ([info["hazard"]] if info.get("hazard") else []),
            "barriers": list(assessment["barriersFailed"]),
            "activities": ([info["activity"]] if info.get("activity") else []),
        },
        "modelName": MODEL_NAME,
        "modelVersion": MODEL_VERSION,
    }
