"""SIF engine unit tests (stdlib unittest — no pytest needed).

Run:  python3 -m unittest discover -s tests -v
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))

from extraction.extractor import (  # noqa: E402
    FutureHostedModelProvider,
    LocalModelExtractionProvider,
    RuleBasedExtractionProvider,
    get_provider,
)
from extraction.repair import repair_extraction  # noqa: E402
from extraction.validator import validate_extraction  # noqa: E402
from inference.assess import assess_report  # noqa: E402
from inference.pipeline import run_prototype  # noqa: E402
from schemas.assessment import (  # noqa: E402
    SCHEMA_VERSION,
    validate_assessment,
    validate_request,
)
from schemas.contract import validate_request as validate_legacy  # noqa: E402
from triage.clarification import build_clarification  # noqa: E402
from triage.risk import score_risk  # noqa: E402
from triage.router import decide_route  # noqa: E402
from triage.rules import BY_CODE, RULES, TAXONOMY_VERSION  # noqa: E402
from triage.screening import screen  # noqa: E402

ENERGY_TEXT = "Technician opened pump P-214B without isolating the electrical supply in the process area."


class ContractTest(unittest.TestCase):
    def test_schema_version_constant(self):
        self.assertEqual(SCHEMA_VERSION, "sif-assessment-1.0.0")

    def test_request_accepts_new_shape(self):
        rid, text, meta = validate_request({"record_id": "r1", "text": "hello world report text"})
        self.assertEqual((rid, text, meta), ("r1", "hello world report text", {}))

    def test_request_accepts_legacy_shape(self):
        rid, text, meta = validate_request({"reportId": "r1", "text": "hello world report text", "language": "en"})
        self.assertEqual(rid, "r1")
        self.assertEqual(meta.get("language"), "en")

    def test_request_rejects_empty_text(self):
        with self.assertRaises(ValueError):
            validate_request({"record_id": "r1", "text": "   "})

    def test_request_rejects_non_object(self):
        with self.assertRaises(ValueError):
            validate_request(["x"])

    def test_assessment_self_validates(self):
        result = assess_report("r1", ENERGY_TEXT, {})
        self.assertEqual(validate_assessment(result), [])

    def test_assessment_rejects_bad_route(self):
        result = assess_report("r1", ENERGY_TEXT, {})
        result["triage"]["route"] = "MAYBE"
        self.assertTrue(validate_assessment(result))

    def test_assessment_rejects_abstain_without_questions(self):
        result = assess_report("r9", "ok", {})
        if result["triage"]["route"] == "ABSTAIN":
            result["clarificationRequest"] = None
            self.assertTrue(validate_assessment(result))


class ScreeningTest(unittest.TestCase):
    def test_detects_energy_concepts(self):
        out = screen(ENERGY_TEXT)
        self.assertTrue(out["triggered"])
        codes = [m["code"] for m in out["matchedRules"]]
        self.assertIn("SIF-PROTOTYPE-ENERGY-ISOLATION", codes)

    def test_no_signal_for_benign_text(self):
        out = screen("Routine toolbox talk conducted, attendance recorded for the morning shift meeting.")
        self.assertFalse(out["triggered"])
        self.assertEqual(out["matchedRules"], [])

    def test_deterministic(self):
        self.assertEqual(screen(ENERGY_TEXT), screen(ENERGY_TEXT))

    def test_covers_required_concept_families(self):
        probes = {
            "electrical exposure": "Found exposed wire with open panel near the switchgear room.",
            "height": "Workers working at height on scaffold without harness.",
            "line of fire": "Helper stood in the line of fire of the swinging pipe.",
            "hot work": "Grinding hot work started without permit near flammable storage.",
            "confined space": "Vessel entry through manhole without gas test.",
            "bypass": "Interlock defeated and guard removed on the compressor.",
            "lifting": "Crane lifting steel beams over the walkway.",
            "driving": "Reversing vehicle with no spotter at the gate.",
            "pressure": "Flange opened under pressure before drain valve isolation.",
            "chemical": "Chemical spill with toxic fumes near the sump.",
            "fire": "Hydrocarbon release with ignition and blast damage.",
        }
        for name, text in probes.items():
            with self.subTest(family=name):
                self.assertTrue(screen(text)["triggered"], name)


class RulesTest(unittest.TestCase):
    def test_versioned(self):
        self.assertTrue(TAXONOMY_VERSION.startswith("sif-taxonomy-"))

    def test_no_official_codes_claimed(self):
        for rule in RULES:
            self.assertTrue(rule["code"].startswith("SIF-PROTOTYPE-"), rule["code"])

    def test_lookup_consistent(self):
        for rule in RULES:
            self.assertIs(BY_CODE[rule["code"]], rule)


class RiskTest(unittest.TestCase):
    def test_bounded(self):
        for text in [ENERGY_TEXT, "nothing here at all benign", "ok"]:
            matched = screen(text)["matchedRules"]
            score = score_risk(text, matched)["risk_score"]
            self.assertGreaterEqual(score, 0.0)
            self.assertLessEqual(score, 1.0)

    def test_deterministic(self):
        matched = screen(ENERGY_TEXT)["matchedRules"]
        self.assertEqual(score_risk(ENERGY_TEXT, matched), score_risk(ENERGY_TEXT, matched))

    def test_labelled_heuristic(self):
        matched = screen(ENERGY_TEXT)["matchedRules"]
        self.assertEqual(score_risk(ENERGY_TEXT, matched)["score_kind"], "heuristic-prototype")

    def test_strong_signal_scores_high(self):
        matched = screen(ENERGY_TEXT)["matchedRules"]
        self.assertGreaterEqual(score_risk(ENERGY_TEXT, matched)["risk_score"], 0.75)


class RouterTest(unittest.TestCase):
    def route(self, text):
        screening = screen(text)
        matched = screening["matchedRules"]
        risk = score_risk(text, matched)["risk_score"]
        return decide_route(text, screening, risk)[0]

    def test_all_four_routes_reachable(self):
        routes = {
            self.route(ENERGY_TEXT),
            self.route("Routine toolbox talk conducted, attendance recorded for the morning shift meeting."),
            self.route("Worker nearly fell while doing maintenance."),
            self.route("ok"),
        }
        self.assertEqual(routes, {"PRIORITY", "AUTO_CLOSE", "UNCERTAIN", "ABSTAIN"})

    def test_priority_requires_human_review_and_escalation(self):
        screening = screen(ENERGY_TEXT)
        matched = screening["matchedRules"]
        risk = score_risk(ENERGY_TEXT, matched)["risk_score"]
        route, review, escalated, _ = decide_route(ENERGY_TEXT, screening, risk)
        self.assertEqual(route, "PRIORITY")
        self.assertTrue(review)
        self.assertTrue(escalated)

    def test_auto_close_needs_no_review(self):
        text = "Routine toolbox talk conducted, attendance recorded for the morning shift meeting."
        screening = screen(text)
        route, review, escalated, _ = decide_route(text, screening, 0.05)
        self.assertEqual(route, "AUTO_CLOSE")
        self.assertFalse(review)
        self.assertFalse(escalated)


class ExtractionTest(unittest.TestCase):
    def test_rule_based_grounds_evidence(self):
        matched = screen(ENERGY_TEXT)["matchedRules"]
        out = RuleBasedExtractionProvider().extract(ENERGY_TEXT, matched)
        self.assertTrue(out["evidence"])
        for span in out["evidence"]:
            self.assertIn(span.lower().replace("  ", " "), ENERGY_TEXT.lower())

    def test_rule_based_never_invents_assets(self):
        matched = screen("Worker nearly fell while doing maintenance.")["matchedRules"]
        out = RuleBasedExtractionProvider().extract("Worker nearly fell while doing maintenance.", matched)
        for asset in out["assets"]:
            self.assertIn(asset.lower(), "worker nearly fell while doing maintenance.")

    def test_empty_match_extracts_nothing(self):
        out = RuleBasedExtractionProvider().extract("Routine toolbox talk conducted.", [])
        self.assertIsNone(out["primary_rule"])
        self.assertEqual(out["evidence"], [])

    def test_pending_providers_raise_instead_of_faking(self):
        matched = screen(ENERGY_TEXT)["matchedRules"]
        with self.assertRaises(RuntimeError):
            LocalModelExtractionProvider().extract(ENERGY_TEXT, matched)
        with self.assertRaises(RuntimeError):
            FutureHostedModelProvider().extract(ENERGY_TEXT, matched)

    def test_unknown_provider_rejected(self):
        with self.assertRaises(ValueError):
            get_provider("gpt-99")


class ValidationRepairTest(unittest.TestCase):
    def test_validator_rejects_fabricated_evidence(self):
        matched = screen(ENERGY_TEXT)["matchedRules"]
        out = RuleBasedExtractionProvider().extract(ENERGY_TEXT, matched)
        out["evidence"] = ["invented phrase never written"]
        self.assertTrue(validate_extraction(out, ENERGY_TEXT))

    def test_repair_drops_fabrication(self):
        matched = screen(ENERGY_TEXT)["matchedRules"]
        out = RuleBasedExtractionProvider().extract(ENERGY_TEXT, matched)
        out["evidence"] = ["invented phrase never written"]
        repaired, attempts = repair_extraction(out, ENERGY_TEXT)
        self.assertEqual(validate_extraction(repaired, ENERGY_TEXT), [])
        self.assertGreaterEqual(attempts, 1)


class ClarificationTest(unittest.TestCase):
    def test_questions_for_height_hint(self):
        out = build_clarification("too brief", [{"code": "SIF-PROTOTYPE-WORKING-AT-HEIGHT", "phrase": "fell"}])
        self.assertTrue(out["suggestedQuestions"])
        self.assertTrue(any("height" in q.lower() for q in out["suggestedQuestions"]))

    def test_generic_questions_when_no_hint(self):
        out = build_clarification("insufficient information", [])
        self.assertEqual(len(out["suggestedQuestions"]), 4)


class PipelineTest(unittest.TestCase):
    def test_priority_assessment_shape(self):
        result = assess_report("r1", ENERGY_TEXT, {})
        self.assertEqual(result["triage"]["route"], "PRIORITY")
        self.assertEqual(result["assessment"]["sifPotential"], "YES")
        self.assertEqual(result["assessment"]["primaryRule"], "SIF-PROTOTYPE-ENERGY-ISOLATION")
        self.assertEqual(result["extraction"]["status"], "success")
        self.assertIsNone(result["clarificationRequest"])
        self.assertTrue(result["assessment"]["rationale"])

    def test_abstain_returns_questions(self):
        result = assess_report("r9", "ok", {})
        self.assertEqual(result["triage"]["route"], "ABSTAIN")
        self.assertEqual(result["assessment"]["sifPotential"], "INSUFFICIENT_INFORMATION")
        self.assertTrue(result["clarificationRequest"]["suggestedQuestions"])

    def test_processing_ms_present(self):
        result = assess_report("r1", ENERGY_TEXT, {})
        self.assertGreaterEqual(result["processingMs"], 0)

    def test_legacy_contract_still_valid(self):
        report_id, text, language = validate_legacy(
            {"reportId": "r1", "text": ENERGY_TEXT, "language": "en"})
        out = run_prototype(report_id, text, language)
        for key in ("sifPotential", "confidence", "activity", "hazard", "barrierFailure",
                    "consequence", "lifeSavingRuleCode", "priority", "evidence",
                    "extractedEntities", "modelName", "modelVersion"):
            self.assertIn(key, out)
        self.assertTrue(out["sifPotential"])
        self.assertTrue(out["evidence"])


if __name__ == "__main__":
    unittest.main()
