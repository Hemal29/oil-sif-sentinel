"""Regression tests: energy-isolation triage bug.

Covers the deterministic screening/rule/risk/router/reconcile fixes for
energy-isolation (LOTO) detection. Run: python3 -m unittest discover -s tests -v
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))

from inference.assess import assess_report  # noqa: E402
from triage.risk import score_risk  # noqa: E402
from triage.router import decide_route  # noqa: E402
from triage.screening import detect_isolation_evidence, screen  # noqa: E402

ENERGY_ISOLATION = "SIF-PROTOTYPE-ENERGY-ISOLATION"
ELECTRICAL_EXPOSURE = "SIF-PROTOTYPE-ELECTRICAL-EXPOSURE"

MAIN_REPORT = (
    "During electrical maintenance on Motor Control Panel MCP-12, a technician opened the panel and "
    "started work before the electrical energy source was isolated and locked out. Live electrical "
    "conductors were exposed, and the technician's hands were within the electrical hazard zone. The "
    "required lockout and energy isolation procedure had not been completed or verified before work "
    "started. The technician was exposed to potential electric shock and electrocution. No injury occurred."
)


class MainReportTest(unittest.TestCase):
    """The exact report from the bug report must produce the expected verdict."""

    def test_full_expected_contract(self):
        r = assess_report("energy-case", MAIN_REPORT, {})
        triage, assessment = r["triage"], r["assessment"]
        self.assertEqual(triage["route"], "PRIORITY")
        self.assertTrue(triage["requiresHumanReview"])
        self.assertTrue(triage["escalatedToExtraction"])
        self.assertGreaterEqual(triage["riskScore"], 0.75)
        self.assertTrue(triage["ruleBasedSignal"]["triggered"])
        codes = [m["code"] for m in triage["ruleBasedSignal"]["matchedRules"]]
        self.assertIn(ENERGY_ISOLATION, codes)
        self.assertEqual(assessment["sifPotential"], "YES")
        self.assertEqual(assessment["primaryRule"], ENERGY_ISOLATION)
        self.assertEqual(assessment["hazardEnergy"], "Electrical")
        self.assertIn("Isolation not applied", assessment["barriersFailed"])
        self.assertEqual(r["extraction"]["status"], "success")
        self.assertTrue(assessment["evidence"])
        self.assertIn("Isolation not applied", r["assessment"]["barriersFailed"])


class RegressionCasesTest(unittest.TestCase):
    def assertRoute(self, text, route, expected_primary=None, must_have_codes=None):
        r = assess_report("case", text, {})
        self.assertEqual(r["triage"]["route"], route, r["metadata"]["routeReason"])
        if expected_primary:
            self.assertEqual(r["assessment"]["primaryRule"], expected_primary)
        if must_have_codes:
            codes = [m["code"] for m in r["triage"]["ruleBasedSignal"]["matchedRules"]]
            for code in must_have_codes:
                self.assertIn(code, codes)
        return r

    def test_case1_started_before_isolation(self):
        r = self.assertRoute(
            "Technician started electrical work before energy isolation was completed.",
            "PRIORITY", ENERGY_ISOLATION, [ENERGY_ISOLATION])
        self.assertEqual(r["assessment"]["sifPotential"], "YES")
        self.assertTrue(r["triage"]["requiresHumanReview"])

    def test_case2_live_conductors_exposed_never_auto_close(self):
        r = self.assertRoute(
            "Live electrical conductors were exposed while technician was working inside the panel.",
            "PRIORITY", ELECTRICAL_EXPOSURE, [ELECTRICAL_EXPOSURE])
        self.assertEqual(r["assessment"]["sifPotential"], "YES")

    def test_case3_lockout_tagout_not_completed(self):
        self.assertRoute(
            "Lockout/tagout was not completed before maintenance began.",
            "PRIORITY", ENERGY_ISOLATION, [ENERGY_ISOLATION])

    def test_case4_energized_panel_without_isolation(self):
        self.assertRoute(
            "Technician opened energized panel without completing isolation.",
            "PRIORITY", ENERGY_ISOLATION, [ENERGY_ISOLATION])

    def test_case5_verified_isolation_is_not_a_failure(self):
        """False-positive guard: positive verification language must not be
        classified as an isolation failure."""
        r = self.assertRoute(
            "Electrical panel was inspected after proper isolation and lockout was verified.",
            "AUTO_CLOSE")
        self.assertEqual(r["assessment"]["sifPotential"], "NO")
        self.assertNotEqual(r["assessment"]["primaryRule"], ENERGY_ISOLATION)

    def test_benign_safe_paths_stay_auto_close(self):
        for text in (
            "Routine toolbox talk conducted, attendance recorded for the morning shift meeting.",
            "Electrical panel was inspected after proper isolation and lockout was verified.",
        ):
            r = assess_report("case", text, {})
            self.assertEqual(r["triage"]["route"], "AUTO_CLOSE", text)
            self.assertEqual(r["assessment"]["sifPotential"], "NO")


class CombinationDetectionTest(unittest.TestCase):
    """detect_isolation_evidence: robust patterns, no single-phrase reliance."""

    def assertFailure(self, text):
        ev = detect_isolation_evidence(text)
        self.assertTrue(
            ev["failure"],
            "expected isolation-FAILURE evidence in: %r" % text)

    def assertNoFailure(self, text):
        ev = detect_isolation_evidence(text)
        self.assertFalse(
            ev["failure"],
            "did NOT expect isolation-FAILURE evidence in: %r" % text)

    def test_equivalent_failure_language(self):
        phrases = [
            "energy source was not isolated",
            "electrical energy was not isolated",
            "isolation not completed",
            "isolation was not applied",
            "lockout not completed",
            "lockout was not applied",
            "lockout/tagout not completed",
            "LOTO not completed",
            "work started without isolation",
            "source remained energized",
            "equipment remained energized",
            "no energy isolation",
            "isolation procedure not completed",
            "isolation procedure not verified",
            "energy source was not isolated and locked out",
            "started work before the electrical energy source was isolated",
            "the isolation had not been completed or verified",
        ]
        for phrase in phrases:
            with self.subTest(phrase=phrase):
                self.assertFailure(phrase)

    def test_combination_requires_context(self):
        # A generic "not completed" without isolation/energy/exposure context
        # must not be read as an isolation failure.
        self.assertNoFailure("The floor cleaning was not completed before shift end.")
        # Positive verification must not be read as failure.
        self.assertNoFailure(
            "Electrical panel was inspected after proper isolation and lockout was verified.")
        self.assertNoFailure("Energy source was isolated and locked out before work started.")

    def test_two_word_isolation_failure_fires(self):
        self.assertFailure("Lockout not done.")
        self.assertFailure("No isolation.")

    def test_screen_refuses_bare_keywords(self):
        # "isolation" and "lockout" alone must not trigger ENERGY-ISOLATION.
        out = screen("The electrical panel is near the isolation area and the lockout board.")
        codes = [m["code"] for m in out["matchedRules"]]
        self.assertNotIn(ENERGY_ISOLATION, codes)


class DeterministicOverrideTest(unittest.TestCase):
    """A critical deterministic trigger must win over a low score."""

    def test_critical_override_forces_priority(self):
        # Even with a 0.05 risk score, a critical matched rule cannot be
        # AUTO_CLOSEd and routes PRIORITY straight after screening.
        screening = {
            "triggered": True,
            "critical": True,
            "signal": "STRONG",
            "matchedRules": [{"code": ENERGY_ISOLATION, "phrase": "without isolation", "critical": True}],
        }
        route, review, escalated, _ = decide_route(
            "Technician started electrical work before energy isolation was completed.",
            screening, 0.05)
        self.assertEqual(route, "PRIORITY")
        self.assertTrue(review)
        self.assertTrue(escalated)

    def test_critical_reconcile_promotes_low_assessment(self):
        # assess_report already routes critical cases to PRIORITY; ensure no
        # AUTO_CLOSE + NON-SIF can survive a critical signal through the
        # full pipeline.
        for text in (
            "Technician started electrical work before energy isolation was completed.",
            "Lockout/tagout was not completed before maintenance began.",
            "Technician opened energized panel without completing isolation.",
        ):
            r = assess_report("case", text, {})
            self.assertNotEqual(r["triage"]["route"], "AUTO_CLOSE", text)
            self.assertEqual(r["assessment"]["sifPotential"], "YES", text)


class RiskScoreTest(unittest.TestCase):
    def test_isolation_case_scores_high(self):
        for text in (
            MAIN_REPORT,
            "Technician started electrical work before energy isolation was completed.",
            "Lockout/tagout was not completed before maintenance began.",
        ):
            matched = screen(text)["matchedRules"]
            score = score_risk(text, matched)["risk_score"]
            self.assertGreaterEqual(score, 0.75, text)
            self.assertEqual(score_risk(text, matched)["score_kind"], "heuristic-prototype")

    def test_benign_case_scores_low(self):
        text = "Electrical panel was inspected after proper isolation and lockout was verified."
        matched = screen(text)["matchedRules"]
        self.assertLess(score_risk(text, matched)["risk_score"], 0.4)


if __name__ == "__main__":
    unittest.main()