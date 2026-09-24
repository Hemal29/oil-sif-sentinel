"use strict";

const { z } = require("zod");

const statusEnum = z.enum(["ACTIVE", "INACTIVE"]);

const patternCreateSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(150),
    code: z.string().trim().min(2, "Code must be at least 2 characters").max(50),
    description: z.string().trim().max(5000).optional(),
    metadata: z.record(z.any()).optional(),
    status: statusEnum.optional(),
  })
  .strict();

const patternUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    code: z.string().trim().min(2).max(50).optional(),
    description: z.string().trim().max(5000).optional(),
    metadata: z.record(z.any()).optional(),
    status: statusEnum.optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field is required" });

module.exports = { patternCreateSchema, patternUpdateSchema };
