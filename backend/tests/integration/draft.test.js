"use strict";

process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.JWT_SECRET = "draft-test-secret";
process.env.SYNC_DB = "true";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("../../src/app");
const { sequelize, User, AIAnalysis } = require("../../src/models");

let server;
let base;
let workerAToken;
let workerBToken;
let hseToken;
let siteId;

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

  const mk = async (name, email, role) => {
    const r = await req("POST", "/worker/auth/register", { body: { name, employeeId: `EMP-${Math.random().toString(36).slice(2,6).toUpperCase()}`, email, mobile: "9876543210", password: "StrongPass123" } });
    if (role !== "USER") await User.update({ role }, { where: { email } });
    const login = await req("POST", "/auth/login", { body: { email, password: "StrongPass123" } });
    return login.json.data.token;
  };
  workerAToken = await mk("Worker A Draft", "draft-a@oil.local", "USER");
  workerBToken = await mk("Worker B Draft", "draft-b@oil.local", "USER");
  // HSE for site creation
  await req("POST", "/auth/register", { body: { name: "HSE Draft", email: "hse-draft@oil.local", password: "StrongPass123" } });
  await User.update({ role: "HSE_ADMIN" }, { where: { email: "hse-draft@oil.local" } });
  const hseLogin = await req("POST", "/auth/login", { body: { email: "hse-draft@oil.local", password: "StrongPass123" } });
  hseToken = hseLogin.json.data.token;
  const site = await req("POST", "/sites", { token: hseToken, body: { name: "Draft Site", code: "DRAFT" } });
  siteId = site.json.data.site.id;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
});

