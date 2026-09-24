"""Controlled repair for invalid extractions.

Repair is deterministic and conservative: drop ungrounded evidence, clamp
overlong strings, coerce unknown enums to safe defaults. After at most
``MAX_REPAIR_ATTEMPTS`` the extraction is re-validated; if still invalid the
pipeline marks ``extraction.status = "failed"`` with a failure reason —
never silently accepted.
"""

from extraction.validator import validate_extraction
from preprocessing.text import normalize

MAX_REPAIR_ATTEMPTS = 2


def repair_extraction(extraction, original_text):
    """Attempt controlled repair. Returns (repaired_dict, attempts_made)."""
    repaired = {
        "activity": extraction.get("activity"),
        "primary_rule": extraction.get("primary_rule"),
        "secondary_rules": list(extraction.get("secondary_rules") or []),
        "hazard_energy": extraction.get("hazard_energy"),
        "event_status": extraction.get("event_status"),
        "barriers_failed": list(extraction.get("barriers_failed") or []),
        "assets": list(extraction.get("assets") or []),
        "evidence": list(extraction.get("evidence") or []),
        "rationale": extraction.get("rationale"),
    }
    attempts = 0
    from triage.rules import BY_CODE  # deferred to avoid cycles

    # Attempt 1: drop ungrounded evidence + unknown rule codes, clamp enums.
    normalized = normalize(original_text or "")
    repaired["evidence"] = [e for e in repaired["evidence"] if normalize(e) and normalize(e) in normalized]
    repaired["secondary_rules"] = [c for c in repaired["secondary_rules"] if c in BY_CODE]
    if repaired["primary_rule"] not in BY_CODE:
        repaired["primary_rule"] = None
    if repaired["event_status"] not in ("NEAR_MISS", "UNSAFE_ACT", "UNSAFE_CONDITION", "UNKNOWN"):
        repaired["event_status"] = "UNKNOWN"
    for field, limit in (("activity", 150), ("hazard_energy", 100), ("rationale", 2000)):
        if isinstance(repaired[field], str) and len(repaired[field]) > limit:
            repaired[field] = repaired[field][:limit]
    attempts = 1
    if not validate_extraction(repaired, original_text):
        return repaired, attempts
    # Attempt 2: minimal safe skeleton (keep grounded evidence only).
    attempts = 2
    repaired = {
        "activity": None,
        "primary_rule": None,
        "secondary_rules": [],
        "hazard_energy": None,
        "event_status": "UNKNOWN",
        "barriers_failed": [],
        "assets": [],
        "evidence": repaired["evidence"],
        "rationale": "Extraction failed validation after repair; minimal grounded output retained.",
    }
    return repaired, attempts
