"""Deterministic heuristic risk score (prototype).

``risk_score`` in 0.0..1.0. This is a transparent keyword-evidence heuristic,
NOT a statistically calibrated probability. It is labelled
``score_kind="heuristic-prototype"`` until real validation data exists.

Signals considered: high-energy exposure (severity_weight), worker exposure,
barrier failure, loss of isolation, fall potential, uncontrolled movement,
fire/explosion potential, severity indicators, proximity/exposure. Energy
isolation failures, live/energized exposure, electrical severity and failed
safety barriers contribute strong deterministic buckets. No facts are
invented: only matched rules + severity cue words present in the text
contribute.
"""

from preprocessing.text import normalize
from triage.rules import BY_CODE
from triage.screening import detect_isolation_evidence

SEVERITY_CUES = {
    "fatal": 0.10,
    "death": 0.10,
    "explosion": 0.10,
    "blast": 0.10,
    "fire broke out": 0.10,
    "uncontrolled": 0.06,
    "without": 0.04,
    "no ": 0.03,
    "failed": 0.04,
    "failure": 0.04,
    "exposed": 0.04,
    "nearly": 0.02,
    "almost": 0.02,
    "critical": 0.05,
    "severe": 0.05,
}

EXPOSURE_CUES = [
    "worker",
    "technician",
    "operator",
    "contractor",
    "helper",
    "crew",
    "person",
    "man",
    "nearby",
    "standing",
    "stood",
]

ELECTRICAL_SEVERITY_CUES = [
    "electrocution",
    "electric shock",
    "arcing",
    "arc flash",
    "shock",
    "burn",
]

SCORE_KIND = "heuristic-prototype"


def score_risk(text, matched_rules):
    """Deterministic 0..1 heuristic score from matched rules + cue words."""
    if not matched_rules:
        return {"risk_score": 0.05, "score_kind": SCORE_KIND, "contributors": ["no precursor signal"]}
    normalized = normalize(text or "")
    weights = [BY_CODE[m["code"]]["severity_weight"] for m in matched_rules]
    base = max(weights)
    # Multiple independent hazards raise the score, capped.
    multi = min(0.10, 0.05 * (len(matched_rules) - 1)) if len(matched_rules) > 1 else 0.0
    contributors = [m["code"] for m in matched_rules]
    cue_bonus = 0.0
    for cue, bonus in SEVERITY_CUES.items():
        if cue in normalized:
            cue_bonus += bonus
            contributors.append("cue:%s" % cue.strip())

    # --- Deterministic evidence buckets (grounded in the report text) ---
    isolation = detect_isolation_evidence(text)
    if isolation["failure"]:
        cue_bonus += 0.05
        contributors.append("evidence:isolation-failure")
    if isolation["energy"]:
        cue_bonus += 0.04
        contributors.append("evidence:high-energy-exposure")
    if isolation["exposure"]:
        cue_bonus += 0.03
        contributors.append("evidence:worker-exposure")
    if isolation["lockout_domain"]:
        cue_bonus += 0.02
        contributors.append("evidence:lockout-domain")
    if any(cue in normalized for cue in ELECTRICAL_SEVERITY_CUES):
        cue_bonus += 0.06
        contributors.append("cue:electrical-severity")
    if any(cue in normalized for cue in EXPOSURE_CUES):
        cue_bonus += 0.03
        contributors.append("cue:worker-exposure")

    risk = round(min(0.99, base + multi + min(0.15, cue_bonus)), 3)
    return {"risk_score": risk, "score_kind": SCORE_KIND, "contributors": contributors}