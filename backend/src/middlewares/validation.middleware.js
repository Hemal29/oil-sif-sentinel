"use strict";

const { AppError } = require("../utils/errors");
const { z } = require("zod");

// Validate req[source] ("body" by default) against a Zod schema.
// On failure: 400 VALIDATION_ERROR. Strips unknown keys via schema .strict().
function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
      return next(
        new AppError(`Validation failed: ${details.map((d) => `${d.path || "body"}: ${d.message}`).join("; ")}`, 400, "VALIDATION_ERROR")
      );
    }
    req[source] = result.data;
    return next();
  };
}

module.exports = { validate, validateIdParam };

// Rejects malformed UUIDs in req.params.id with 400 (before any DB call).
const idParamSchema = z.object({ id: z.string().uuid("Invalid ID format") });

function validateIdParam(req, res, next) {
  const result = idParamSchema.safeParse({ id: req.params.id });
  if (!result.success) {
    return next(new AppError("Invalid ID format", 400, "VALIDATION_ERROR"));
  }
  return next();
}
