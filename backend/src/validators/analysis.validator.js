"use strict";

const { z } = require("zod");

// Internal shape of the Node -> Python request (never client-supplied text).
const aiRequestSchema = z
  .object({
    reportId: z.string().min(1),
    text: z.string().min(1),
    language: z.string().nullable(),
  })
  .strict();

// Node -> Python layered assessment request (Phase 7).
// record_id/text required; source/reported_at/metadata optional; strict.
const aiAssessRequestSchema = z
  .object({
    record_id: z.string().min(1),
    text: z.string().min(1),
    source: z.string().max(100).nullable().optional(),
    reported_at: z.string().max(50).nullable().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
  })
  .strict();

// Frozen Python -> Node contract. Strict: unknown dangerous fields are
// stripped before anything touches the database.
const aiResponseSchema = z
  .object({
    sifPotential: z.boolean(),
    confidence: z.number().min(0).max(1),
    activity: z.string().max(150).nullable(),
    hazard: z.string().max(255).nullable(),
    barrierFailure: z.string().max(255).nullable(),
    consequence: z.string().max(255).nullable(),
    lifeSavingRuleCode: z.string().max(50).nullable(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    evidence: z.array(z.string().max(2000)),
    extractedEntities: z
      .object({
        equipment: z.array(z.string().max(255)),
        hazards: z.array(z.string().max(255)),
        barriers: z.array(z.string().max(255)),
        activities: z.array(z.string().max(255)),
      })
      .strict(),
    modelName: z.string().min(1).max(100),
    modelVersion: z.string().min(1).max(50),
  })
  .strict();

// Phase 7 layered assessment response (sif-assessment-1.0.0). Strict shapes
// for triage/assessment/extraction; metadata is open (provider diagnostics).
const matchedRuleSchema = z
  .object({ code: z.string().max(100), phrase: z.string().max(500) })
  .strict();

const aiAssessResponseSchema = z
  .object({
    schemaVersion: z.literal("sif-assessment-1.0.0"),
    recordId: z.string().min(1),
    metadata: z.record(z.unknown()).nullable().optional(),
    receivedAt: z.string().min(1),
    processedAt: z.string().min(1),
    processingMs: z.number().int().min(0),
    triage: z
      .object({
        route: z.enum(["AUTO_CLOSE", "UNCERTAIN", "PRIORITY", "ABSTAIN"]),
        requiresHumanReview: z.boolean(),
        escalatedToExtraction: z.boolean(),
        riskScore: z.number().min(0).max(1),
        ruleBasedSignal: z
          .object({
            triggered: z.boolean(),
            matchedRules: z.array(matchedRuleSchema),
          })
          .strict(),
      })
      .strict(),
    assessment: z
      .object({
        sifPotential: z.enum(["YES", "NO", "INSUFFICIENT_INFORMATION"]),
        activity: z.string().max(150).nullable(),
        primaryRule: z.string().max(100).nullable(),
        secondaryRules: z.array(z.string().max(100)),
        hazardEnergy: z.string().max(100).nullable(),
        eventStatus: z.string().max(50),
        barriersFailed: z.array(z.string().max(255)),
        assets: z.array(z.string().max(255)),
        rationale: z.string().max(2000).nullable(),
        evidence: z.array(z.string().max(2000)),
      })
      .strict(),
    extraction: z
      .object({
        status: z.enum(["skipped", "success", "repaired", "failed", "pending-provider"]),
        modelVersion: z.string().max(100).nullable(),
        repairAttempts: z.number().int().min(0),
        failureReason: z.string().max(2000).nullable(),
      })
      .strict(),
    clarificationRequest: z
      .object({
        reason: z.string().max(1000),
        suggestedQuestions: z.array(z.string().max(500)).max(10),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.triage.route === "ABSTAIN") {
      if (v.assessment.sifPotential !== "INSUFFICIENT_INFORMATION") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ABSTAIN route requires sifPotential=INSUFFICIENT_INFORMATION",
        });
      }
      if (!v.clarificationRequest) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ABSTAIN route requires a clarificationRequest",
        });
      }
    }
  });

module.exports = {
  aiRequestSchema,
  aiAssessRequestSchema,
  aiResponseSchema,
  aiAssessResponseSchema,
};
