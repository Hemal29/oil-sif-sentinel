"use strict";

// Step 3 tests: HSE review workflow (sqlite memory, test-only dialect).
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.JWT_SECRET = "review-test-secret";
process.env.SYNC_DB = "true";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("../../src/app");
const { sequelize, User, Report } = require("../../src/models");

let server;
let base;
let adminToken;
let reviewerToken;
let userToken;
let siteId;
const reportIds = {};

function req(method, path, { body, token } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, json: await r.json() }));
}

async function register(name, email) {
  const r = await req("POST", "/auth/register", {
    body: { name, email, password: "StrongPassword123" },
  });
  assert.equal(r.status, 201);
  return r.json.data.token;
}

async function makeReport(token, n) {
  const r = await req("POST", "/reports", {
    token,
    body: {
      reportNumber: `OIL-R-${n}`,
      date: "2026-09-20",
      siteId,
      activity: "Maintenance",
      reportType: "NEAR_MISS",
      description: `Test report number ${n} with enough text here.`,
    },
  });
  assert.equal(r.status, 201);
  return r.json.data.report.id;
}

before(async () => {
  await sequelize.sync({ force: true });
  server = app.listen(0);
  await new Promise((resolve) => server.on("listening", resolve));
  base = `http://localhost:${server.address().port}/api/v1`;

  userToken = await register("Normal User", "user@example.com");
  reviewerToken = await register("Reviewer", "reviewer@example.com");
  adminToken = await register("Admin", "admin@example.com");
  await User.update({ role: "HSE_REVIEWER" }, { where: { email: "reviewer@example.com" } });
  await User.update({ role: "HSE_ADMIN" }, { where: { email: "admin@example.com" } });
  // Re-login so JWTs carry the promoted roles.
  reviewerToken = (await req("POST", "/auth/login", { body: { email: "reviewer@example.com", password: "StrongPassword123" } })).json.data.token;
  adminToken = (await req("POST", "/auth/login", { body: { email: "admin@example.com", password: "StrongPassword123" } })).json.data.token;

  const site = await req("POST", "/sites", {
    token: adminToken,
    body: { name: "Test Site", code: "TST" },
  });
  siteId = site.json.data.site.id;

  reportIds.confirmed = await makeReport(adminToken, "001");
  reportIds.moreInfo = await makeReport(adminToken, "002");
  reportIds.rejected = await makeReport(adminToken, "003");
  reportIds.history = await makeReport(adminToken, "004");
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
});

describe("review auth", () => {
  it("401 without JWT", async () => {
    const r = await req("POST", "/reviews", {
      body: { reportId: reportIds.confirmed, hseDecision: "CONFIRMED" },
    });
    assert.equal(r.status, 401);
  });

  it("401 with invalid JWT", async () => {
    const r = await req("POST", "/reviews", {
      token: "bad.token.here",
      body: { reportId: reportIds.confirmed, hseDecision: "CONFIRMED" },
    });
    assert.equal(r.status, 401);
  });

  it("403 for USER role", async () => {
    const r = await req("POST", "/reviews", {
      token: userToken,
      body: { reportId: reportIds.confirmed, hseDecision: "CONFIRMED" },
    });
    assert.equal(r.status, 403);
  });
});

describe("review validation", () => {
  it("400 on missing reportId / decision", async () => {
    const a = await req("POST", "/reviews", { token: reviewerToken, body: { hseDecision: "CONFIRMED" } });
    assert.equal(a.status, 400);
    const b = await req("POST", "/reviews", { token: reviewerToken, body: { reportId: reportIds.confirmed } });
    assert.equal(b.status, 400);
  });

  it("400 on invalid decision and unknown fields", async () => {
    const a = await req("POST", "/reviews", {
      token: reviewerToken,
      body: { reportId: reportIds.confirmed, hseDecision: "MAYBE" },
    });
    assert.equal(a.status, 400);
    const b = await req("POST", "/reviews", {
      token: reviewerToken,
      body: { reportId: reportIds.confirmed, hseDecision: "CONFIRMED", reviewerId: "x" },
    });
    assert.equal(b.status, 400);
  });

  it("404 on unknown report, 400 on malformed UUID", async () => {
    const a = await req("POST", "/reviews", {
      token: reviewerToken,
      body: { reportId: "123e4567-e89b-42d3-a456-426614174000", hseDecision: "CONFIRMED" },
    });
    assert.equal(a.status, 404);
    const b = await req("POST", "/reviews", {
      token: reviewerToken,
      body: { reportId: "not-a-uuid", hseDecision: "CONFIRMED" },
    });
    assert.equal(b.status, 400);
  });
});

