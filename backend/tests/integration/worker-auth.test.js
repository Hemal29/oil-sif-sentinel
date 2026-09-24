"use strict";

process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.JWT_SECRET = "worker-auth-test-secret";
process.env.SYNC_DB = "true";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const app = require("../../src/app");
const { sequelize, User } = require("../../src/models");

let server;
let base;

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

describe("worker registration", () => {
  it("successful worker registration", async () => {
    const r = await req("POST", "/worker/auth/register", {
      body: {
        name: "Rahul Patel",
        employeeId: "EMP-1024",
        email: "rahul@example.com",
        mobile: "9876543210",
        password: "StrongPassword123",
      },
    });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.user.email, "rahul@example.com");
    assert.equal(r.json.data.user.role, "USER");
    assert.equal(r.json.data.user.status, "ACTIVE");
    assert.ok(!("passwordHash" in r.json.data.user));
    const row = await User.unscoped().findOne({ where: { email: "rahul@example.com" } });
    assert.ok(row);
    assert.equal(row.role, "USER");
  });

  it("missing name", async () => {
    const r = await req("POST", "/worker/auth/register", {
      body: { employeeId: "EMP-1025", email: "a1@example.com", password: "StrongPassword123" },
    });
    assert.equal(r.status, 400);
  });

  it("missing employeeId", async () => {
    const r = await req("POST", "/worker/auth/register", {
      body: { name: "No Emp", email: "a2@example.com", password: "StrongPassword123" },
    });
    assert.equal(r.status, 400);
  });

  it("missing email", async () => {
    const r = await req("POST", "/worker/auth/register", {
      body: { name: "No Email", employeeId: "EMP-1026", password: "StrongPassword123" },
    });
    assert.equal(r.status, 400);
  });

  it("invalid email", async () => {
    const r = await req("POST", "/worker/auth/register", {
      body: { name: "Bad Email", employeeId: "EMP-1027", email: "not-an-email", password: "StrongPassword123" },
    });
    assert.equal(r.status, 400);
  });

  it("weak password", async () => {
    const r = await req("POST", "/worker/auth/register", {
      body: { name: "Weak", employeeId: "EMP-1028", email: "weak2@example.com", password: "short" },
    });
    assert.equal(r.status, 400);
  });

  it("duplicate email", async () => {
    const r = await req("POST", "/worker/auth/register", {
      body: { name: "Duplicate", employeeId: "EMP-1029", email: "rahul@example.com", password: "StrongPassword123" },
    });
    assert.equal(r.status, 409);
    assert.match(r.json.error.message, /email already exists/i);
  });

  it("duplicate employee ID if supported", async () => {
    const r = await req("POST", "/worker/auth/register", {
      body: { name: "Dup Emp", employeeId: "EMP-1024", email: "dupemp@example.com", password: "StrongPassword123" },
    });
    assert.equal(r.status, 409);
    assert.match(r.json.error.message, /Employee ID already exists/i);
  });

  it("role cannot be supplied by client (strict schema)", async () => {
    const r = await req("POST", "/worker/auth/register", {
      body: { name: "Test", employeeId: "EMP-1030", email: "role1@example.com", password: "StrongPassword123", role: "USER" },
    });
    assert.equal(r.status, 400);
  });

  it("client attempting HSE_ADMIN still creates USER or is rejected safely", async () => {
    const r = await req("POST", "/worker/auth/register", {
      body: { name: "Hacker", employeeId: "EMP-1031", email: "hacker@example.com", password: "StrongPassword123", role: "HSE_ADMIN" },
    });
    // Strict schema rejects unknown role field
    assert.equal(r.status, 400);
    // Even if it slipped through, ensure no HSE_ADMIN created
    const row = await User.findOne({ where: { email: "hacker@example.com" } });
    assert.equal(row, null);
    // Now try without role but verify role is USER not HSE_ADMIN
    const r2 = await req("POST", "/worker/auth/register", {
      body: { name: "Hacker2", employeeId: "EMP-1032", email: "hacker2@example.com", password: "StrongPassword123" },
    });
    assert.equal(r2.status, 201);
    assert.equal(r2.json.data.user.role, "USER");
    const row2 = await User.findOne({ where: { email: "hacker2@example.com" } });
    assert.equal(row2.role, "USER");
  });

  it("password is hashed", async () => {
    const email = "hashcheck@example.com";
    await req("POST", "/worker/auth/register", {
      body: { name: "Hash Check", employeeId: "EMP-1033", email, password: "StrongPassword123" },
    });
    const row = await User.unscoped().findOne({ where: { email } });
    assert.ok(row.passwordHash);
    assert.notEqual(row.passwordHash, "StrongPassword123");
    assert.ok(await bcrypt.compare("StrongPassword123", row.passwordHash));
  });

  it("newly registered USER can login", async () => {
    const r = await req("POST", "/auth/login", {
      body: { email: "rahul@example.com", password: "StrongPassword123" },
    });
    assert.equal(r.status, 200);
    assert.ok(r.json.data.token);
    assert.equal(r.json.data.user.role, "USER");
  });

  it("newly registered USER can access worker endpoints", async () => {
    const login = await req("POST", "/auth/login", { body: { email: "rahul@example.com", password: "StrongPassword123" } });
    const token = login.json.data.token;
    const summary = await req("GET", "/worker/summary", { token });
    assert.equal(summary.status, 200);
    assert.ok(typeof summary.json.data.myReports === "number");
  });

  it("newly registered USER cannot access HSE-only endpoints", async () => {
    const login = await req("POST", "/auth/login", { body: { email: "rahul@example.com", password: "StrongPassword123" } });
    const token = login.json.data.token;
    // Create a report as this user to have a reportId for review/analysis tests
    // Need a site id - create via HSE_ADMIN first
    // Create admin for site creation
    const adminReg = await req("POST", "/auth/register", { body: { name: "Tmp Admin", email: "tmpadmin@example.com", password: "StrongPassword123" } });
    await User.update({ role: "HSE_ADMIN" }, { where: { email: "tmpadmin@example.com" } });
    const adminLogin = await req("POST", "/auth/login", { body: { email: "tmpadmin@example.com", password: "StrongPassword123" } });
    const adminToken = adminLogin.json.data.token;
    const siteRes = await req("POST", "/sites", { token: adminToken, body: { name: "TestSiteHA", code: "TSHA" } });
    assert.equal(siteRes.status, 201);
    const siteId = siteRes.json.data.site.id;
    const reportRes = await req("POST", "/worker/reports", {
      token,
      body: { date: "2026-09-20", siteId, activity: "Maintenance", reportType: "NEAR_MISS", description: "Worker test report for HSE endpoint check near unit." },
    });
    assert.equal(reportRes.status, 201);
    const reportId = reportRes.json.data.report.id;
    assert.equal((await req("POST", "/reviews", { token, body: { reportId, hseDecision: "CONFIRMED" } })).status, 403);
    assert.equal((await req("POST", `/analysis/reports/${reportId}`, { token })).status, 403);
    assert.equal((await req("POST", "/sites", { token, body: { name: "ShouldFail", code: "FAIL2" } })).status, 403);
  });

  it("existing users continue working", async () => {
    // Register via generic auth and ensure still login works
    const r = await req("POST", "/auth/register", { body: { name: "Legacy User", email: "legacy@example.com", password: "StrongPassword123" } });
    assert.equal(r.status, 201);
    const login = await req("POST", "/auth/login", { body: { email: "legacy@example.com", password: "StrongPassword123" } });
    assert.equal(login.status, 200);
  });
});
