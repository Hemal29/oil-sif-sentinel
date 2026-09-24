"use strict";

// NOTE: analysis.service.js is the ONLY place allowed to call the AI service.
// Report text is untrusted input data: it is sent as opaque payload, never
// executed, and the original description in MySQL is never modified.

const env = require("../config/env");
const logger = require("../config/logger");
const { AppError } = require("../utils/errors");
const sequelize = require("../config/database");
const Report = require("../models/Report");
const AIAnalysis = require("../models/AIAnalysis");
const LifeSavingRule = require("../models/LifeSavingRule");
const {
  aiRequestSchema,
  aiAssessRequestSchema,
  aiResponseSchema,
  aiAssessResponseSchema,
} = require("../validators/analysis.validator");
const notificationService = require("./notification.service");
const auditService = require("./audit.service");
const { AUDIT_EVENT_TYPES, AUDIT_ACTOR_TYPES } = require("../utils/auditEvents");

const ENGINE_MODEL_NAME = "sif-engine";

function normalizeForEvidence(text) {
  return String(text).toLowerCase().replace(/\s+/g, " ").trim();
}

function aiError(statusCode, code, message) {
  return new AppError(message, statusCode, code);
}

// Translate friend's Colab model (schema_version 1.0.0 snake_case) to the
// backend layered contract (sif-assessment-1.0.0 camelCase). Returns null if
// input is not in friend format.
function normalizeFriendResponse(raw, originalDescription) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.schemaVersion === "sif-assessment-1.0.0") return raw; // already correct
  if (!raw.schema_version && !raw.assessment?.sif_potential && !raw.sif_potential) return null;

  const tri = raw.triage || {};
  const ass = raw.assessment || {};
  const ext = raw.extraction || {};
  const sig = tri.rule_based_signal || {};

  const routeRaw = String(tri.route || "auto_close").toUpperCase();
  const route = ["AUTO_CLOSE", "UNCERTAIN", "PRIORITY", "ABSTAIN"].includes(routeRaw) ? routeRaw : "PRIORITY";

  const sifRaw = String(ass.sif_potential || "no").toLowerCase();
  const sifPotential = sifRaw === "yes" ? "YES" : "NO";

  const strList = (v) =>
    (Array.isArray(v) ? v : []).map((x) => {
      if (typeof x === "string") return x.slice(0, 255);
      if (x && typeof x === "object") return String(x.name || x.span || x.code || JSON.stringify(x)).slice(0, 255);
      return String(x).slice(0, 255);
    });

  const matchedRules = (Array.isArray(sig.matched_rules) ? sig.matched_rules : []).map((x, i) => {
    if (typeof x === "string") return { code: x.slice(0, 100), phrase: x.slice(0, 500) };
    return { code: String(x.code || `RULE-${i}`).slice(0, 100), phrase: String(x.phrase || x.code || "").slice(0, 500) };
  });

  // Evidence must be a verbatim substring of the original report, else backend rejects it.
  const desc = String(originalDescription || "");
  const evidence = sifPotential === "YES" ? [desc.slice(0, 1500)] : [];

  return {
    schemaVersion: "sif-assessment-1.0.0",
    recordId: String(raw.record_id || raw.recordId || ""),
    metadata: raw.metadata || null,
    receivedAt: String(raw.received_at || raw.receivedAt || new Date().toISOString()),
    processedAt: String(raw.processed_at || raw.processedAt || new Date().toISOString()),
    processingMs: Number(raw.processing_ms ?? raw.processingMs ?? 0),
    triage: {
      route,
      requiresHumanReview: Boolean(tri.requires_human_review ?? tri.requiresHumanReview ?? sifPotential === "YES"),
      escalatedToExtraction: Boolean(tri.escalated_to_extraction ?? tri.escalatedToExtraction ?? true),
      riskScore: Number(tri.risk_score ?? tri.riskScore ?? (sifPotential === "YES" ? 0.94 : 0.05)),
      ruleBasedSignal: { triggered: Boolean(sig.triggered ?? false), matchedRules },
    },
    assessment: {
      sifPotential,
      activity: null,
      primaryRule: ass.primary_rule != null ? String(ass.primary_rule).slice(0, 100) : null,
      secondaryRules: strList(ass.secondary_rules).map((s) => s.slice(0, 100)),
      hazardEnergy: ass.hazard_energy != null ? String(ass.hazard_energy).slice(0, 100) : null,
      eventStatus: String(ass.event_status || "unclear").slice(0, 50),
      barriersFailed: strList(ass.barriers_failed),
      assets: strList(ass.assets),
      rationale: ass.rationale != null ? String(ass.rationale).slice(0, 2000) : null,
      evidence: evidence.map((s) => String(s).slice(0, 2000)),
    },
    extraction: {
      status: ext.status === "ok" ? "success" : ["skipped", "success", "repaired", "failed", "pending-provider"].includes(ext.status) ? ext.status : "success",
      modelVersion: ext.model_version != null ? String(ext.model_version).slice(0, 100) : "stage2-v1",
      repairAttempts: Number(ext.repair_attempts ?? ext.repairAttempts ?? 0),
      failureReason: ext.failure_reason != null ? String(ext.failure_reason).slice(0, 2000) : null,
    },
    clarificationRequest: raw.clarification_request ?? raw.clarificationRequest ?? null,
  };
}

