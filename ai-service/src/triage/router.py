"""Route decision: AUTO_CLOSE / UNCERTAIN / PRIORITY / ABSTAIN.

These are routing decisions for HSE attention — NOT final HSE decisions.
Human HSE reviewers remain authoritative.

- AUTO_CLOSE: no meaningful signal, sufficient information (low risk).
- UNCERTAIN: some risk signal but evidence thin/ambiguous.
- PRIORITY: strong SIF precursor signal requiring HSE attention.
- ABSTAIN: insufficient information to safely assess (too short or no
  hazard content at all).
"""

from preprocessing.text import normalize

ABSTAIN_MIN_CHARS = 20

INFORMATION_CUES = [
    "worker", "technician", "operator", "contractor", "crew", "helper",
    "pump", "valve", "crane", "scaffold", "ladder", "tank", "vessel",
    "platform", "wire", "cable", "pipe", "flange", "vehicle", "forklift",
    "load", "harness", "permit", "area", "site", "unit", "plant",
]

# Vague concern with no grounded hazard detail: cannot be safely closed —
# the reporter flags *something* but the text gives HSE nothing to verify.
VAGUE_CONCERN_CUES = [
    "something unsafe", "something wrong", "unsafe act seen",
    "seen unsafe", "noticed unsafe",
]

# Explicitly benign administrative/safety-activity cues: a report describing
# these with no precursor signal is safe to AUTO_CLOSE.
BENIGN_CUES = [
    "toolbox talk", "training", "mock drill", "drill", "meeting",
    "attendance", "housekeeping", "audit", "no issue", "no abnormality",
    "all clear", "normal operation", "routine inspection",
    # Positive isolation/verification statements must NOT be misread as an
    # isolation failure merely because the words "isolation"/"lockout" appear.
    "was verified", "were verified", "verified before", "proper isolation",
    "inspected", "successfully isolated", "verified after",
]


def decide_route(text, screening, risk_score):
    """Return (route, requires_human_review, escalated_to_extraction, reason)."""
    content = (text or "").strip()
    normalized = normalize(content)
    words = [w for w in normalized.split(" ") if w]

    info_hits = sum(1 for cue in INFORMATION_CUES if cue in normalized)
    too_short = len(content) < ABSTAIN_MIN_CHARS or len(words) < 5

    if not screening["triggered"]:
        benign = any(cue in normalized for cue in BENIGN_CUES)
        vague = any(cue in normalized for cue in VAGUE_CONCERN_CUES)
        if benign and not too_short and not vague:
            return ("AUTO_CLOSE", False, False, "no SIF precursor signal; benign report with sufficient information")
        if too_short or info_hits == 0 or vague:
            return ("ABSTAIN", True, False, "insufficient information for safe assessment")
        return ("AUTO_CLOSE", False, False, "no SIF precursor signal detected")

    # Critical deterministic trigger (e.g. confirmed energy-isolation failure).
    # This MUST override any low heuristic/model score: such reports can never
    # be AUTO_CLOSEd, and with worker exposure they always route PRIORITY.
    if screening.get("critical"):
        return ("PRIORITY", True, True,
                "critical deterministic SIF trigger — isolation/lockout failure with energy exposure")

    # Signal present.
    if too_short and len(screening["matchedRules"]) <= 1 and risk_score < 0.7:
        return ("ABSTAIN", True, False, "precursor hint present but report too brief to assess safely")
    # Brief single-signal reports carry thin evidence: never go straight to
    # PRIORITY no matter the cue bonuses — route UNCERTAIN so HSE reviews.
    brief_single = len(words) < 12 and len(screening["matchedRules"]) <= 1
    if risk_score >= 0.75 or screening["signal"] == "STRONG":
        if brief_single:
            return ("UNCERTAIN", True, True, "precursor signal present but report too brief for priority routing")
        return ("PRIORITY", True, True, "strong SIF precursor signal")
    return ("UNCERTAIN", True, True, "risk signal present but evidence incomplete")
