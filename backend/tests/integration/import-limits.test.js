"use strict";

// Multer size-limit path (separate process so the tiny limit can't break
// the main import suite).
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.JWT_SECRET = "import-limit-secret";
process.env.SYNC_DB = "true";
process.env.MAX_IMPORT_FILE_SIZE_MB = "0.001"; // ~1KB

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("../../src/app");
const { sequelize, User } = require("../../src/models");

let server;
let base;
let adminToken;

before(async () => {
  await sequelize.sync({ force: true });
  server = app.listen(0);
  await new Promise((resolve) => server.on("listening", resolve));
  base = `http://localhost:${server.address().port}/api/v1`;

  const reg = await fetch(`${base}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Limit Admin", email: "limit@example.com", password: "StrongPassword123" }),
  });
  assert.equal(reg.status, 201);
  await User.update({ role: "HSE_ADMIN" }, { where: { email: "limit@example.com" } });
  const login = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "limit@example.com", password: "StrongPassword123" }),
  });
  adminToken = (await login.json()).data.token;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
});

describe("upload size limit", () => {
  it("413 FILE_TOO_LARGE on oversized file", async () => {
    const big = `reportNumber,date,site,activity,reportType,description\n${"OIL-BIG-1,2026-09-20,TST,Maintenance,NEAR_MISS,Padding text to exceed one kilobyte. ".repeat(30)}\n`;
    assert.ok(Buffer.byteLength(big) > 1024, "fixture must exceed the 1KB test limit");
    const form = new FormData();
    form.append("file", new File([big], "big.csv", { type: "text/csv" }));
    const r = await fetch(`${base}/reports/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });
    assert.equal(r.status, 413);
    assert.equal((await r.json()).error.code, "FILE_TOO_LARGE");
  });
});
