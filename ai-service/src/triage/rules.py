"""SIF precursor rule taxonomy (prototype/heuristic).

PROTOTYPE ONLY — "Prototype output for system integration testing; not a
production safety prediction model." These rules are an internal,
IOGP-inspired taxonomy for triage research. They are NOT official OIL
Life-Saving Rules: codes live in the ``SIF-PROTOTYPE-*`` namespace and must
never be presented as official OIL rule codes.

Taxonomy is versioned (TAXONOMY_VERSION) and data-driven: each rule lists
match phrases plus the evidence it contributes. Keep phrases specific;
generic single words ("work", "gas") are banned to avoid false positives.
"""

import re

TAXONOMY_VERSION = "sif-taxonomy-1.1.0"


def _compile(pattern):  # regexes run against original-case report text
    return re.compile(pattern, re.IGNORECASE)

RULES = [
    {
        "code": "SIF-PROTOTYPE-ENERGY-ISOLATION",
        "label": "Energy Isolation",
        "hazard_energy": "Electrical",
        "barriers": ["Isolation not applied", "Lockout/tagout not applied"],
        "severity_weight": 0.90,
        "critical": True,
        "phrases": [
            "without isolating",
            "without isolation",
            "isolating the electrical supply",
            "isolation",
            "lockout",
            "lock out",
            "tag out",
            "tagout",
            "de-energize",
            "deenergize",
            "live wire",
            "live cable",
            "electrical supply",
            "energized",
        ],
    },
    {
        "code": "SIF-PROTOTYPE-ELECTRICAL-EXPOSURE",
        "label": "Electrical Exposure",
        "hazard_energy": "Electrical",
        "barriers": ["Electrical safeguards defeated", "Insulation/cover missing"],
        "severity_weight": 0.85,
        "phrases": [
            "exposed wire",
            "exposed cable",
            "open panel",
            "opened panel",
            "electrical spark",
            "electric shock",
            "electrocution",
            "short circuit",
            "live electrical",
            "live conductor",
            "energized panel",
            "energised panel",
            "exposed conductor",
            "electrical hazard zone",
        ],
    },
    {
        "code": "SIF-PROTOTYPE-WORKING-AT-HEIGHT",
        "label": "Working at Height",
        "hazard_energy": "Gravity",
        "barriers": ["Fall protection not used", "Unprotected edge"],
        "severity_weight": 0.85,
        "phrases": [
            "working at height",
            "work at height",
            "without harness",
            "no harness",
            "scaffold",
            "unprotected edge",
            "open edge",
            "ladder",
            "nearly fell",
            "almost fell",
            "fell from",
        ],
    },
    {
        "code": "SIF-PROTOTYPE-LINE-OF-FIRE",
        "label": "Line of Fire",
        "hazard_energy": "Mechanical",
        "barriers": ["Exclusion zone not maintained", "Positioned in line of fire"],
        "severity_weight": 0.85,
        "phrases": [
            "line of fire",
            "stood under",
            "standing under",
            "under the load",
            "suspended load",
            "between the load",
            "struck by",
        ],
    },
    {
        "code": "SIF-PROTOTYPE-HOT-WORK",
        "label": "Hot Work",
        "hazard_energy": "Thermal",
        "barriers": ["Hot work permit missing", "Fire watch absent"],
        "severity_weight": 0.80,
        "phrases": [
            "hot work",
            "welding",
            "gas cutting",
            "grinding",
            "without permit",
            "no fire watch",
            "flammable",
        ],
    },
    {
        "code": "SIF-PROTOTYPE-CONFINED-SPACE",
        "label": "Confined Space",
        "hazard_energy": "Atmospheric",
        "barriers": ["Confined space permit missing", "Gas testing not done"],
        "severity_weight": 0.95,
        "phrases": [
            "confined space",
            "without gas test",
            "no gas test",
            "manhole",
            "vessel entry",
            "tank entry",
            "oxygen deficient",
        ],
    },
    {
        "code": "SIF-PROTOTYPE-BYPASSING-CONTROLS",
        "label": "Bypassing Controls",
        "hazard_energy": "Mechanical",
        "barriers": ["Safety interlock bypassed", "Guard removed"],
        "severity_weight": 0.80,
        "phrases": [
            "bypassed",
            "bypass",
            "interlock defeated",
            "guard removed",
            "safety device disabled",
            "defeated the interlock",
        ],
    },
    {
        "code": "SIF-PROTOTYPE-MECHANICAL-LIFTING",
        "label": "Mechanical Lifting",
        "hazard_energy": "Mechanical",
        "barriers": ["Exclusion zone not maintained", "Rigging controls missing"],
        "severity_weight": 0.80,
        "phrases": [
            "crane",
            "lifting",
            "rigging",
            "forklift carrying",
            "load swung",
            "load shifted",
            "overhead load",
        ],
    },
    {
        "code": "SIF-PROTOTYPE-DRIVING",
        "label": "Driving / Vehicle Exposure",
        "hazard_energy": "Mechanical",
        "barriers": ["Traffic control missing", "Spotter absent"],
        "severity_weight": 0.65,
        "phrases": [
            "reversing vehicle",
            "vehicle reversing",
            "forklift",
            "no spotter",
            "without spotter",
            "speeding",
            "seatbelt",
            "seat belt",
        ],
    },
    {
        "code": "SIF-PROTOTYPE-PRESSURE-RELEASE",
        "label": "Pressure / Line Breaking",
        "hazard_energy": "Pressure",
        "barriers": ["Line break permit missing", "Depressurisation not verified"],
        "severity_weight": 0.85,
        "phrases": [
            "line break",
            "breaking the line",
            "flange",
            "pressurized",
            "under pressure",
            "drain valve",
            "pressure release",
            "relief valve",
        ],
    },
    {
        "code": "SIF-PROTOTYPE-CHEMICAL-EXPOSURE",
        "label": "Chemical Exposure",
        "hazard_energy": "Chemical",
        "barriers": ["Chemical controls missing", "PPE not used"],
        "severity_weight": 0.75,
        "phrases": [
            "chemical spill",
            "chemical leak",
            "toxic",
            "corrosive",
            "without respirator",
            "no respirator",
            "fumes",
        ],
    },
    {
        "code": "SIF-PROTOTYPE-FIRE-EXPLOSION",
        "label": "Fire / Explosion Potential",
        "hazard_energy": "Thermal",
        "barriers": ["Ignition controls missing", "Fire prevention absent"],
        "severity_weight": 0.95,
        "phrases": [
            "fire broke out",
            "explosion",
            "blast",
            "ignition",
            "gas leak",
            "hydrocarbon release",
            "smoke and flame",
        ],
    },
]

