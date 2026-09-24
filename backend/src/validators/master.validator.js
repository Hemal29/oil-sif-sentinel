"use strict";

const { z } = require("zod");

const statusEnum = z.enum(["ACTIVE", "INACTIVE"]);

function masterSchemas() {
  const create = z
    .object({
      name: z.string().trim().min(2, "Name must be at least 2 characters").max(150),
      code: z.string().trim().min(2, "Code must be at least 2 characters").max(50),
      description: z.string().trim().max(5000).optional(),
      location: z.string().trim().max(255).optional(),
    })
    .strict();

  const update = z
    .object({
      name: z.string().trim().min(2).max(150).optional(),
      code: z.string().trim().min(2).max(50).optional(),
      description: z.string().trim().max(5000).optional(),
      location: z.string().trim().max(255).optional(),
      status: statusEnum.optional(),
    })
    .strict()
    .refine((o) => Object.keys(o).length > 0, { message: "At least one field is required" });

  return { create, update };
}

const siteSchemas = masterSchemas();
const activitySchemas = masterSchemas();

const ruleCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    code: z.string().trim().min(2).max(50),
    description: z.string().trim().max(5000).optional(),
    isPrototype: z.boolean().optional(),
  })
  .strict();

const ruleUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    code: z.string().trim().min(2).max(50).optional(),
    description: z.string().trim().max(5000).optional(),
    status: statusEnum.optional(),
    isPrototype: z.boolean().optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field is required" });

module.exports = {
  siteCreateSchema: siteSchemas.create,
  siteUpdateSchema: siteSchemas.update,
  activityCreateSchema: activitySchemas.create,
  activityUpdateSchema: activitySchemas.update,
  ruleCreateSchema,
  ruleUpdateSchema,
};
