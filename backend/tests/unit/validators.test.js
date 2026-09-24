"use strict";

// Unit tests: Zod validators, pagination, error envelope. No DB required.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { registerSchema, loginSchema } = require("../../src/validators/auth.validator");
const {
  createReportSchema,
  updateReportSchema,
  listReportsSchema,
} = require("../../src/validators/report.validator");
const {
  siteCreateSchema,
  ruleCreateSchema,
} = require("../../src/validators/master.validator");
const { getPagination } = require("../../src/utils/pagination");
const { AppError } = require("../../src/utils/errors");

describe("auth validators", () => {
  it("accepts valid registration", () => {
    const r = registerSchema.safeParse({ name: "Hemal", email: "hemal@example.com", password: "StrongPassword123" });
    assert.equal(r.success, true);
  });
  it("rejects weak password", () => {
    const r = registerSchema.safeParse({ name: "Hemal", email: "hemal@example.com", password: "short" });
    assert.equal(r.success, false);
  });
  it("rejects invalid email", () => {
    const r = registerSchema.safeParse({ name: "Hemal", email: "nope", password: "StrongPassword123" });
    assert.equal(r.success, false);
  });
  it("rejects unknown fields", () => {
    const r = registerSchema.safeParse({ name: "Hemal", email: "h@e.com", password: "StrongPassword123", role: "HSE_ADMIN" });
    assert.equal(r.success, false);
  });
  it("accepts valid login", () => {
    assert.equal(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success, true);
  });
});

describe("report validators", () => {
  const base = {
    reportNumber: "OIL-2026-0001",
    date: "2026-09-20",
    siteId: "123e4567-e89b-42d3-a456-426614174000",
    activity: "Maintenance",
    reportType: "NEAR_MISS",
    description: "Technician opened the pump without isolating the supply.",
  };
  it("accepts a valid report", () => {
    assert.equal(createReportSchema.safeParse(base).success, true);
  });
  it("rejects missing description", () => {
    const { description, ...rest } = base;
    assert.equal(createReportSchema.safeParse(rest).success, false);
  });
  it("rejects invalid report type", () => {
    assert.equal(createReportSchema.safeParse({ ...base, reportType: "FIRE" }).success, false);
  });
  it("rejects non-UUID siteId", () => {
    assert.equal(createReportSchema.safeParse({ ...base, siteId: "nope" }).success, false);
  });
  it("rejects arbitrary unknown fields on create", () => {
    assert.equal(createReportSchema.safeParse({ ...base, hacker: 1 }).success, false);
  });
  it("allows description key on PATCH (service rejects with 422)", () => {
    const r = updateReportSchema.safeParse({ description: "x" });
    assert.equal(r.success, true);
  });
  it("accepts list query filters", () => {
    assert.equal(listReportsSchema.safeParse({ page: "2", reportType: "NEAR_MISS", sortOrder: "asc" }).success, true);
  });
});

describe("master validators", () => {
  it("accepts valid site", () => {
    assert.equal(siteCreateSchema.safeParse({ name: "Digboi", code: "DIG" }).success, true);
  });
  it("accepts valid rule with isPrototype", () => {
    assert.equal(ruleCreateSchema.safeParse({ name: "LOTO demo", code: "LOTO", isPrototype: true }).success, true);
  });
});

describe("pagination + errors", () => {
  it("paginates with defaults and caps", () => {
    assert.deepEqual(getPagination({}), { page: 1, limit: 20, skip: 0 });
    assert.deepEqual(getPagination({ page: "2", limit: "200" }), { page: 2, limit: 100, skip: 100 });
  });
  it("AppError carries code + status", () => {
    const e = new AppError("msg", 409, "DUPLICATE_CODE");
    assert.equal(e.statusCode, 409);
    assert.equal(e.code, "DUPLICATE_CODE");
  });
});