BY_CODE = {rule["code"]: rule for rule in RULES}

# ---------------------------------------------------------------------------
# Deterministic evidence groups powering ENERGY-ISOLATION combination logic.
#
# The ENERGY-ISOLATION rule does NOT fire on a single keyword ("isolation",
# "lockout" alone cause false positives on properly-isolated work). It fires
# only when the report proves ISOLATION FAILURE combined with high-energy
# exposure and/or worker exposure (see screening.detect_isolation_evidence).
# All data here is static; every signal is grounded in the raw report text.
# ---------------------------------------------------------------------------

# Evidence that energy isolation / LOTO was NOT performed, NOT completed, or
# NOT verified before work started. Matched case-insensitively as substrings
# of the (whitespace-collapsed) normalized report text.
FAILURE_SUBSTRINGS = [
    # energy source / isolation not in place
    "not isolated",
    "not been isolated",
    "was not isolated",
    "were not isolated",
    "had not been isolated",
    "energy source was not isolated",
    "electrical energy was not isolated",
    "isolation was not completed",
    "isolation was not applied",
    "isolation was not verified",
    "isolating the electrical supply was not",
    # work performed without isolation
    "without isolating",
    "without isolation",
    "without energy isolation",
    "without any isolation",
    "without completing isolation",
    "without proper isolation",
    "without lockout",
    "without lock out",
    "without loto",
    "without tagout",
    "without tag out",
    "without applying lockout",
    "without completing lockout",
    "without closing out lockout",
    # isolation / lockout / tagout not completed, applied or verified
    "isolation not completed",
    "isolation not applied",
    "isolation not verified",
    "isolation not been completed",
    "isolation not been verified",
    "isolation not performed",
    "isolation had not been completed",
    "isolation had not been verified",
    "lockout not completed",
    "lockout not applied",
    "lockout not been completed",
    "lockout had not been completed",
    "lockout not verified",
    "lockout was not verified",
    "tagout not completed",
    "tagout not applied",
    "tag out not completed",
    "tag out not applied",
    "loto not completed",
    "loto not applied",
    "loto not performed",
    "isolation procedure not completed",
    "isolation procedure not verified",
    "isolation procedure had not been completed",
    "isolation procedure had not been verified",
    # generic non-completion tied to work start (must co-occur with an
    # isolation/lockout/energy concept via lockout_domain / energy / exposure)
    "started before it was isolated",
    "started before it had been isolated",
    "began before it was isolated",
    "work started before isolation",
    "maintenance started before isolation",
    "work before isolation",
    "before energy isolation",
    "before the electrical energy source was isolated",
    # source/equipment stayed live
    "remained energized",
    "remained energised",
    "remained live",
    "stayed energized",
    "stayed energised",
    "stayed live",
    "still energized",
    "still live",
    # no isolation at all
    "no energy isolation",
    "no isolation",
    "no lockout",
    "no loto",
    "no tagout",
    "no tag out",
    # explicit failure to isolate
    "failed to isolate",
    "failed to complete isolation",
    "failed to complete lockout",
    "isolation failed",
    "lockout failed",
    "isolation omitted",
    "lockout omitted",
    "skipped the isolation",
    "skipped the lockout",
]