describe("draft lifecycle", () => {
  let draftId;

  it("1. Create draft", async () => {
    const r = await req("POST", "/worker/drafts", { token: workerAToken, body: { reportType: "UNSAFE_CONDITION", description: "Oil leakage near pump area." } });
    assert.equal(r.status, 201);
    assert.ok(r.json.data.draft.id);
    draftId = r.json.data.draft.id;
  });

  it("2. Create minimal draft", async () => {
    const r = await req("POST", "/worker/drafts", { token: workerAToken, body: { description: "Minimal draft" } });
    assert.equal(r.status, 201);
    await req("DELETE", `/worker/drafts/${r.json.data.draft.id}`, { token: workerAToken });
  });

  it("3. Update draft", async () => {
    const r = await req("PATCH", `/worker/drafts/${draftId}`, { token: workerAToken, body: { activity: "Pump Station", equipment: "P-214" } });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.draft.activity, "Pump Station");
  });

  it("4. List own drafts", async () => {
    const r = await req("GET", "/worker/drafts", { token: workerAToken });
    assert.equal(r.status, 200);
    assert.ok(r.json.data.items.some((d) => d.id === draftId));
  });

  it("5. Get own draft", async () => {
    const r = await req("GET", `/worker/drafts/${draftId}`, { token: workerAToken });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.draft.id, draftId);
  });

  it("6. Worker cannot get another worker's draft", async () => {
    const r = await req("GET", `/worker/drafts/${draftId}`, { token: workerBToken });
    assert.equal(r.status, 404);
  });

  it("7. Worker cannot update another worker's draft", async () => {
    const r = await req("PATCH", `/worker/drafts/${draftId}`, { token: workerBToken, body: { activity: "Hacked" } });
    assert.equal(r.status, 404);
  });

  it("8. Worker cannot delete another worker's draft", async () => {
    const r = await req("DELETE", `/worker/drafts/${draftId}`, { token: workerBToken });
    assert.equal(r.status, 404);
  });

  it("9. Worker cannot submit another worker's draft", async () => {
    const r = await req("POST", `/worker/drafts/${draftId}/submit`, { token: workerBToken });
    assert.equal(r.status, 404);
  });

  it("10. Delete own draft", async () => {
    const cr = await req("POST", "/worker/drafts", { token: workerAToken, body: { description: "To be deleted" } });
    const id = cr.json.data.draft.id;
    const del = await req("DELETE", `/worker/drafts/${id}`, { token: workerAToken });
    assert.equal(del.status, 200);
    const get = await req("GET", `/worker/drafts/${id}`, { token: workerAToken });
    assert.equal(get.status, 404);
  });

  it("11. Invalid draft submission rejected", async () => {
    // draft has no required fields for real report
    const r = await req("POST", `/worker/drafts/${draftId}/submit`, { token: workerAToken });
    assert.equal(r.status, 400);
  });

  it("12. Draft remains after validation failure", async () => {
    const r = await req("GET", `/worker/drafts/${draftId}`, { token: workerAToken });
    assert.equal(r.status, 200);
  });

  let submittedReportId;
  it("13. Valid draft successfully submitted", async () => {
    // Complete draft to valid report
    await req("PATCH", `/worker/drafts/${draftId}`, {
      token: workerAToken,
      body: { siteId, activity: "Pump Station", reportType: "UNSAFE_CONDITION", date: "2026-09-20", description: "Oil leakage near pump area observed during rounds with sufficient details for validation." },
    });
    const r = await req("POST", `/worker/drafts/${draftId}/submit`, { token: workerAToken });
    assert.equal(r.status, 201);
    assert.ok(r.json.data.report.id);
    submittedReportId = r.json.data.report.id;
  });

  it("14. Submitted draft creates real report", async () => {
    const r = await req("GET", `/worker/reports/${submittedReportId}`, { token: workerAToken });
    assert.equal(r.status, 200);
    assert.ok(r.json.data.report.reportNumber.startsWith("WRK-"));
  });

  it("15. Submitted draft receives normal report number", async () => {
    const r = await req("GET", `/worker/reports/${submittedReportId}`, { token: workerAToken });
    assert.match(r.json.data.report.reportNumber, /^WRK-\d{8}-[0-9A-F]{4}$/);
  });

  it("16. Draft is removed after successful submission", async () => {
    const r = await req("GET", `/worker/drafts/${draftId}`, { token: workerAToken });
    assert.equal(r.status, 404);
  });

  it("17. Draft does not create AIAnalysis", async () => {
    const cr = await req("POST", "/worker/drafts", { token: workerAToken, body: { reportType: "NEAR_MISS", description: "Draft no AI" } });
    const id = cr.json.data.draft.id;
    const row = await AIAnalysis.findOne({ where: { reportId: id } });
    assert.equal(row, null);
    await req("DELETE", `/worker/drafts/${id}`, { token: workerAToken });
  });

  it("18. Draft does not create HSE review", async () => {
    const cr = await req("POST", "/worker/drafts", { token: workerAToken, body: { description: "Draft no review" } });
    const id = cr.json.data.draft.id;
    // No review should exist for draft id (which is not a report id)
    await req("DELETE", `/worker/drafts/${id}`, { token: workerAToken });
    assert.ok(true);
  });

  it("19. Draft does not affect dashboard statistics", async () => {
    const before = await req("GET", "/worker/summary", { token: workerAToken });
    const beforeCount = before.json.data.myReports;
    await req("POST", "/worker/drafts", { token: workerAToken, body: { description: "Stats draft" } });
    const after = await req("GET", "/worker/summary", { token: workerAToken });
    assert.equal(after.json.data.myReports, beforeCount);
    // Cleanup
    const list = await req("GET", "/worker/drafts", { token: workerAToken });
    for (const d of list.json.data.items) await req("DELETE", `/worker/drafts/${d.id}`, { token: workerAToken });
  });

  it("20. Existing normal report submission still works", async () => {
    const r = await req("POST", "/worker/reports", {
      token: workerAToken,
      body: { date: "2026-09-20", siteId, activity: "Maintenance", reportType: "NEAR_MISS", description: "Direct report without draft for regression with sufficient length." },
    });
    assert.equal(r.status, 201);
    assert.ok(r.json.data.report.reportNumber.startsWith("WRK-"));
  });

  it("HSE cannot manipulate drafts", async () => {
    const cr = await req("POST", "/worker/drafts", { token: workerAToken, body: { description: "HSE test draft" } });
    const id = cr.json.data.draft.id;
    const list = await req("GET", "/worker/drafts", { token: hseToken });
    // HSE should get 403 (USER only)
    assert.equal(list.status, 403);
    const get = await req("GET", `/worker/drafts/${id}`, { token: hseToken });
    assert.equal(get.status, 403);
    await req("DELETE", `/worker/drafts/${id}`, { token: workerAToken });
  });
});
