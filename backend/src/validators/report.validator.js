"use strict";

const { z } = require("zod");

const REPORT_TYPES = ["UNSAFE_ACT", "UNSAFE_CONDITION", "NEAR_MISS"];
const REPORT_STATUS = ["NEW", "ANALYZED", "UNDER_REVIEW", "CLOSED"];
const SORT_FIELDS = ["date", "createdAt", "reportNumber"];

const createReportSchema = z
  .object({
    reportNumber: z.string().trim().min(3, "Report number is required").max(50),
    date: z.coerce.date(),
    siteId: z.string().uuid("siteId must be a valid UUID"),
    location: z.string().trim().max(255).optional(),
    activity: z.string().trim().min(2, "Activity is required").max(150),
    reportType: z.enum(REPORT_TYPES),
    description: z
      .string()
      .trim()
      .min(10, "Description must be at least 10 characters")
      .max(20000, "Description is too long"),
    equipment: z.string().trim().max(255).optional(),
    language: z.string().trim().min(2).max(10).optional(),
    sourceFile: z.string().trim().max(255).optional(),
  })
  .strict();

// PATCH: only mutable, non-evidence fields. Immutable evidence fields are
// listed here so they pass .strict() and reach the service, which rejects
// them with 422 IMMUTABLE_FIELD (semantic validation, not a shape error).
const updateReportSchema = z
  .object({
    location: z.string().trim().max(255).optional(),
    activity: z.string().trim().min(2).max(150).optional(),
    equipment: z.string().trim().max(255).optional(),
    language: z.string().trim().min(2).max(10).optional(),
    sourceFile: z.string().trim().max(255).optional(),
    status: z.enum(REPORT_STATUS).optional(),
    description: z.unknown().optional(),
    reportNumber: z.unknown().optional(),
    siteId: z.unknown().optional(),
    date: z.unknown().optional(),
    createdBy: z.unknown().optional(),
    id: z.unknown().optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field is required" });

const IMMUTABLE_REPORT_FIELDS = ["description", "reportNumber", "siteId", "date", "createdBy", "id"];

const listReportsSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().max(200).optional(),
    site: z.string().trim().min(1).max(36).optional(),
    activity: z.string().trim().max(150).optional(),
    reportType: z.enum(REPORT_TYPES).optional(),
    status: z.enum(REPORT_STATUS).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z.enum(SORT_FIELDS).optional(),
    sortOrder: z.enum(["asc", "desc", "ASC", "DESC"]).optional(),
  })
  .strict();

module.exports = {
  createReportSchema,
  updateReportSchema,
  listReportsSchema,
  IMMUTABLE_REPORT_FIELDS,
  REPORT_TYPES,
  REPORT_STATUS,
};
