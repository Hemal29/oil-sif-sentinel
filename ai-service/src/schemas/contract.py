"""Frozen Node <-> Python contract for Step 5.

"Prototype output for system integration testing; not a production safety
prediction model." It must NOT be interpreted as official OIL SIF methodology.

Request (Node -> Python):
    {"reportId": str, "text": str, "language": str | None}

Response (Python -> Node):
    {
        "sifPotential": bool,
        "confidence": float (0..1),
        "activity": str | None,
        "hazard": str | None,
        "barrierFailure": str | None,
        "consequence": str | None,
        "lifeSavingRuleCode": str | None,  # prototype-namespace code, never a DB id
        "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        "evidence": [str, ...],            # exact substrings of the input text
        "extractedEntities": {
            "equipment": [str, ...],
            "hazards": [str, ...],
            "barriers": [str, ...],
            "activities": [str, ...],
        },
        "modelName": str,
        "modelVersion": str,
    }
"""

MODEL_NAME = "prototype"
MODEL_VERSION = "0.1.0"

PRIORITIES = ("LOW", "MEDIUM", "HIGH", "CRITICAL")

REQUEST_EXAMPLE = {
    "reportId": "REPORT_ID",
    "text": "Safety report text",
    "language": "en",
}

RESPONSE_EXAMPLE = {
    "sifPotential": True,
    "confidence": 0.92,
    "activity": "Maintenance",
    "hazard": "Uncontrolled Energy",
    "barrierFailure": "Energy Isolation",
    "consequence": "Electrocution",
    "lifeSavingRuleCode": None,
    "priority": "HIGH",
    "evidence": ["without isolating the electrical supply"],
    "extractedEntities": {
        "equipment": ["Pump"],
        "hazards": ["Uncontrolled Energy"],
        "barriers": ["Energy Isolation"],
        "activities": ["Maintenance"],
    },
    "modelName": MODEL_NAME,
    "modelVersion": MODEL_VERSION,
}


def validate_request(payload):
    """Return (report_id, text, language) or raise ValueError."""
    if not isinstance(payload, dict):
        raise ValueError("request body must be a JSON object")
    report_id = payload.get("reportId")
    text = payload.get("text")
    language = payload.get("language")
    if not isinstance(report_id, str) or not report_id.strip():
        raise ValueError("reportId must be a non-empty string")
    if not isinstance(text, str) or not text.strip():
        raise ValueError("text must be a non-empty string")
    if language is not None and not isinstance(language, str):
        raise ValueError("language must be a string or null")
    return report_id.strip(), text, language
