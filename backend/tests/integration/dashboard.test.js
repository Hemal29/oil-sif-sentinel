"use strict";

// Step 6 tests: dashboard analytics over real (sqlite memory) rows.
// No hardcoded expectations of production data — every number asserted here
// is derived from rows this file seeds.
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.JWT_SECRET = "dashboard-test-secret";
process.env.SYNC_DB = "true";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("../../src/app");
const { sequelize, User, Site, LifeSavingRule, Report, AIAnalysis } = require("../../src/models");

let server;
let base;
let adminToken;
let userToken;
const ids = {};

function req(path, { token } = {}) {
  return fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(async (r) => ({ status: r.status, json: await r.json() }));
}

const RANGE = "dateFrom=2026-01-01&dateTo=2026-12-31";

before(async () => {
  await sequelize.sync({ force: true });
  server = app.listen(0);
  await new Promise((resolve) => server.on("listening", resolve));
  base = `http://localhost:${server.address().port}/api/v1`;

  const mkUser = async (name, email, role) => {
    const u = await User.create({ name, email, passwordHash: "x".repeat(60), role });
    const jwt = require("jsonwebtoken");
    return jwt.sign({ userId: u.id, role }, process.env.JWT_SECRET);
  };
  adminToken = await mkUser("Dash Admin", "dash-admin@example.com", "HSE_ADMIN");
  userToken = await mkUser("Dash User", "dash-user@example.com", "USER");

  const s1 = await Site.create({ name: "Plant Alpha", code: "ALP" });
  const s2 = await Site.create({ name: "Plant Beta", code: "BET" });
  const rule = await LifeSavingRule.create({ name: "Proto Energy", code: "PROTO-X", isPrototype: true });
  const admin = await User.findOne({ where: { email: "dash-admin@example.com" } });
  ids.rule = rule.id;

  const mkReport = (n, overrides) =>
    Report.create({
      reportNumber: n,
      date: "2026-09-10",
      siteId: s1.id,
      activity: "Maintenance",
      reportType: "NEAR_MISS",
      description: `Dashboard seed report ${n} with sufficient text length.`,
      createdBy: admin.id,
      ...overrides,
    });

  const r1 = await mkReport("D-001", { date: "2026-09-10", status: "NEW" });
  const r2 = await mkReport("D-002", { date: "2026-09-11", activity: "Operations", reportType: "UNSAFE_ACT", status: "ANALYZED" });
  const r3 = await mkReport("D-003", { date: "2026-09-12", siteId: s2.id, reportType: "UNSAFE_CONDITION", status: "NEW" });
  const r4 = await mkReport("D-004", { date: "2026-09-13", siteId: s2.id, activity: "Operations", status: "NEW" });
  const r5 = await mkReport("D-005", { date: "2026-09-14", siteId: s2.id, activity: "Operations", reportType: "UNSAFE_ACT", status: "UNDER_REVIEW" });
  const r6 = await mkReport("D-006", { date: "2026-08-01", status: "CLOSED" });

  await AIAnalysis.create({ reportId: r1.id, sifPotential: true, priority: "HIGH", lifeSavingRuleId: rule.id, analysisStatus: "COMPLETED" });
  await AIAnalysis.create({ reportId: r2.id, sifPotential: false, priority: "LOW", analysisStatus: "COMPLETED" });
  await AIAnalysis.create({ reportId: r3.id, analysisStatus: "PENDING" });
  await AIAnalysis.create({ reportId: r4.id, analysisStatus: "FAILED" });
  await AIAnalysis.create({ reportId: r6.id, sifPotential: true, priority: "CRITICAL", lifeSavingRuleId: rule.id, analysisStatus: "COMPLETED" });
  // r5 deliberately has no analysis row.
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
});

describe("dashboard auth", () => {
  it("401 without token, 401 with bad token", async () => {
    assert.equal((await req(`/dashboard/overview?${RANGE}`)).status, 401);
    assert.equal((await req(`/dashboard/overview?${RANGE}`, { token: "bad.token.here" })).status, 401);
  });

  it("200 for authenticated USER (reads need no special role)", async () => {
    const r = await req(`/dashboard/overview?${RANGE}`, { token: userToken });
    assert.equal(r.status, 200);
    assert.equal(r.json.success, true);
  });
});

describe("overview + date filtering", () => {
  it("aggregates KPIs from real rows", async () => {
    const { json } = await req(`/dashboard/overview?${RANGE}`, { token: adminToken });
    assert.deepEqual(json.data, { totalReports: 6, sifPotential: 2, highPriority: 2, pendingReviews: 1, aiAbstained: 0, aiUncertain: 0, autoClosed: 0, priorityReports: 0 });
  });

  it("narrows with explicit dates and presets", async () => {
    const sept = await req("/dashboard/overview?dateFrom=2026-09-01&dateTo=2026-09-30", { token: adminToken });
    assert.deepEqual(sept.json.data, { totalReports: 5, sifPotential: 1, highPriority: 1, pendingReviews: 1, aiAbstained: 0, aiUncertain: 0, autoClosed: 0, priorityReports: 0 });
    const preset = await req("/dashboard/overview?preset=7d", { token: adminToken });
    assert.equal(preset.status, 200);
    assert.ok(typeof preset.json.data.totalReports === "number");
  });

  it("rejects invalid ranges", async () => {
    assert.equal((await req("/dashboard/overview?dateFrom=2026-13-01&dateTo=2026-12-31", { token: adminToken })).status, 400);
    assert.equal((await req("/dashboard/overview?dateFrom=2026-10-01&dateTo=2026-09-01", { token: adminToken })).status, 400);
    assert.equal((await req("/dashboard/overview?dateFrom=2026-09-01", { token: adminToken })).status, 400);
    assert.equal((await req("/dashboard/overview?preset=century", { token: adminToken })).status, 400);
  });
});

