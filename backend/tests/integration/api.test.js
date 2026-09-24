"use strict";

// Integration tests: full HTTP flow against in-memory SQLite.
// Real environments use MySQL; sqlite here is test-only (DB_DIALECT=sqlite).
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.JWT_SECRET = "integration-test-secret";
process.env.SYNC_DB = "true";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("../../src/app");
const { sequelize, User } = require("../../src/models");

const SITE_ID = { value: null };
const REPORT_ID = { value: null };
let server;
let base;
let userToken;
let adminToken;

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

before(async () => {
  await sequelize.sync({ force: true });
  server = app.listen(0);
  await new Promise((resolve) => server.on("listening", resolve));
  base = `http://localhost:${server.address().port}/api/v1`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
});

describe("health", () => {
  it("GET /health is public", async () => {
    const r = await req("GET", "/health");
    assert.equal(r.status, 200);
    assert.equal(r.json.success, true);
  });
});

describe("auth", () => {
  it("registers successfully without passwordHash", async () => {
    const r = await req("POST", "/auth/register", {
      body: { name: "Hemal", email: "hemal@example.com", password: "StrongPassword123" },
    });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.user.email, "hemal@example.com");
    assert.equal(r.json.data.user.role, "USER");
    assert.ok(!("passwordHash" in r.json.data.user));
    assert.ok(r.json.data.token);
    userToken = r.json.data.token;
  });

  it("rejects duplicate email with 409", async () => {
    const r = await req("POST", "/auth/register", {
      body: { name: "Hemal", email: "hemal@example.com", password: "StrongPassword123" },
    });
    assert.equal(r.status, 409);
    assert.equal(r.json.error.code, "DUPLICATE_EMAIL");
  });

  it("rejects weak password with 400", async () => {
    const r = await req("POST", "/auth/register", {
      body: { name: "Hemal", email: "weak@example.com", password: "short" },
    });
    assert.equal(r.status, 400);
    assert.equal(r.json.error.code, "VALIDATION_ERROR");
  });

  it("logs in successfully", async () => {
    const r = await req("POST", "/auth/login", {
      body: { email: "hemal@example.com", password: "StrongPassword123" },
    });
    assert.equal(r.status, 200);
    assert.ok(r.json.data.token);
  });

  it("rejects wrong password with 401", async () => {
    const r = await req("POST", "/auth/login", {
      body: { email: "hemal@example.com", password: "WrongPass123" },
    });
    assert.equal(r.status, 401);
  });

  it("returns current user on /me", async () => {
    const r = await req("GET", "/auth/me", { token: userToken });
    assert.equal(r.status, 200);
    assert.ok(!("passwordHash" in r.json.data.user));
  });

  it("rejects missing/invalid JWT with 401", async () => {
    const a = await req("GET", "/auth/me");
    assert.equal(a.status, 401);
    const b = await req("GET", "/auth/me", { token: "bad.token.here" });
    assert.equal(b.status, 401);
  });

  it("rejects inactive user", async () => {
    await User.update({ status: "INACTIVE" }, { where: { email: "hemal@example.com" } });
    const login = await req("POST", "/auth/login", {
      body: { email: "hemal@example.com", password: "StrongPassword123" },
    });
    assert.equal(login.status, 403);
    assert.equal(login.json.error.code, "INACTIVE_USER");
    const me = await req("GET", "/auth/me", { token: userToken });
    assert.equal(me.status, 403);
    await User.update({ status: "ACTIVE" }, { where: { email: "hemal@example.com" } });
  });
});

