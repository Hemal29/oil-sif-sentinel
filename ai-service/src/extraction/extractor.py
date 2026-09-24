"""Generative extraction provider abstraction.

Pipeline
--------
RuleBasedExtractionProvider (local, deterministic, no API key) is the
development implementation. LocalModelExtractionProvider is a RESERVED
extension point for a real 7-8B-class model run locally later; it is NOT
implemented and raises a clear "pending" error instead of faking output.
FutureHostedModelProvider documents where a hosted model would plug in.

Safety rule: providers MUST NEVER invent facts. Every evidence string must
be an exact substring of the input text; every asset/barrier must be
grounded in matched rule phrases or explicit text spans.
"""

import re

from extraction.evidence import extract_evidence
from preprocessing.text import find_span, normalize
from triage.rules import BY_CODE

MODEL_VERSION_RULEBASED = "sif-engine-1.0.0+rulebased"
MODEL_VERSION_PENDING = "pending-7b-local"

EVENT_STATUS_CUES = {
    "NEAR_MISS": ["nearly", "almost", "near miss", "narrowly", "averted"],
    "UNSAFE_ACT": ["without", "bypassed", "bypass", "defeated", "removed guard", "no "],
    "UNSAFE_CONDITION": ["exposed", "open ", "damaged", "leaking", "corroded", "blocked"],
}

ASSET_PATTERN = re.compile(
    r"\b([A-Z]{1,4}[- ]?\d{2,5}[A-Z]?|pump|valve|crane|forklift|scaffold|ladder|"
    r"transformer|compressor|turbine|vessel|tank|pipeline|panel|switchgear)\b",
    re.IGNORECASE,
)


class ExtractionProvider:
    name = "base"

    def extract(self, text, matched_rules):
        raise NotImplementedError


class RuleBasedExtractionProvider(ExtractionProvider):
    """Deterministic local provider: derives fields only from matched rules
    and verbatim text spans. Safe development default (no API key)."""

    name = "rule-based"

    def extract(self, text, matched_rules):
        if not matched_rules:
            return {
                "activity": None,
                "primary_rule": None,
                "secondary_rules": [],
                "hazard_energy": None,
                "event_status": "UNKNOWN",
                "barriers_failed": [],
                "assets": [],
                "evidence": [],
                "rationale": "No SIF precursor signal matched; no extraction performed.",
            }
        rules = [BY_CODE[m["code"]] for m in matched_rules]
        primary = max(rules, key=lambda r: r["severity_weight"])
        secondary = sorted({r["code"] for r in rules if r["code"] != primary["code"]})
        energies = [r["hazard_energy"] for r in rules if r["hazard_energy"]]
        hazard_energy = primary["hazard_energy"] or (energies[0] if energies else None)
        barriers = []
        for rule in rules:
            for barrier in rule["barriers"]:
                if barrier not in barriers:
                    barriers.append(barrier)
        evidence = extract_evidence(
            text, [(rule, m["phrase"]) for rule in rules for m in matched_rules if m["code"] == rule["code"]]
        )
        return {
            "activity": _infer_activity(text, primary),
            "primary_rule": primary["code"],
            "secondary_rules": secondary,
            "hazard_energy": hazard_energy,
            "event_status": _infer_event_status(text),
            "barriers_failed": barriers,
            "assets": _infer_assets(text),
            "evidence": evidence,
            "rationale": _rationale(primary, matched_rules, evidence),
        }


class LocalModelExtractionProvider(ExtractionProvider):
    """RESERVED: real 7-8B-class local model. Pending integration — attempting
    to use it raises instead of returning faked generative output."""

    name = "local-7b"

    def extract(self, text, matched_rules):  # pragma: no cover
        raise RuntimeError(
            "LocalModelExtractionProvider is pending: no 7-8B model weights are "
            "installed in this environment. Install a local model and implement "
            "this provider; the pipeline will keep using RuleBased until then."
        )


class FutureHostedModelProvider(ExtractionProvider):
    """RESERVED: future hosted-model provider (requires API key + approval).
    Not wired; raises instead of faking output."""

    name = "hosted"

    def extract(self, text, matched_rules):  # pragma: no cover
        raise RuntimeError(
            "FutureHostedModelProvider is not configured: no external model "
            "dependency is added by design. Configure credentials and implement "
            "this provider when approved."
        )


def _infer_activity(text, primary_rule):
    normalized = normalize(text or "")
    for cue in ("maintenance", "lifting", "welding", "driving", "cleaning",
                "inspection", "commissioning", "shutdown", "startup", "entry"):
        if cue in normalized:
            return cue.capitalize() if cue != "entry" else "Confined Space Entry"
    labels = {
        "SIF-PROTOTYPE-WORKING-AT-HEIGHT": "Work at Height",
        "SIF-PROTOTYPE-CONFINED-SPACE": "Confined Space Entry",
        "SIF-PROTOTYPE-MECHANICAL-LIFTING": "Lifting Operations",
        "SIF-PROTOTYPE-HOT-WORK": "Hot Work",
        "SIF-PROTOTYPE-DRIVING": "Vehicle Movement",
        "SIF-PROTOTYPE-PRESSURE-RELEASE": "Line Breaking",
    }
    return labels.get(primary_rule["code"], "Operations")


def _infer_event_status(text):
    normalized = normalize(text or "")
    scores = {}
    for status, cues in EVENT_STATUS_CUES.items():
        scores[status] = sum(1 for cue in cues if cue in normalized)
    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] > 0 else "UNKNOWN"


def _infer_assets(text):
    """Assets grounded ONLY in explicit text spans (no invention)."""
    assets = []
    for match in ASSET_PATTERN.finditer(text or ""):
        span = match.group(0).strip()
        if span and span not in assets:
            assets.append(span)
        if len(assets) >= 10:
            break
    return assets


def _rationale(primary, matched_rules, evidence):
    phrases = sorted({m["phrase"] for m in matched_rules})
    ev = "; ".join('"%s"' % e for e in evidence[:3]) or "no verbatim span"
    return (
        "Matched rule %s (%s) via phrase(s) %s; verbatim evidence: %s. "
        "Heuristic prototype triage — HSE review remains authoritative."
        % (primary["code"], primary["label"], ", ".join('"%s"' % p for p in phrases[:4]), ev)
    )


def get_provider(name="rule-based"):
    providers = {
        "rule-based": RuleBasedExtractionProvider(),
        "local-7b": LocalModelExtractionProvider(),
        "hosted": FutureHostedModelProvider(),
    }
    if name not in providers:
        raise ValueError("unknown extraction provider: %s" % name)
    return providers[name]
