"use strict";

const { z } = require("zod");

const HSE_DECISIONS = ["CONFIRMED", "REJECTED", "NEEDS_MORE_INFO"];

// Prototype reason codes only — NOT official OIL classifications.
const REASON_CODES = [
  "VALID_PRECURSOR",
  "FALSE_POSITIVE",
  "INSUFFICIENT_INFORMATION",
  "OTHER",
];

const createReviewSchema = z
  .object({
    reportId: z.string().uuid("reportId must be a valid UUID"),
    hseDecision: z.enum(HSE_DECISIONS),
    comment: z.string().trim().min(1).max(5000).optional(),
    reasonCode: z.enum(REASON_CODES).optional(),
    // NOTE: reviewerId / userId / createdBy are deliberately absent —
    // the reviewer always comes from the authenticated JWT.
  })
  .strict();

const listReviewsSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    reportId: z.string().uuid().optional(),
    reviewerId: z.string().uuid().optional(),
    hseDecision: z.enum(HSE_DECISIONS).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .strict();

const actionCenterQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().max(200).optional(),
    route: z.enum(["AUTO_CLOSE", "PRIORITY", "UNCERTAIN", "ABSTAIN"]).optional(),
    status: z.enum(["NEW", "ANALYZED", "UNDER_REVIEW", "NEEDS_MORE_INFO", "CONFIRMED", "REJECTED", "CLOSED"]).optional(),
    reportType: z.enum(["UNSAFE_ACT", "UNSAFE_CONDITION", "NEAR_MISS"]).optional(),
    siteId: z.string().uuid().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sifPotential: z.enum(["YES", "NO", "INSUFFICIENT"]).optional(),
  })
  .strict();

module.exports = {
  createReviewSchema,
  listReviewsSchema,
  actionCenterQuerySchema,
  HSE_DECISIONS,
  REASON_CODES,
};
