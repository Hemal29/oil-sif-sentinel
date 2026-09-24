"""Deterministic SIF-precursor fast lane for the deployed Colab service.

Stdlib-only reimplementation of the canonical ai-service rule engine that
speaks the Colab snake_case IOGP vocabulary. Guarantees an energy-isolation /
electrical-exposure SIF precursor is never AUTO_CLOSEd or downgraded to
NON-SIF by a low or noisy LLM score.

Contract (one of):
- energy_isolation: isolation/lockout failure COMBINED with energy,
  exposure, or lockout-domain context (never a single phrase alone).
- electrical_exposure: energized electrical work with worker proximity.
"""

import re
from typing import Dict, List

# --- isolation / lockout failure language -----------------------------------

ISOLATION_FAILURE_SUBSTRINGS = [
    "not isolated", "was not isolated", "were not isolated", "had not been isolated",
    "without isolation", "without energy isolation", "without proper isolation",
    "without lockout", "without lock out", "without loto", "without tagout",
    "without tag out", "without completing isolation", "without applying lockout",
    "without closing out lockout",
    "no isolation", "no lockout", "no loto", "no tagout",
    "isolation not completed", "isolation was not completed", "isolation not applied",
    "isolation not verified", "isolation had not been verified",
    "lockout not completed", "lockout not applied", "lockout was not completed",
    "lockout/tagout not completed", "loto not completed", "tagout not completed",
    "failed to isolate", "failed to complete isolation", "failed to complete lockout",
    "isolation failed", "lockout failed", "isolation omitted", "lockout omitted",
    "skipped the isolation", "skipped the lockout",
    "isolation procedure not completed", "isolation procedure not verified",
    "energy source was not isolated", "electrical energy was not isolated",
    "remained energized", "remained energised", "stayed live", "still live",
    "was not locked out", "had not been locked out",
]

# Generic non-completion: only counts as an isolation failure when
# isolation/lockout vocabulary appears elsewhere (lockout_domain).
GENERIC_FAILURE_SUBSTRINGS = [
    "had not been completed or verified", "not been completed or verified",
    "not completed or verified", "had not been completed", "has not been completed",
    "was not completed", "not been completed", "not completed before",
    "not been completed before", "not completed and work",
    "procedure had not been completed", "procedure was not completed",
]

ISOLATION_FAILURE_PATTERNS = [
    # action ... 'before' ... isolation/lockout
    re.compile(
        r"\b(started|start|began|begin|commenced|opened|open)\b"
        r"[^.]{0,80}\bbefore\b[^.]{0,120}"
        r"\b(isolat\w*|lock\s?out|loto|tag\s?out|de-?energi[sz]\w*)\b",
        re.I),
    # 'before' ... isolation/lockout ... negation
    re.compile(
        r"\bbefore\b[^.]{0,60}\b(isolat\w*|lock\s?out|loto|tag\s?out)\b"
        r"[^.]{0,30}?\b(not|never|failed|missing|absent)\b",
        re.I),
    # isolation/lockout followed (within 5 words) by negated completion
    re.compile(
        r"\b(isolat\w*|lock\s?out|loto|tag\s?out)\s+(?:\w+\s+){0,5}"
        r"(was\s+|were\s+|had\s+|has\s+|is\s+)?not\s+(been\s+)?"
        r"(completed|applied|verified|performed|done|carried out|closed\s+out)",
        re.I),
    # negation (optionally "properly/complete") directly before an isolation/LOTO
    re.compile(
        r"\b(not|never|without|lack of|absent)\s+"
        r"(?:proper\s+|properly\s+|complete\s+|any\s+|the\s+|a\s+|energy\s+|"
        r"electrical\s+|power\s+)?"
        r"(isolat\w*|lock\s?out|loto|tag\s?out|de-?energi[sz]\w*)",
        re.I),
]

# --- energy / exposure / lockout-domain context -----------------------------

ENERGY_PATTERN = re.compile(
    r"\b(electrical|electric|energised|energized|energy|voltage|live|hot|power|"
    r"pressurised|pressurized|high pressure|steam|gas)\b", re.I)

EXPOSURE_PATTERN = re.compile(
    r"\b(exposed|exposure|within the electrical hazard zone|electrical hazard zone|"
    r"danger zone|contact zone|reaching into)\b", re.I)

LOCKOUT_PATTERN = re.compile(r"\b(isolat\w*|lock\s?out|loto|tag\s?out)\b", re.I)

# --- electrical exposure -----------------------------------------------------

ELECTRICAL_CONCEPTS = ["electrical", "electric", "conductor", "panel", "energized panel", "energised panel", "wire", "cable"]
ELECTRICAL_CONDITIONS = ["live", "energized", "energised", "exposed", "open", "opened", "unfused", "hazard"]
ELECTRICAL_EXPOSURE_PHRASES = [
    "opened panel", "open panel", "live electrical", "live conductor", "live conductor",
    "energized panel", "energised panel", "exposed conductor", "electrical hazard zone",
    "live terminal", "energized conductor", "live cable",
]


def _contains_any(text: str, needles: List[str]) -> bool:
    low = text.lower()
    return any(n in low for n in needles)


def fastlane_screen(text: str) -> Dict:
    """Deterministic screen. Emits snake_case rule codes + critical flag."""
    matched = []

    # --- energy isolation: failure + (energy | exposure | lockout_domain) ---
    norm = text.lower()
    failure = False
    failure_phrase = None

    for phrase in ISOLATION_FAILURE_SUBSTRINGS:
        if phrase in norm:
            failure = True
            failure_phrase = phrase
            break
    if not failure:
        for pattern in ISOLATION_FAILURE_PATTERNS:
            match = pattern.search(text or "")
            if match:
                failure = True
                failure_phrase = match.group(0).strip()
                break
    if not failure and LOCKOUT_PATTERN.search(text or ""):
        for phrase in GENERIC_FAILURE_SUBSTRINGS:
            if phrase in norm:
                failure = True
                failure_phrase = phrase
                break

    if failure:
        energy = bool(ENERGY_PATTERN.search(text or ""))
        exposure = bool(EXPOSURE_PATTERN.search(text or ""))
        lockout_domain = bool(LOCKOUT_PATTERN.search(text or ""))
        if energy or exposure or lockout_domain:
            matched.append({
                "code": "energy_isolation",
                "phrase": failure_phrase,
                "critical": True,
            })

    # --- electrical exposure: concept AND condition (never a phrase alone) ---
    exposure_hit = False
    exposure_phrase = None
    for phrase in ELECTRICAL_EXPOSURE_PHRASES:
        if phrase in norm:
            exposure_hit = True
            exposure_phrase = phrase
            break
    if not exposure_hit and _contains_any(text, ELECTRICAL_CONCEPTS) and _contains_any(text, ELECTRICAL_CONDITIONS):
        exposures = [c for c in ELECTRICAL_CONDITIONS if c in norm]
        concepts = [c for c in ELECTRICAL_CONCEPTS if c in norm]
        exposure_hit = True
        exposure_phrase = "%s on %s" % (exposures[0] if exposures else "hazard", concepts[0] if concepts else "electrical")

    if exposure_hit:
        matched.append({
            "code": "electrical_exposure",
            "phrase": exposure_phrase,
            "critical": True,
        })

    codes = [m["code"] for m in matched]
    return {
        "triggered": bool(matched),
        "critical": any(m.get("critical") for m in matched),
        "signal": "STRONG" if any(m.get("critical") for m in matched) else ("MODERATE" if matched else "NONE"),
        "matched_rules": matched,
        "codes": codes,
    }