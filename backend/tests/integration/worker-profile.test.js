"use strict";

process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.JWT_SECRET = "worker-profile-test-secret";
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

describe("worker profile", () => {
  let workerAToken;
  let workerBToken;
  let workerAEmail = "profile-a@example.com";
  let workerBEmail = "profile-b@example.com";

  before(async () => {
    // Create two workers via worker registration endpoint
    const a = await req("POST", "/worker/auth/register", {
      body: { name: "Profile Worker A", employeeId: "EMP-PROF-A", email: workerAEmail, mobile: "9876543210", password: "StrongPassword123" },
    });
    assert.equal(a.status, 201);
    const b = await req("POST", "/worker/auth/register", {
      body: { name: "Profile Worker B", employeeId: "EMP-PROF-B", email: workerBEmail, password: "StrongPassword123" },
    });
    assert.equal(b.status, 201);
    const la = await req("POST", "/auth/login", { body: { email: workerAEmail, password: "StrongPassword123" } });
    workerAToken = la.json.data.token;
    const lb = await req("POST", "/auth/login", { body: { email: workerBEmail, password: "StrongPassword123" } });
    workerBToken = lb.json.data.token;
  });

  it("1. authenticated worker can GET own profile", async () => {
    const r = await req("GET", "/worker/profile", { token: workerAToken });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.user.email, workerAEmail);
    assert.equal(r.json.data.user.role, "USER");
    assert.ok(!("passwordHash" in r.json.data.user));
    assert.equal(r.json.data.user.name, "Profile Worker A");
    assert.equal(r.json.data.user.employeeId, "EMP-PROF-A");
    assert.equal(r.json.data.user.mobile, "9876543210");
  });

  it("2. unauthenticated worker cannot GET profile", async () => {
    const r = await req("GET", "/worker/profile");
    assert.equal(r.status, 401);
  });

  it("3. worker can update own name", async () => {
    const r = await req("PATCH", "/worker/profile", { token: workerAToken, body: { name: "Updated Worker A" } });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.user.name, "Updated Worker A");
    const me = await req("GET", "/worker/profile", { token: workerAToken });
    assert.equal(me.json.data.user.name, "Updated Worker A");
  });

  it("4. worker can update mobile if supported", async () => {
    const r = await req("PATCH", "/worker/profile", { token: workerAToken, body: { mobile: "9998887776" } });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.user.mobile, "9998887776");
  });

  it("5. worker cannot change role", async () => {
    const r = await req("PATCH", "/worker/profile", { token: workerAToken, body: { role: "HSE_ADMIN", name: "Hacker" } });
    // Strict schema rejects unknown role field
    assert.equal(r.status, 400);
    const me = await req("GET", "/worker/profile", { token: workerAToken });
    assert.equal(me.json.data.user.role, "USER");
  });

  it("6. worker cannot change account status", async () => {
    const r = await req("PATCH", "/worker/profile", { token: workerAToken, body: { status: "INACTIVE" } });
    assert.equal(r.status, 400);
    const me = await req("GET", "/worker/profile", { token: workerAToken });
    assert.equal(me.json.data.user.status, "ACTIVE");
  });

  it("7. worker cannot modify permissions", async () => {
    const r = await req("PATCH", "/worker/profile", { token: workerAToken, body: { permissions: ["ADMIN"], isActive: true } });
    assert.equal(r.status, 400);
  });

  it("8. worker cannot modify another user (profile is self via JWT)", async () => {
    // Worker A tries to get B's profile via any param - endpoint has no param, so it should still return A's own
    const r = await req("GET", "/worker/profile", { token: workerAToken });
    assert.equal(r.json.data.user.email, workerAEmail);
    assert.notEqual(r.json.data.user.email, workerBEmail);
    // Attempt to patch with another user's email should not affect other user
    await req("PATCH", "/worker/profile", { token: workerAToken, body: { name: "Hacked B" } });
    const bProfile = await req("GET", "/worker/profile", { token: workerBToken });
    assert.equal(bProfile.json.data.user.name, "Profile Worker B");
  });

  it("9. correct current password allows password change", async () => {
    const r = await req("PATCH", "/worker/profile/password", {
      token: workerAToken,
      body: { currentPassword: "StrongPassword123", newPassword: "NewStrongPass456", confirmPassword: "NewStrongPass456" },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.user.email, workerAEmail);
  });

  it("10. wrong current password is rejected", async () => {
    const r = await req("PATCH", "/worker/profile/password", {
      token: workerAToken,
      body: { currentPassword: "WrongPass123", newPassword: "AnotherPass789", confirmPassword: "AnotherPass789" },
    });
    assert.equal(r.status, 401);
    assert.match(r.json.error.message, /Current password is incorrect/i);
  });

  it("11. password mismatch is rejected", async () => {
    const r = await req("PATCH", "/worker/profile/password", {
      token: workerAToken,
      body: { currentPassword: "NewStrongPass456", newPassword: "Mismatch1", confirmPassword: "Mismatch2" },
    });
    assert.equal(r.status, 400);
  });

  it("12. new password is properly hashed", async () => {
    const row = await User.unscoped().findOne({ where: { email: workerAEmail } });
    assert.ok(row.passwordHash);
    assert.notEqual(row.passwordHash, "NewStrongPass456");
    assert.ok(await bcrypt.compare("NewStrongPass456", row.passwordHash));
  });

  it("13. old password no longer works after successful password change", async () => {
    const r = await req("POST", "/auth/login", { body: { email: workerAEmail, password: "StrongPassword123" } });
    assert.equal(r.status, 401);
  });

  it("14. new password works after successful password change", async () => {
    const r = await req("POST", "/auth/login", { body: { email: workerAEmail, password: "NewStrongPass456" } });
    assert.equal(r.status, 200);
    assert.ok(r.json.data.token);
    // Verify worker endpoints still work
    const summary = await req("GET", "/worker/summary", { token: r.json.data.token });
    assert.equal(summary.status, 200);
  });
});