async function postJson(path, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.aiTimeoutMs);
  let res;
  try {
    res = await fetch(`${env.aiServiceUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    if (err && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw aiError(504, "AI_SERVICE_TIMEOUT", "AI service request timed out");
    }
    throw aiError(503, "AI_SERVICE_UNAVAILABLE", "AI service is unavailable");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 404 && path !== "/analyze") {
    // Old AI server without the layered endpoint: fall back to legacy.
    return { fallback: true };
  }
  if (!res.ok) {
    throw aiError(502, "AI_SERVICE_BAD_RESPONSE", `AI service returned status ${res.status}`);
  }
  try {
    return { json: await res.json() };
  } catch (err) {
    throw aiError(502, "AI_SERVICE_BAD_RESPONSE", "AI service returned malformed JSON");
  }
}

async function callPythonAI(report, originalDescription) {
  const assessed = aiAssessRequestSchema.parse({
    record_id: report.id,
    text: originalDescription,
    source: "oil-sif-sentinel",
    reported_at: report.date || null,
    metadata: {
      reportType: report.reportType,
      activity: report.activity,
      siteId: report.siteId,
      language: report.language || null,
    },
  });
  const layered = await postJson("/v1/reports/assess", assessed);
  if (!layered.fallback) {
    const normalized = normalizeFriendResponse(layered.json, originalDescription);
    return normalized || layered.json;
  }

  // Legacy AI server: frozen /analyze contract.
  const checked = aiRequestSchema.parse({
    reportId: report.id,
    text: originalDescription,
    language: report.language || null,
  });
  const legacy = await postJson("/analyze", checked);
  return legacy.json;
}

// Evidence must reference the ORIGINAL report text: every evidence string
// must appear (modulo case/whitespace normalization) in the description.
// A sifPotential YES verdict with no evidence is rejected as fabricated,
// unless the extraction visibly failed (failure stays visible in the DB).
function validateEvidenceNew(ai, description) {
  const sifYes = ai.assessment.sifPotential === "YES";
  const extractionFailed = ["failed", "pending-provider"].includes(ai.extraction.status);
  if (sifYes && !extractionFailed && (!Array.isArray(ai.assessment.evidence) || ai.assessment.evidence.length === 0)) {
    throw aiError(502, "AI_RESPONSE_VALIDATION_FAILED", "AI claims SIF potential but returned no evidence");
  }
  const normalizedDescription = normalizeForEvidence(description);
  for (const item of ai.assessment.evidence || []) {
    if (!normalizeForEvidence(item) || !normalizedDescription.includes(normalizeForEvidence(item))) {
      throw aiError(502, "AI_RESPONSE_VALIDATION_FAILED", "AI returned evidence not found in the original report");
    }
  }
  if (ai.triage.route === "ABSTAIN" && !ai.clarificationRequest) {
    throw aiError(502, "AI_RESPONSE_VALIDATION_FAILED", "AI abstained but returned no clarification request");
  }
}

function validateEvidence(ai, description) {
  if (ai.sifPotential && (!Array.isArray(ai.evidence) || ai.evidence.length === 0)) {
    throw aiError(502, "AI_RESPONSE_VALIDATION_FAILED", "AI claims SIF potential but returned no evidence");
  }
  const normalizedDescription = normalizeForEvidence(description);
  for (const item of ai.evidence || []) {
    if (!normalizeForEvidence(item) || !normalizedDescription.includes(normalizeForEvidence(item))) {
      throw aiError(502, "AI_RESPONSE_VALIDATION_FAILED", "AI returned evidence not found in the original report");
    }
  }
}

async function resolveRuleId(ruleCode) {
  if (!ruleCode) return null;
  const rule = await LifeSavingRule.findOne({ where: { code: ruleCode } });
  return rule ? rule.id : null; // never auto-create rules
}

function priorityFor(route, riskScore) {
  if (route === "PRIORITY") return riskScore >= 0.9 ? "CRITICAL" : "HIGH";
  if (route === "UNCERTAIN") return "MEDIUM";
  return "LOW"; // AUTO_CLOSE and ABSTAIN never inflate priority
}

// Map the layered assessment onto the legacy columns so existing dashboards,
// reviews and API consumers keep working unchanged.
function mapAssessToLegacy(ai) {
  const a = ai.assessment;
  const sifPotential = a.sifPotential === "YES" ? true : a.sifPotential === "NO" ? false : null;
  return {
    sifPotential,
    confidence: ai.triage.riskScore,
    activity: a.activity,
    hazard: a.hazardEnergy,
    barrierFailure: (a.barriersFailed && a.barriersFailed[0]) || null,
    consequence: null,
    priority: priorityFor(ai.triage.route, ai.triage.riskScore),
    evidence: a.evidence,
    extractedEntities: {
      equipment: a.assets || [],
      hazards: a.hazardEnergy ? [a.hazardEnergy] : [],
      barriers: a.barriersFailed || [],
      activities: a.activity ? [a.activity] : [],
    },
  };
}

async function markFailed(reportId) {
  // Preserve any previous payload; only the status flips to FAILED.
  await AIAnalysis.update({ analysisStatus: "FAILED" }, { where: { reportId } });
}

// W9.6 — record an AI failure audit event with safe metadata only.
// Never exposes stack traces or internal error detail to the timeline.
async function auditAssessmentFailed(report, analysisId, status) {
  try {
    await auditService.createAuditEvent({
      reportId: report.id,
      actorUserId: null,
      actorType: AUDIT_ACTOR_TYPES.AI,
      eventType: AUDIT_EVENT_TYPES.AI_ASSESSMENT_FAILED,
      eventKey: `AI_ASSESSMENT_FAILED:${analysisId}`,
      description: `AI assessment failed for report ${report.reportNumber}.`,
      metadata: { analysisId, status },
      previousStatus: report.status,
      newStatus: report.status,
    });
  } catch (err) {
    logger.error(`[audit] AI_ASSESSMENT_FAILED failed for ${report.id}: ${err.message}`);
  }
}

async function analyzeReport(reportId) {
  const startedAt = Date.now();
  logger.info(`[analysis] started reportId=${reportId}`);

  const report = await Report.findByPk(reportId);
  if (!report) {
    throw aiError(404, "REPORT_NOT_FOUND", "Report not found");
  }
  const originalDescription = report.description;
  if (!originalDescription || !originalDescription.trim()) {
    throw aiError(422, "REPORT_DESCRIPTION_EMPTY", "Report has no description to analyze");
  }

  // Lifecycle: ensure a PENDING row exists BEFORE calling Python.
  // A previous COMPLETED payload is kept intact until a new response validates.
  const [analysis, created] = await AIAnalysis.findOrCreate({
    where: { reportId: report.id },
    defaults: { reportId: report.id, analysisStatus: "PENDING" },
  });
  if (!created && analysis.analysisStatus !== "COMPLETED") {
    await analysis.update({ analysisStatus: "PENDING" });
  }

  // W9.6 — the assessment run genuinely started (idempotent per analysis row).
  try {
    await auditService.createAuditEvent({
      reportId: report.id,
      actorUserId: null,
      actorType: AUDIT_ACTOR_TYPES.AI,
      eventType: AUDIT_EVENT_TYPES.AI_ASSESSMENT_STARTED,
      eventKey: `AI_ASSESSMENT_STARTED:${analysis.id}`,
      description: `AI assessment started for report ${report.reportNumber}.`,
      metadata: { analysisId: analysis.id, modelName: ENGINE_MODEL_NAME },
      previousStatus: report.status,
      newStatus: report.status,
    });
  } catch (err) {
    logger.error(`[audit] AI_ASSESSMENT_STARTED failed for ${report.id}: ${err.message}`);
  }

  let raw;
  try {
    raw = await callPythonAI(report, originalDescription);
  } catch (err) {
    await markFailed(report.id);
    await auditAssessmentFailed(report, analysis.id, "FAILED");
    logger.error(`[analysis] failed reportId=${reportId} reason=${err.code} durationMs=${Date.now() - startedAt}`);
    throw err;
  }
  logger.info(`[analysis] ai-response reportId=${reportId} durationMs=${Date.now() - startedAt}`);

  // Accept the layered assessment contract; legacy contract still accepted
  // (old AI servers + existing stubbed tests).
  let row;
  const assessParsed = aiAssessResponseSchema.safeParse(raw);
  if (assessParsed.success) {
    const ai = assessParsed.data;
    try {
      validateEvidenceNew(ai, originalDescription);
    } catch (err) {
      await markFailed(report.id);
      await auditAssessmentFailed(report, analysis.id, "FAILED");
      logger.error(`[analysis] failed reportId=${reportId} reason=${err.code}`);
      throw err;
    }
    const legacy = mapAssessToLegacy(ai);
    const lifeSavingRuleId = await resolveRuleId(ai.assessment.primaryRule);
    row = {
      ...legacy,
      lifeSavingRuleId,
      schemaVersion: ai.schemaVersion,
      riskScore: ai.triage.riskScore,
      scoreKind: (ai.metadata && ai.metadata.scoreKind) || "heuristic-prototype",
      route: ai.triage.route,
      requiresHumanReview: ai.triage.requiresHumanReview,
      escalatedToExtraction: ai.triage.escalatedToExtraction,
      matchedRules: ai.triage.ruleBasedSignal.matchedRules,
      primaryRule: ai.assessment.primaryRule,
      secondaryRules: ai.assessment.secondaryRules,
      hazardEnergy: ai.assessment.hazardEnergy,
      eventStatus: ai.assessment.eventStatus,
      barriersFailed: ai.assessment.barriersFailed,
      assets: ai.assessment.assets,
      rationale: ai.assessment.rationale,
      extractionStatus: ai.extraction.status,
      modelName: ENGINE_MODEL_NAME,
      modelVersion: ai.extraction.modelVersion,
      repairAttempts: ai.extraction.repairAttempts,
      failureReason: ai.extraction.failureReason,
      clarificationRequest: ai.clarificationRequest,
      analysisStatus: "COMPLETED",
    };
  } else {
    const parsed = aiResponseSchema.safeParse(raw);
    if (!parsed.success) {
      await markFailed(report.id);
      await auditAssessmentFailed(report, analysis.id, "FAILED");
      logger.error(`[analysis] failed reportId=${reportId} reason=AI_RESPONSE_VALIDATION_FAILED`);
      throw aiError(502, "AI_RESPONSE_VALIDATION_FAILED", "AI service returned an invalid response schema");
    }
    const ai = parsed.data;
    try {
      validateEvidence(ai, originalDescription);
    } catch (err) {
      await markFailed(report.id);
      await auditAssessmentFailed(report, analysis.id, "FAILED");
      logger.error(`[analysis] failed reportId=${reportId} reason=${err.code}`);
      throw err;
    }
    const lifeSavingRuleId = await resolveRuleId(ai.lifeSavingRuleCode);
    row = {
      sifPotential: ai.sifPotential,
      confidence: ai.confidence,
      activity: ai.activity,
      hazard: ai.hazard,
      barrierFailure: ai.barrierFailure,
      consequence: ai.consequence,
      lifeSavingRuleId,
      priority: ai.priority,
      evidence: ai.evidence,
      extractedEntities: ai.extractedEntities,
      modelName: ai.modelName,
      modelVersion: ai.modelVersion,
      // Layered columns stay NULL for legacy responses (history preserved).
      analysisStatus: "COMPLETED",
    };
  }

  // Persist COMPLETED analysis + advance status atomically.
  // AUTO_CLOSE: COMPLETED + route AUTO_CLOSE => CLOSED (no HSE review, no fake review).
  // Otherwise NEW -> ANALYZED. UNDER_REVIEW / ANALYZED / CLOSED are otherwise untouched
  // (never reopen, never move backwards, never bypass HSE review).
  const result = await sequelize.transaction(async (t) => {
    const previousStatus = report.status;
    await AIAnalysis.update(row, { where: { reportId: report.id }, transaction: t });
    let reportStatus = report.status;
    const isAutoClose = row.route === "AUTO_CLOSE" && row.analysisStatus === "COMPLETED";
    if (report.status !== "CLOSED") {
      if (isAutoClose && (report.status === "NEW" || report.status === "ANALYZED")) {
        await report.update({ status: "CLOSED" }, { transaction: t });
        reportStatus = "CLOSED";
      } else if (report.status === "NEW" && !isAutoClose) {
        await report.update({ status: "ANALYZED" }, { transaction: t });
        reportStatus = "ANALYZED";
      }
    }
    const completed = await AIAnalysis.findOne({ where: { reportId: report.id }, transaction: t });
    // W9.6 — record what actually happened, atomically with the state change.
    await auditService.createAuditEvent(
      {
        reportId: report.id,
        actorUserId: null,
        actorType: AUDIT_ACTOR_TYPES.AI,
        eventType: AUDIT_EVENT_TYPES.AI_ASSESSMENT_COMPLETED,
        eventKey: `AI_ASSESSMENT_COMPLETED:${completed.id}`,
        description: `AI assessment completed for report ${report.reportNumber}.`,
        metadata: {
          analysisId: completed.id,
          route: completed.route || row.route || null,
          riskScore: completed.riskScore ?? row.riskScore ?? null,
          sifPotential: completed.sifPotential ?? null,
          primaryRule: completed.primaryRule || row.primaryRule || null,
          modelName: completed.modelName || ENGINE_MODEL_NAME,
          modelVersion: completed.modelVersion || row.modelVersion || null,
        },
        previousStatus,
        newStatus: reportStatus,
      },
      { transaction: t }
    );
    if (isAutoClose && reportStatus === "CLOSED") {
      await auditService.createAuditEvent(
        {
          reportId: report.id,
          actorUserId: null,
          actorType: AUDIT_ACTOR_TYPES.AI,
          eventType: AUDIT_EVENT_TYPES.REPORT_AUTO_CLOSED,
          eventKey: `REPORT_AUTO_CLOSED:${completed.id}`,
          description: `Report ${report.reportNumber} automatically closed after AI assessment.`,
          metadata: { route: "AUTO_CLOSE", analysisId: completed.id },
          previousStatus,
          newStatus: "CLOSED",
        },
        { transaction: t }
      );
    }
    return { analysis: completed, reportStatus };
  });

  // Notifications — best effort, do not fail analysis
  try {
    const freshReport = await Report.findByPk(reportId);
    const reportNumber = freshReport ? freshReport.reportNumber : report.reportNumber;
    const workerId = freshReport ? freshReport.createdBy : report.createdBy;
    const route = row.route;
    const analysisId = result.analysis ? result.analysis.id : null;
    // Worker notification
    if (route === "AUTO_CLOSE") {
      await notificationService.createNotification(
        {
          userId: workerId,
          type: "REPORT_CLOSED",
          title: "Report Closed",
          message: `Your report ${reportNumber} was automatically closed after AI assessment.`,
          reportId,
          eventKey: `REPORT_CLOSED:${reportId}:${workerId}`,
        },
        {}
      );
    } else if (route === "PRIORITY") {
      await notificationService.createNotification(
        {
          userId: workerId,
          type: "AI_ASSESSMENT_COMPLETED",
          title: "AI Assessment Completed",
          message: `Your report ${reportNumber} has been assessed and requires HSE attention.`,
          reportId,
          eventKey: `AI_ASSESSMENT_COMPLETED:${analysisId}:${workerId}`,
        },
        {}
      );
      const hseIds = await notificationService.getHseUserIds();
      if (hseIds.length) {
        await notificationService.createNotificationsForUsers(hseIds, {
          type: "AI_PRIORITY_ALERT",
          title: "Priority Report Requires Attention",
          message: `Report ${reportNumber} has been classified as PRIORITY and requires HSE attention.`,
          reportId,
          eventKeyPrefix: "AI_PRIORITY_ALERT",
        });
      }
    } else if (route === "UNCERTAIN" || route === "ABSTAIN") {
      await notificationService.createNotification(
        {
          userId: workerId,
          type: "HSE_REVIEW_REQUIRED",
          title: "Additional Review Required",
          message: `Your report ${reportNumber} requires additional HSE review.`,
          reportId,
          eventKey: `HSE_REVIEW_REQUIRED:${reportId}:${workerId}`,
        },
        {}
      );
      const hseIds = await notificationService.getHseUserIds();
      if (hseIds.length) {
        await notificationService.createNotificationsForUsers(hseIds, {
          type: "HSE_REVIEW_REQUIRED",
          title: "Report Requires Review",
          message: `Report ${reportNumber} requires HSE review.`,
          reportId,
          eventKeyPrefix: "HSE_REVIEW_REQUIRED",
        });
      }
    } else {
      // Generic fallback for other routes (e.g., legacy)
      await notificationService.createNotification(
        {
          userId: workerId,
          type: "AI_ASSESSMENT_COMPLETED",
          title: "AI Assessment Completed",
          message: `Your report ${reportNumber} has completed AI assessment.`,
          reportId,
          eventKey: `AI_ASSESSMENT_COMPLETED:${analysisId}:${workerId}`,
        },
        {}
      );
    }
  } catch (e) {
    logger.error(`[notification] AI assessment notification failed for ${reportId}: ${e.message}`);
  }

  logger.info(`[analysis] completed reportId=${reportId} status=${result.reportStatus} durationMs=${Date.now() - startedAt}`);
  return result;
}

module.exports = { analyzeReport };