describe("distributions", () => {
  it("counts report types, SIF states and priorities correctly", async () => {
    const { json } = await req(`/dashboard/distributions?${RANGE}`, { token: adminToken });
    assert.deepEqual(json.data.reportType, { UNSAFE_ACT: 2, UNSAFE_CONDITION: 1, NEAR_MISS: 3 });
    // PENDING + FAILED + missing analyses are UNANALYZED, never non-SIF.
    assert.deepEqual(json.data.sif, { sif: 2, nonSif: 1, unanalyzed: 3 });
    assert.deepEqual(json.data.priority, { LOW: 1, MEDIUM: 0, HIGH: 1, CRITICAL: 1 });
  });
});

describe("trends", () => {
  it("buckets daily points with totals and SIF counts", async () => {
    const { json } = await req("/dashboard/trends?dateFrom=2026-09-10&dateTo=2026-09-14", { token: adminToken });
    assert.equal(json.data.bucket, "day");
    assert.equal(json.data.points.length, 5);
    assert.deepEqual(json.data.points[0], { date: "2026-09-10", totalReports: 1, sifReports: 1 });
    assert.deepEqual(json.data.points[4], { date: "2026-09-14", totalReports: 1, sifReports: 0 });
    const total = json.data.points.reduce((n, p) => n + p.totalReports, 0);
    assert.equal(total, 5);
  });

  it("uses monthly buckets for a year range", async () => {
    const { json } = await req("/dashboard/trends?dateFrom=2026-01-01&dateTo=2026-12-31", { token: adminToken });
    assert.equal(json.data.bucket, "month");
    const aug = json.data.points.find((p) => p.date === "2026-08");
    const sep = json.data.points.find((p) => p.date === "2026-09");
    assert.equal(aug.totalReports, 1);
    assert.equal(sep.totalReports, 5);
    assert.equal(sep.sifReports, 1);
  });
});

describe("breakdowns", () => {
  it("attributes sites from real rows", async () => {
    const { json } = await req(`/dashboard/sites?${RANGE}`, { token: adminToken });
    const alpha = json.data.items.find((s) => s.siteCode === "ALP");
    const beta = json.data.items.find((s) => s.siteCode === "BET");
    assert.deepEqual([alpha.reportCount, alpha.sifCount, alpha.highCriticalCount], [3, 2, 2]);
    assert.deepEqual([beta.reportCount, beta.sifCount, beta.highCriticalCount], [3, 0, 0]);
  });

  it("groups by the reports.activity string field", async () => {
    const { json } = await req(`/dashboard/activities?${RANGE}`, { token: adminToken });
    const maint = json.data.items.find((a) => a.activity === "Maintenance");
    const ops = json.data.items.find((a) => a.activity === "Operations");
    assert.deepEqual([maint.reportCount, maint.sifCount, maint.highCriticalCount], [3, 2, 2]);
    assert.deepEqual([ops.reportCount, ops.sifCount, ops.highCriticalCount], [3, 0, 0]);
  });

  it("resolves rules and passes through the prototype flag", async () => {
    const { json } = await req(`/dashboard/life-saving-rules?${RANGE}`, { token: adminToken });
    assert.equal(json.data.items.length, 1);
    assert.deepEqual(json.data.items[0], {
      ruleId: ids.rule,
      ruleCode: "PROTO-X",
      ruleName: "Proto Energy",
      isPrototype: true,
      reportCount: 2,
      sifCount: 2,
    });
  });
});

describe("recent + pending", () => {
  it("lists HIGH/CRITICAL newest-first with a limit cap", async () => {
    const { json } = await req(`/dashboard/recent-reports?${RANGE}`, { token: adminToken });
    assert.equal(json.data.items.length, 2);
    assert.equal(json.data.items[0].reportNumber, "D-001"); // 09-10 before 08-01
    assert.equal(json.data.items[0].siteName, "Plant Alpha");
    assert.ok(!JSON.stringify(json.data.items).includes("passwordHash"));
    const one = await req(`/dashboard/recent-reports?${RANGE}&limit=1`, { token: adminToken });
    assert.equal(one.json.data.items.length, 1);
    assert.equal((await req("/dashboard/recent-reports?limit=999", { token: adminToken })).status, 400);
  });

  it("lists UNDER_REVIEW reports oldest-first", async () => {
    const { json } = await req(`/dashboard/pending-reviews?${RANGE}`, { token: adminToken });
    assert.equal(json.data.total, 1);
    assert.equal(json.data.items[0].reportNumber, "D-005");
    assert.equal(json.data.items[0].status, "UNDER_REVIEW");
  });

  it("returns zeros and empty lists when nothing matches", async () => {
    const empty = "dateFrom=2000-01-01&dateTo=2000-01-31";
    const o = await req(`/dashboard/overview?${empty}`, { token: adminToken });
    assert.deepEqual(o.json.data, { totalReports: 0, sifPotential: 0, highPriority: 0, pendingReviews: 0, aiAbstained: 0, aiUncertain: 0, autoClosed: 0, priorityReports: 0 });
    const d = await req(`/dashboard/distributions?${empty}`, { token: adminToken });
    assert.deepEqual(d.json.data.sif, { sif: 0, nonSif: 0, unanalyzed: 0 });
    const t = await req(`/dashboard/trends?${empty}`, { token: adminToken });
    assert.deepEqual(t.json.data.points, []);
    const s = await req(`/dashboard/sites?${empty}`, { token: adminToken });
    assert.deepEqual(s.json.data.items, []);
  });
});
