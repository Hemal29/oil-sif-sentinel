"use strict";

const { z } = require("zod");

const REPORT_TYPES = ["UNSAFE_ACT", "UNSAFE_CONDITION", "NEAR_MISS"];
const REPORT_STATUS = ["NEW", "ANALYZED", "UNDER_REVIEW", "CLOSED"];

// Worker submission: reportNumber is generated server-side (WRK-...), and
// createdBy always comes from the JWT — neither is accepted from the client.
const workerCreateReportSchema = z
  .object({
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
  })
  .strict();

const workerListReportsSchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().max(200).optional(),
    site: z.string().trim().min(1).max(36).optional(),
    reportType: z.enum(REPORT_TYPES).optional(),
    status: z.enum(REPORT_STATUS).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    sortBy: z.enum(["date", "createdAt", "reportNumber"]).optional(),
    sortOrder: z.enum(["asc", "desc", "ASC", "DESC"]).optional(),
  })
  .strict();

const workerRegisterSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required (at least 2 characters)").max(100),
    employeeId: z.string().trim().min(2, "Employee ID is required").max(50),
    email: z.string().trim().toLowerCase().email("Invalid email format").max(255),
    mobile: z
      .string()
      .trim()
      .max(20)
      .optional()
      .refine((v) => !v || /^[0-9+\-\s]{7,20}$/.test(v), { message: "Invalid mobile number format" }),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
  })
  .strict();

const workerProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100).optional(),
    mobile: z
      .string()
      .trim()
      .max(20)
      .optional()
      .refine((v) => !v || /^[0-9+\-\s]{7,20}$/.test(v), { message: "Invalid mobile number format" }),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field is required" });

const workerPasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
    confirmPassword: z.string().min(1, "Confirm password is required").optional(),
  })
  .strict()
  .refine(
    (o) => !o.confirmPassword || o.newPassword === o.confirmPassword,
    { message: "Passwords do not match.", path: ["confirmPassword"] }
  );

const workerDraftCreateSchema = z
  .object({
    reportType: z.enum(REPORT_TYPES).optional(),
    siteId: z.string().uuid("siteId must be a valid UUID").optional(),
    activity: z.string().trim().min(2).max(150).optional(),
    equipment: z.string().trim().max(255).optional(),
    description: z.string().trim().max(20000).optional(),
    date: z.coerce.date().optional(),
    location: z.string().trim().max(255).optional(),
  })
  .strict();

const workerDraftUpdateSchema = z
  .object({
    reportType: z.enum(REPORT_TYPES).optional(),
    siteId: z.string().uuid("siteId must be a valid UUID").optional().nullable(),
    activity: z.string().trim().min(2).max(150).optional().nullable(),
    equipment: z.string().trim().max(255).optional().nullable(),
    description: z.string().trim().max(20000).optional().nullable(),
    date: z.coerce.date().optional().nullable(),
    location: z.string().trim().max(255).optional().nullable(),
  })
  .strict();

module.exports = { workerCreateReportSchema, workerListReportsSchema, workerRegisterSchema, workerProfileUpdateSchema, workerPasswordChangeSchema, workerDraftCreateSchema, workerDraftUpdateSchema };