describe("master data", () => {
  it("forbids site creation for normal users (403)", async () => {
    const r = await req("POST", "/sites", {
      token: userToken,
      body: { name: "Digboi", code: "DIG" },
    });
    assert.equal(r.status, 403);
  });

  it("creates/lists/gets/updates site as admin", async () => {
    await User.update({ role: "HSE_ADMIN" }, { where: { email: "hemal@example.com" } });
    const login = await req("POST", "/auth/login", {
      body: { email: "hemal@example.com", password: "StrongPassword123" },
    });
    adminToken = login.json.data.token;

    const created = await req("POST", "/sites", {
      token: adminToken,
      body: { name: "Digboi Refinery", code: "DIG", location: "Assam" },
    });
    assert.equal(created.status, 201);
    SITE_ID.value = created.json.data.site.id;

    const dup = await req("POST", "/sites", {
      token: adminToken,
      body: { name: "Dup", code: "DIG" },
    });
    assert.equal(dup.status, 409);

    const list = await req("GET", "/sites", { token: adminToken });
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.json.data.items));
    assert.equal(list.json.data.pagination.total, 1);

    const one = await req("GET", `/sites/${SITE_ID.value}`, { token: adminToken });
    assert.equal(one.status, 200);

    const badId = await req("GET", "/sites/not-a-uuid", { token: adminToken });
    assert.equal(badId.status, 400);

    const missing = await req("GET", "/sites/123e4567-e89b-42d3-a456-426614174000", { token: adminToken });
    assert.equal(missing.status, 404);

    const patched = await req("PATCH", `/sites/${SITE_ID.value}`, {
      token: adminToken,
      body: { location: "Assam, India" },
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.json.data.site.location, "Assam, India");
  });

  it("creates activity and rule as admin", async () => {
    const a = await req("POST", "/activities", {
      token: adminToken,
      body: { name: "Maintenance", code: "MAINT" },
    });
    assert.equal(a.status, 201);
    const r = await req("POST", "/rules", {
      token: adminToken,
      body: { name: "Energy Isolation Demo", code: "LOTO-DEMO" },
    });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.rule.isPrototype, true);
  });
});

describe("reports", () => {
  const payload = () => ({
    reportNumber: "OIL-2026-0001",
    date: "2026-09-20",
    siteId: SITE_ID.value,
    location: "Process Area",
    activity: "Maintenance",
    reportType: "NEAR_MISS",
    description: "Technician opened the pump without isolating the electrical supply.",
    equipment: "Pump P-101",
    language: "en",
  });

  it("creates a report", async () => {
    const r = await req("POST", "/reports", { token: adminToken, body: payload() });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.report.status, "NEW");
    REPORT_ID.value = r.json.data.report.id;
  });

  it("rejects duplicate reportNumber with 409", async () => {
    const r = await req("POST", "/reports", { token: adminToken, body: payload() });
    assert.equal(r.status, 409);
  });

  it("rejects missing/invalid fields with 400", async () => {
    const { description, ...noDesc } = payload();
    assert.equal((await req("POST", "/reports", { token: adminToken, body: noDesc })).status, 400);
    assert.equal(
      (await req("POST", "/reports", { token: adminToken, body: { ...payload(), reportNumber: "X2", reportType: "FIRE" } })).status,
      400
    );
    assert.equal(
      (await req("POST", "/reports", { token: adminToken, body: { ...payload(), reportNumber: "X3", siteId: "nope" } })).status,
      400
    );
  });

  it("rejects unknown site with 404", async () => {
    const r = await req("POST", "/reports", {
      token: adminToken,
      body: { ...payload(), reportNumber: "OIL-2026-0009", siteId: "123e4567-e89b-42d3-a456-426614174000" },
    });
    assert.equal(r.status, 404);
  });

  it("lists with pagination envelope + filters", async () => {
    const r = await req("GET", "/reports?page=1&limit=20&reportType=NEAR_MISS", { token: adminToken });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.pagination.total, 1);
    assert.equal(r.json.data.pagination.page, 1);
  });

  it("returns report with site/creator and no passwordHash", async () => {
    const r = await req("GET", `/reports/${REPORT_ID.value}`, { token: adminToken });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.report.site.code, "DIG");
    assert.equal(r.json.data.report.creator.email, "hemal@example.com");
    assert.ok(!("passwordHash" in r.json.data.report.creator));
  });

  it("updates status but rejects description change with 422", async () => {
    const okRes = await req("PATCH", `/reports/${REPORT_ID.value}`, {
      token: adminToken,
      body: { status: "UNDER_REVIEW" },
    });
    assert.equal(okRes.status, 200);
    const bad = await req("PATCH", `/reports/${REPORT_ID.value}`, {
      token: adminToken,
      body: { description: "tampered" },
    });
    assert.equal(bad.status, 422);
    assert.equal(bad.json.error.code, "IMMUTABLE_FIELD");
  });

  it("rejects unauthenticated access with 401", async () => {
    assert.equal((await req("GET", "/reports")).status, 401);
    assert.equal((await req("POST", "/reports", { body: payload() })).status, 401);
  });
});
