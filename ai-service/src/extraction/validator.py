"""Strict validation for generated extractions.

Every extraction must satisfy the schema; invalid output is NEVER silently
accepted. ``validate_extraction`` returns (ok, errors). Only exact-substring
evidence and grounded fields pass.
"""

from preprocessing.text import normalize
from triage.rules import BY_CODE

EVENT_STATUSES = ("NEAR_MISS", "UNSAFE_ACT", "UNSAFE_CONDITION", "UNKNOWN")
MAX_LEN = {"activity": 150, "hazard_energy": 100, "rationale": 2000}


def validate_extraction(extraction, original_text):
    """Return a list of error strings (empty = valid)."""
    errors = []
    if not isinstance(extraction, dict):
        return ["extraction must be an object"]
    if extraction.get("primary_rule") is not None and extraction.get("primary_rule") not in BY_CODE:
        errors.append("primary_rule is not a known taxonomy code")
    for code in extraction.get("secondary_rules") or []:
        if code not in BY_CODE:
            errors.append("secondary rule is not a known taxonomy code: %s" % code)
    if extraction.get("event_status") not in EVENT_STATUSES:
        errors.append("event_status must be one of %s" % ("/".join(EVENT_STATUSES)))
    for field, limit in MAX_LEN.items():
        value = extraction.get(field)
        if value is not None and (not isinstance(value, str) or len(value) > limit):
            errors.append("%s must be a string of max %d chars" % (field, limit))
    for field in ("barriers_failed", "assets", "evidence"):
        if not isinstance(extraction.get(field), list):
            errors.append("%s must be a list" % field)
        elif any(not isinstance(item, str) for item in extraction[field]):
            errors.append("%s must contain only strings" % field)
    # Evidence grounding: every evidence string must appear verbatim
    # (modulo case/whitespace) in the original report text.
    normalized = normalize(original_text or "")
    for item in extraction.get("evidence") or []:
        if not normalize(item) or normalize(item) not in normalized:
            errors.append("evidence not found in original report: %r" % item[:80])
            break
    return errors
