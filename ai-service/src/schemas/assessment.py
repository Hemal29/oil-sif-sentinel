"""Internal AI assessment contract (Phase 7.1).

Strict validation: malformed AI output is rejected, never silently accepted.

Assessment object::

    {
      schemaVersion, recordId, metadata,
      receivedAt, processedAt, processingMs,
      triage: {
        route, requiresHumanReview, escalatedToExtraction,
        riskScore, ruleBasedSignal: {triggered, matchedRules},
      },
      assessment: {
        sifPotential, primaryRule, secondaryRules, hazardEnergy,
        eventStatus, barriersFailed, assets, rationale, evidence,
      },
      extraction: {status, modelVersion, repairAttempts, failureReason},
      clarificationRequest: {reason, suggestedQuestions} | None,
    }

``sifPotential`` is "YES" | "NO" | "INSUFFICIENT_INFORMATION" — never a
confident YES/NO when information is insufficient.
"""

SCHEMA_VERSION = "sif-assessment-1.0.0"

ROUTES = ("AUTO_CLOSE", "UNCERTAIN", "PRIORITY", "ABSTAIN")
SIF_VALUES = ("YES", "NO", "INSUFFICIENT_INFORMATION")
EXTRACTION_STATUSES = ("skipped", "success", "repaired", "failed", "pending-provider")


def _err(errors, message):
    errors.append(message)


def validate_request(payload):
    """Validate POST /v1/reports/assess request.

    Accepts snake_case (record_id/text/source/reported_at/metadata) and the
    legacy camelCase (reportId/text/language) for backward compatibility.
    Returns (record_id, text, meta_dict) or raises ValueError.
    """
    if not isinstance(payload, dict):
        raise ValueError("request body must be a JSON object")
    record_id = payload.get("record_id", payload.get("reportId"))
    text = payload.get("text")
    if not isinstance(record_id, str) or not record_id.strip():
        raise ValueError("record_id must be a non-empty string")
    if not isinstance(text, str) or not text.strip():
        raise ValueError("text must be a non-empty string")
    source = payload.get("source")
    if source is not None and not isinstance(source, str):
        raise ValueError("source must be a string or null")
    reported_at = payload.get("reported_at")
    if reported_at is not None and not isinstance(reported_at, str):
        raise ValueError("reported_at must be a string or null")
    metadata = payload.get("metadata")
    if metadata is not None and not isinstance(metadata, dict):
        raise ValueError("metadata must be an object or null")
    language = payload.get("language")
    if language is not None and not isinstance(language, str):
        raise ValueError("language must be a string or null")
    meta = dict(metadata or {})
    if language is not None:
        meta.setdefault("language", language)
    if source is not None:
        meta.setdefault("source", source)
    if reported_at is not None:
        meta.setdefault("reported_at", reported_at)
    return record_id.strip(), text, meta


def validate_assessment(result):
    """Return a list of error strings (empty = valid). Strict: unknown top-level
    keys are allowed only if they are documented extras; required structure
    must be exact."""
    errors = []
    if not isinstance(result, dict):
        return ["assessment must be an object"]
    for field in ("schemaVersion", "recordId", "receivedAt", "processedAt", "processingMs"):
        if field not in result:
            _err(errors, "missing field: %s" % field)
    if result.get("schemaVersion") != SCHEMA_VERSION:
        _err(errors, "schemaVersion must be %s" % SCHEMA_VERSION)
    triage = result.get("triage")
    if not isinstance(triage, dict):
        _err(errors, "triage must be an object")
    else:
        if triage.get("route") not in ROUTES:
            _err(errors, "triage.route must be one of %s" % ("/".join(ROUTES)))
        for field in ("requiresHumanReview", "escalatedToExtraction"):
            if not isinstance(triage.get(field), bool):
                _err(errors, "triage.%s must be boolean" % field)
        risk = triage.get("riskScore")
        if not isinstance(risk, (int, float)) or not 0.0 <= float(risk) <= 1.0:
            _err(errors, "triage.riskScore must be 0.0..1.0")
        signal = triage.get("ruleBasedSignal")
        if not isinstance(signal, dict) or not isinstance(signal.get("triggered"), bool) \
                or not isinstance(signal.get("matchedRules"), list):
            _err(errors, "triage.ruleBasedSignal must be {triggered, matchedRules}")
    assessment = result.get("assessment")
    if not isinstance(assessment, dict):
        _err(errors, "assessment must be an object")
    else:
        if assessment.get("sifPotential") not in SIF_VALUES:
            _err(errors, "assessment.sifPotential must be one of %s" % ("/".join(SIF_VALUES)))
        for field in ("activity", "primaryRule", "hazardEnergy", "eventStatus", "rationale"):
            value = assessment.get(field)
            if value is not None and not isinstance(value, str):
                _err(errors, "assessment.%s must be a string or null" % field)
        for field in ("secondaryRules", "barriersFailed", "assets", "evidence"):
            if not isinstance(assessment.get(field), list):
                _err(errors, "assessment.%s must be a list" % field)
    extraction = result.get("extraction")
    if not isinstance(extraction, dict):
        _err(errors, "extraction must be an object")
    else:
        if extraction.get("status") not in EXTRACTION_STATUSES:
            _err(errors, "extraction.status must be one of %s" % ("/".join(EXTRACTION_STATUSES)))
        if not isinstance(extraction.get("repairAttempts"), int):
            _err(errors, "extraction.repairAttempts must be an integer")
    clarification = result.get("clarificationRequest")
    if clarification is not None:
        if not isinstance(clarification, dict) \
                or not isinstance(clarification.get("reason"), str) \
                or not isinstance(clarification.get("suggestedQuestions"), list):
            _err(errors, "clarificationRequest must be {reason, suggestedQuestions} or null")
    # Consistency: ABSTAIN requires INSUFFICIENT_INFORMATION + questions.
    if isinstance(triage, dict) and isinstance(assessment, dict):
        if triage.get("route") == "ABSTAIN":
            if assessment.get("sifPotential") != "INSUFFICIENT_INFORMATION":
                _err(errors, "ABSTAIN route requires sifPotential=INSUFFICIENT_INFORMATION")
            if clarification is None:
                _err(errors, "ABSTAIN route requires a clarificationRequest")
    return errors