# Generic non-completion / non-verification phrases. These only count as an
# isolation failure when LOTO/isolation vocabulary is present elsewhere in the
# report (they are too generic to carry the failure meaning on their own).
FAILURE_SUBSTRINGS_GENERIC = [
    "had not been completed or verified",
    "not been completed or verified",
    "not completed or verified",
    "had not been completed",
    "has not been completed",
    "was not completed",
    "not been completed",
    "not completed before",
    "not been completed before",
    "not completed and work",
    "procedure had not been completed",
    "procedure was not completed",
    "procedure not completed",
    "procedure not verified",
]

FAILURE_PATTERNS = [
    # Work/action commenced BEFORE isolation was verified in place (ordering).
    _compile(
        r"\b(started|start|began|begin|commenced|opened|open)\b[^.]{0,80}"
        r"\bbefore\b[^.]{0,120}\b(isolat\w*|de-?energi[sz]\w*)\b"
    ),
    # Isolation implied but negated before you could count on it.
    _compile(
        r"\bbefore\b[^.]{0,60}\b(isolation|lock.?out|loto|tag.?out)\b.{0,30}?"
        r"\b(not|never|failed|missing|absent)\b"
    ),
    # Isolation/lockout/tagout followed (within 5 words) by negated completion.
    _compile(
        r"\b(isolat\w*|lock\s?out\w*|tag\s?out\w*|loto)\s+(?:\w+\s+){0,5}"
        r"(was\s+|were\s+|had\s+|has\s+|is\s+)?not\s+(been\s+)?"
        r"(completed|applied|verified|performed|done|carried out|closed\s+out)"
    ),
    # Negation immediately before an isolation/LOTO concept.
    _compile(
        r"\b(not|never|without|lack of|absent)\s+(?:proper\s+|complete\s+|any\s+|"
        r"the\s+|a\s+|energy\s+|electrical\s+|power\s+)?"
        r"(isolat\w*|lock\s?out\w*|tag\s?out\w*|loto|de-?energi[sz]\w*)"
    ),
]

# High-energy exposure: hazardous energy present in or around the work zone.
ENERGY_PATTERN = _compile(
    r"\b(live\b|energized|energised|electrical\b|electric\b|pressure\b|"
    r"pressurized|pressurised|high\s+pressure|hydraulic\b|pneumatic\b|"
    r"steam\b|stored\s+energy|high\s+voltage|conductors\b|mains\b|"
    r"voltage\b|current\b|energized\b|energised\b|charged\b|live\s+parts|"
    r"energized\s+equipment|electrical\s+hazard)"
)

# Worker exposure: a person performing work inside the hazard zone.
EXPOSURE_PATTERN = _compile(
    r"\b(technician\w*|electrician\w*|worker\w*|operator\w*|contractor\w*|"
    r"crew\w*|fitter\w*|helper\w*|mechanic\w*|person\w*|employee\w*|"
    r"hands\b|fingers\b|hand\b|within\s+(?:the\s+)?\w+\s+zone|"
    r"inside\s+(?:the\s+)?panel|working\s+on|working\s+inside|"
    r"began\s+work|started\s+work|started\s+maintenance|"
    r"opened\s+(?:the\s+)?panel|opened\s+(?:the\s+)?\w+\s+panel|"
    r"exposed\s+.{0,40}\b(technician|worker|electrician|person)|"
    r"in\s+progress)"
)

# Isolation/LOTO vocabulary = the energy-control domain itself.
LOCKOUT_PATTERN = _compile(
    r"\b(isolat\w*|lock\s?out\w*|tag\s?out\w*|loto|de-?energi[sz]\w*)\b"
)

# ELECTRICAL-EXPOSURE combination: an electrical-energy concept co-occurring
# with a concrete exposure condition (no single "live electrical" keyword).
ELECTRICAL_CONCEPTS = _compile(
    r"\b(electrical\b|electric\b|conductor\w*|panel\b|switchgear\b|cable\w*|"
    r"wire\w*|live\b|energized|energised|voltage\b|current\b|mains\b|"
    r"circuit\b|power\b|substation\b|breaker\b|busbar\w*)\b"
)
ELECTRICAL_CONDITIONS = _compile(
    r"\b(expos\w*|bare\b|unprotected\b|uncovered\b|contact\w*|touch\w*|"
    r"within\b|inside\b|hazard\s+zone|hands\b|shock\w*|electrocution\b|"
    r"arc\w*|flash\b|open\s+panel|opened\s+panel|open\s+enclosure|"
    r"without\s+cover|missing\s+cover|guard\s+removed|insulation\w*|"
    r"burn\w*|blown\s+fuse|damaged\s+insulation)\b"
)
