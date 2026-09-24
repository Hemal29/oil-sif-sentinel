"""Fast SIF screening: deterministic, explainable first pass.

Purpose: decide whether a report contains meaningful SIF precursor signals
before any scoring/extraction runs. Keyword + pattern matching only — no
randomness, no model calls. Returns ``triggered``, ``matchedRules``, a
``signal`` level (NONE / WEAK / STRONG) and a ``critical`` flag used by the
router to guarantee that a confirmed critical trigger (e.g. energy isolation
failure) can NEVER be suppressed by a low model/heuristic score.

ENERGY-ISOLATION does not fire on single keywords: "isolation"/"lockout"
alone produce false positives on correctly-isolated work. It fires only when
ISOLATION FAILURE evidence co-occurs with high-energy exposure and/or worker
exposure (combination logic — see ``detect_isolation_evidence``).
"""

from preprocessing.text import find_span, normalize
from triage.rules import (
    ELECTRICAL_CONDITIONS,
    ELECTRICAL_CONCEPTS,
    ENERGY_PATTERN,
    EXPOSURE_PATTERN,
    FAILURE_PATTERNS,
    FAILURE_SUBSTRINGS,
    FAILURE_SUBSTRINGS_GENERIC,
    LOCKOUT_PATTERN,
    RULES,
)

ENERGY_ISOLATION = "SIF-PROTOTYPE-ENERGY-ISOLATION"
ELECTRICAL_EXPOSURE = "SIF-PROTOTYPE-ELECTRICAL-EXPOSURE"

_BY_CODE = {rule["code"]: rule for rule in RULES}


def detect_isolation_evidence(text):
    """Combination evidence groups for the energy-isolation domain.

    Returns ``{failure, energy, exposure, lockout_domain, failure_spans}``.
    Every boolean is grounded in the report text; ``failure_spans`` holds the
    verbatim substrings that prove the isolation failure (used as evidence).
    """
    norm = normalize(text or "")
    failure = False
    failure_spans = []

    def _add_span(span):
        if span and span not in failure_spans:
            failure_spans.append(span)

    for phrase in FAILURE_SUBSTRINGS:
        if phrase in norm:
            failure = True
            _add_span(find_span(text, phrase))
    for pattern in FAILURE_PATTERNS:
        match = pattern.search(text or "")
        if match:
            failure = True
            _add_span(match.group(0).strip())

    energy = bool(ENERGY_PATTERN.search(text or ""))
    exposure = bool(EXPOSURE_PATTERN.search(text or ""))
    lockout_domain = bool(LOCKOUT_PATTERN.search(text or ""))

    # Generic "not completed / not verified" phrases only prove an isolation
    # failure when LOTO/isolation vocabulary appears in the report. This stops
    # "the electrical work was not completed" style false positives.
    if lockout_domain:
        for phrase in FAILURE_SUBSTRINGS_GENERIC:
            if phrase in norm:
                failure = True
                _add_span(find_span(text, phrase))

    return {
        "failure": failure,
        "energy": energy,
        "exposure": exposure,
        "lockout_domain": lockout_domain,
        "failure_spans": failure_spans,
    }


def _match_energy_isolation(text, hit_phrase):
    """Fires only when ISOLATION FAILURE combines with high-energy exposure
    and/or worker exposure, or with explicit LOTO vocabulary. Never on the
    bare words "isolation"/"lockout" alone."""

    ev = detect_isolation_evidence(text)
    if not ev["failure"]:
        return None
    if not (ev["energy"] or ev["exposure"] or ev["lockout_domain"]):
        return None
    phrase = (ev["failure_spans"][0] if ev["failure_spans"] else None) or hit_phrase
    return {"code": ENERGY_ISOLATION, "phrase": phrase, "critical": True}


def _match_electrical_exposure(text, hit_phrase):
    """Electrical-exposure rule: explicit phrases fire as before; otherwise
    an electrical-energy concept must co-occur with a concrete exposure
    condition (prevents "live electrical" false positives on safe, isolated
    statements)."""

    if hit_phrase:
        return {"code": ELECTRICAL_EXPOSURE, "phrase": hit_phrase}
    source = text or ""
    if ELECTRICAL_CONCEPTS.search(source) and ELECTRICAL_CONDITIONS.search(source):
        condition = ELECTRICAL_CONDITIONS.search(source).group(0)
        return {"code": ELECTRICAL_EXPOSURE, "phrase": condition}
    return None


def screen(text):
    """Screen report text. Returns dict(triggered, matchedRules, signal,
    critical)."""
    normalized = normalize(text or "")
    matched = []
    for rule in RULES:
        code = rule["code"]
        hit_phrase = next(
            (p for p in rule.get("phrases", []) if normalize(p) in normalized), None
        )
        if code == ENERGY_ISOLATION:
            match = _match_energy_isolation(text, hit_phrase)
        elif code == ELECTRICAL_EXPOSURE:
            match = _match_electrical_exposure(text, hit_phrase)
        else:
            match = None
            if hit_phrase:
                match = {"code": code, "phrase": hit_phrase}
            else:
                for pattern in rule.get("patterns", []):
                    found = pattern.search(text or "")
                    if found:
                        match = {"code": code, "phrase": found.group(0)}
                        break
        if match:
            matched.append(match)
            continue  # one hit per rule is enough

    if not matched:
        return {"triggered": False, "matchedRules": [], "signal": "NONE", "critical": False}

    critical = any(m.get("critical") for m in matched)
    strong = critical or any(
        _BY_CODE[m["code"]]["severity_weight"] >= 0.8 for m in matched
    )
    signal = "STRONG" if (strong or len(matched) >= 2) else "WEAK"
    return {
        "triggered": True,
        "matchedRules": matched,
        "signal": signal,
        "critical": critical,
    }