"""Deterministic eval runner: assesses every dataset case and checks the
expected behavior. Exit 0 only if all cases pass. Stdlib only.

Usage:  python3 eval/run.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dataset import CASES  # noqa: E402
from inference.assess import assess_report  # noqa: E402
from schemas.assessment import validate_assessment  # noqa: E402


def check(case):
    result = assess_report(case["id"], case["text"], {})
    failures = []
    expect = case["expect"]
    if result["triage"]["route"] != expect["route"]:
        failures.append("route: got %s want %s" % (result["triage"]["route"], expect["route"]))
    if result["assessment"]["sifPotential"] != expect["sif"]:
        failures.append("sif: got %s want %s" % (result["assessment"]["sifPotential"], expect["sif"]))
    if expect.get("primary") and result["assessment"]["primaryRule"] != expect["primary"]:
        failures.append("primary: got %s want %s" % (result["assessment"]["primaryRule"], expect["primary"]))
    if expect.get("not_primary") and result["assessment"]["primaryRule"] == expect["not_primary"]:
        failures.append("primary: got %s but must NOT be %s" % (result["assessment"]["primaryRule"], expect["not_primary"]))
    if expect.get("secondary_contains"):
        secondaries = result["assessment"]["secondaryRules"] or []
        if expect["secondary_contains"] not in secondaries:
            failures.append("secondaryRules: missing %s" % expect["secondary_contains"])
    if expect.get("forbidden_routes"):
        for route in expect["forbidden_routes"]:
            if result["triage"]["route"] == route:
                failures.append("route: %s is forbidden" % route)
    if expect.get("min_rules"):
        n = len(result["triage"]["ruleBasedSignal"]["matchedRules"])
        if n < expect["min_rules"]:
            failures.append("matchedRules: got %d want >= %d" % (n, expect["min_rules"]))
    if expect.get("min_barriers"):
        n = len(result["assessment"]["barriersFailed"])
        if n < expect["min_barriers"]:
            failures.append("barriersFailed: got %d want >= %d" % (n, expect["min_barriers"]))
    contract_errors = validate_assessment(result)
    if contract_errors:
        failures.append("contract: %s" % "; ".join(contract_errors))
    if expect["route"] == "ABSTAIN" and not result["clarificationRequest"]:
        failures.append("ABSTAIN without clarificationRequest")
    return failures


def main():
    passed = 0
    for case in CASES:
        failures = check(case)
        status = "PASS" if not failures else "FAIL"
        print("%s %s (%s)" % (status, case["id"], case["name"]))
        for failure in failures:
            print("      - %s" % failure)
        if not failures:
            passed += 1
    print("%d/%d eval cases passed" % (passed, len(CASES)))
    sys.exit(0 if passed == len(CASES) else 1)


if __name__ == "__main__":
    main()