describe("review state machine", () => {
  it("NEW + CONFIRMED -> CLOSED, reviewer from JWT, aiPrediction NULL", async () => {
    const r = await req("POST", "/reviews", {
      token: reviewerToken,
      body: { reportId: reportIds.confirmed, hseDecision: "CONFIRMED", comment: "SIF precursor confirmed.", reasonCode: "VALID_PRECURSOR" },
    });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.reportStatus, "CLOSED");
    assert.equal(r.json.data.review.aiPrediction, null);
    const reviewer = await User.findOne({ where: { email: "reviewer@example.com" } });
    assert.equal(r.json.data.review.reviewerId, reviewer.id);
    const rep = await req("GET", `/reports/${reportIds.confirmed}`, { token: reviewerToken });
    assert.equal(rep.json.data.report.status, "CLOSED");
  });

  it("NEW + NEEDS_MORE_INFO -> UNDER_REVIEW", async () => {
    const r = await req("POST", "/reviews", {
      token: reviewerToken,
      body: { reportId: reportIds.moreInfo, hseDecision: "NEEDS_MORE_INFO", reasonCode: "INSUFFICIENT_INFORMATION" },
    });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.reportStatus, "UNDER_REVIEW");
  });

  it("UNDER_REVIEW + NEEDS_MORE_INFO stays UNDER_REVIEW", async () => {
    const r = await req("POST", "/reviews", {
      token: adminToken,
      body: { reportId: reportIds.moreInfo, hseDecision: "NEEDS_MORE_INFO" },
    });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.reportStatus, "UNDER_REVIEW");
  });

  it("NEW + REJECTED -> CLOSED (admin)", async () => {
    const r = await req("POST", "/reviews", {
      token: adminToken,
      body: { reportId: reportIds.rejected, hseDecision: "REJECTED", reasonCode: "FALSE_POSITIVE" },
    });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.reportStatus, "CLOSED");
  });

  it("preserves history then closes (NEEDS_MORE_INFO + CONFIRMED)", async () => {
    const first = await req("POST", "/reviews", {
      token: reviewerToken,
      body: { reportId: reportIds.history, hseDecision: "NEEDS_MORE_INFO" },
    });
    assert.equal(first.status, 201);
    const second = await req("POST", "/reviews", {
      token: adminToken,
      body: { reportId: reportIds.history, hseDecision: "CONFIRMED" },
    });
    assert.equal(second.status, 201);
    assert.equal(second.json.data.reportStatus, "CLOSED");
    const list = await req("GET", `/reviews?reportId=${reportIds.history}`, { token: reviewerToken });
    assert.equal(list.json.data.pagination.total, 2);
  });

  it("409 REVIEW_NOT_ALLOWED on CLOSED report, status unchanged", async () => {
    const r = await req("POST", "/reviews", {
      token: reviewerToken,
      body: { reportId: reportIds.confirmed, hseDecision: "REJECTED" },
    });
    assert.equal(r.status, 409);
    assert.equal(r.json.error.code, "REVIEW_NOT_ALLOWED");
    const count = await req("GET", `/reviews?reportId=${reportIds.confirmed}`, { token: reviewerToken });
    assert.equal(count.json.data.pagination.total, 1); // rolled back
  });
});

describe("review reads", () => {
  it("lists with pagination + filters", async () => {
    const r = await req("GET", "/reviews?page=1&limit=2&hseDecision=CONFIRMED", { token: reviewerToken });
    assert.equal(r.status, 200);
    assert.ok(r.json.data.pagination.total >= 2);
    assert.equal(r.json.data.items.length, 2);
  });

  it("returns review with report + reviewer (no passwordHash)", async () => {
    const list = await req("GET", `/reviews?reportId=${reportIds.history}`, { token: reviewerToken });
    const id = list.json.data.items[0].id;
    const r = await req("GET", `/reviews/${id}`, { token: reviewerToken });
    assert.equal(r.status, 200);
    assert.ok(r.json.data.review.report.reportNumber);
    assert.ok(r.json.data.review.report.site);
    assert.equal(r.json.data.review.reviewer.email, "admin@example.com");
    assert.ok(!("passwordHash" in r.json.data.review.reviewer));
  });

  it("pending returns UNDER_REVIEW reports with site info", async () => {
    const r = await req("GET", "/reviews/pending", { token: reviewerToken });
    assert.equal(r.status, 200);
    assert.ok(r.json.data.pagination.total >= 1);
    const item = r.json.data.items[0];
    assert.equal(item.status, "UNDER_REVIEW");
    assert.ok(item.reportNumber && item.site && "description" in item);
  });

  it("401 on reads without JWT, 404 on unknown review", async () => {
    assert.equal((await req("GET", "/reviews")).status, 401);
    const r = await req("GET", "/reviews/123e4567-e89b-42d3-a456-426614174000", { token: reviewerToken });
    assert.equal(r.status, 404);
  });
});
