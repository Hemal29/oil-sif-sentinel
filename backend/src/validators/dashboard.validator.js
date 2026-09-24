"use strict";

const { z } = require("zod");

const PRESETS = ["7d", "30d", "90d", "1y", "all"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const dashboardQuerySchema = z
  .object({
    preset: z.enum(PRESETS).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict()
  .superRefine((q, ctx) => {
    if ((q.dateFrom && !q.dateTo) || (!q.dateFrom && q.dateTo)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "dateFrom and dateTo must be provided together" });
    }
    for (const f of ["dateFrom", "dateTo"]) {
      if (q[f] && !isRealDate(q[f])) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${f} must be a valid date (YYYY-MM-DD)` });
      }
    }
    if (q.dateFrom && q.dateTo && isRealDate(q.dateFrom) && isRealDate(q.dateTo) && q.dateFrom > q.dateTo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "dateFrom must not be after dateTo" });
    }
  });

module.exports = { dashboardQuerySchema, PRESETS };
