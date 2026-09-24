"""Phase 7.14 — development/evaluation dataset for the SIF Precursor AI engine.

NOT production data and NOT dashboard data: 12 hand-written development
cases with expected behavior. Used by ``eval/run.py`` (deterministic
pass/fail per case) and mirrored by ``tests/test_assess.py``.

Expected-route semantics:
- PRIORITY  strong SIF precursor signal requiring HSE attention
- UNCERTAIN some signal but thin/ambiguous evidence
- AUTO_CLOSE clear low-risk report with sufficient information
- ABSTAIN   insufficient information to safely assess
"""

CASES = [
    {
        "id": "SIF-EVAL-01",
        "name": "clear SIF precursor (energy isolation)",
        "text": "Technician opened pump P-214B without isolating the electrical supply in the process area.",
        "expect": {"route": "PRIORITY", "sif": "YES", "primary": "SIF-PROTOTYPE-ENERGY-ISOLATION"},
    },
    {
        "id": "SIF-EVAL-02",
        "name": "clear non-SIF report",
        "text": "Routine toolbox talk conducted for the morning shift, attendance recorded and safety pledge read out.",
        "expect": {"route": "AUTO_CLOSE", "sif": "NO", "primary": None},
    },
    {
        "id": "SIF-EVAL-03",
        "name": "working at height without protection",
        "text": "Two workers were working at height on the scaffold platform without harness near the flare stack area.",
        "expect": {"route": "PRIORITY", "sif": "YES", "primary": "SIF-PROTOTYPE-WORKING-AT-HEIGHT"},
    },
    {
        "id": "SIF-EVAL-04",
        "name": "energy isolation failure",
        "text": "Electrician started maintenance on the live cable without lockout and tag out at substation 3.",
        "expect": {"route": "PRIORITY", "sif": "YES", "primary": "SIF-PROTOTYPE-ENERGY-ISOLATION"},
    },
    {
        "id": "SIF-EVAL-05",
        "name": "line of fire (suspended load)",
        "text": "Crane lifted a heavy load over the walkway while workers stood under the suspended load near unit 5.",
        "expect": {"route": "PRIORITY", "sif": "YES"},
    },
    {
        "id": "SIF-EVAL-06",
        "name": "hot work without permit",
        "text": "Welding work started near the storage tank without a permit and no fire watch, sparks falling on oily rags.",
        "expect": {"route": "PRIORITY", "sif": "YES", "primary": "SIF-PROTOTYPE-HOT-WORK"},
    },
    {
        "id": "SIF-EVAL-07",
        "name": "confined space without gas test",
        "text": "Entered vessel through manhole without gas test, attendant posted outside, cleaning completed and exited safely.",
        "expect": {"route": "PRIORITY", "sif": "YES", "primary": "SIF-PROTOTYPE-CONFINED-SPACE"},
    },
    {
        "id": "SIF-EVAL-08",
        "name": "bypassing controls",
        "text": "Operator bypassed the safety interlock on the compressor and restarted the machine with the guard removed.",
        "expect": {"route": "PRIORITY", "sif": "YES", "primary": "SIF-PROTOTYPE-BYPASSING-CONTROLS"},
    },
    {
        "id": "SIF-EVAL-09",
        "name": "insufficient information",
        "text": "Something unsafe was seen near the plant yesterday evening during rounds.",
        "expect": {"route": "ABSTAIN", "sif": "INSUFFICIENT_INFORMATION"},
    },
    {
        "id": "SIF-EVAL-10",
        "name": "ambiguous brief report",
        "text": "Worker nearly fell while doing maintenance.",
        "expect": {"route": "UNCERTAIN", "sif": "YES"},
    },
    {
        "id": "SIF-EVAL-11",
        "name": "multiple hazards",
        "text": "Grinding hot work was carried out on the scaffold at height without a permit while a crane lifted steel above workers standing under the load.",
        "expect": {"route": "PRIORITY", "sif": "YES", "min_rules": 2},
    },
    {
        "id": "SIF-EVAL-12",
        "name": "multiple failed barriers",
        "text": "Reversing forklift with no spotter struck the scaffold ladder while a worker without harness was working at height above the drive path.",
        "expect": {"route": "PRIORITY", "sif": "YES", "min_barriers": 2},
    },
    {
        "id": "SIF-EVAL-13",
        "name": "started work before energy isolation (exact bug report)",
        "text": "During electrical maintenance on Motor Control Panel MCP-12, a technician opened the panel and started work before the electrical energy source was isolated and locked out. Live electrical conductors were exposed, and the technician's hands were within the electrical hazard zone. The required lockout and energy isolation procedure had not been completed or verified before work started. The technician was exposed to potential electric shock and electrocution. No injury occurred.",
        "expect": {
            "route": "PRIORITY",
            "sif": "YES",
            "primary": "SIF-PROTOTYPE-ENERGY-ISOLATION",
            "not_primary": "SIF-PROTOTYPE-ELECTRICAL-EXPOSURE",
            "min_rules": 2,
        },
    },
    {
        "id": "SIF-EVAL-14",
        "name": "isolated+exposed panel work must not be auto-closed",
        "text": "Live electrical conductors were exposed while technician was working inside the panel.",
        "expect": {
            "route": "PRIORITY",
            "sif": "YES",
            "primary": "SIF-PROTOTYPE-ELECTRICAL-EXPOSURE",
            "not_primary": "SIF-PROTOTYPE-ENERGY-ISOLATION",
            "forbidden_routes": ["AUTO_CLOSE"],
        },
    },
    {
        "id": "SIF-EVAL-15",
        "name": "lockout/tagout not completed before maintenance",
        "text": "Lockout/tagout was not completed before maintenance began.",
        "expect": {
            "route": "PRIORITY",
            "sif": "YES",
            "primary": "SIF-PROTOTYPE-ENERGY-ISOLATION",
            "forbidden_routes": ["AUTO_CLOSE"],
        },
    },
    {
        "id": "SIF-EVAL-16",
        "name": "opened energized panel without completing isolation",
        "text": "Technician opened energized panel without completing isolation.",
        "expect": {
            "route": "PRIORITY",
            "sif": "YES",
            "primary": "SIF-PROTOTYPE-ENERGY-ISOLATION",
            "forbidden_routes": ["AUTO_CLOSE"],
        },
    },
    {
        "id": "SIF-EVAL-17",
        "name": "verified isolation is not an isolation failure",
        "text": "Electrical panel was inspected after proper isolation and lockout was verified.",
        "expect": {
            "route": "AUTO_CLOSE",
            "sif": "NO",
            "primary": None,
            "not_primary": "SIF-PROTOTYPE-ENERGY-ISOLATION",
        },
    },
]
