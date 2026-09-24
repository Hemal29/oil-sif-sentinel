"use strict";

// W9.6 tests: Audit Trail & Activity History (sqlite memory, test-only dialect).
// Every event asserted here comes from a real business operation — no mocks
// except the Python AI HTTP stub (same pattern as analysis.test.js).
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.JWT_SECRET = "audit-test-secret";
process.env.SYNC_DB = "true";
process.env.AI_SERVICE_URL = "http://127.0.0.1:1"; // unreachable by default

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const env = require("../../src/config/env");
const app = require("../../src/app");
const { sequelize, User, Report, AIAnalysis, AuditEvent } = require("../../src/models");
const auditService = require("../../src/services/audit.service");

const DESCRIPTION =
  "During electrical maintenance on Motor Control Panel MCP-07, a technician opened the panel and began work without isolating and locking out the electrical energy source. Live conductors were exposed.";

const LEGACY_AI = {
  sifPotential: true,
  confidence: 0.82,
  activity: "Electrical Maintenance",
  hazard: "Uncontrolled Energy",
  barrierFailure: "Energy Isolation",
  consequence: "Electrocution",
  lifeSavingRuleCode: null,
  priority: "HIGH",
  evidence: ["without isolating and locking out the electrical energy source"],
  extractedEntities: { equipment: ["MCP-07"], hazards: ["Electrical"], barriers: [], activities: [] },
  modelName: "prototype",
  modelVersion: "0.1.0",
};

function layeredAssess(route, riskScore, sifPotential) {
  return {
    schemaVersion: "sif-assessment-1.0.0",
    recordId: "REPORT_ID",
    metadata: { taxonomyVersion: "sif-taxonomy-1.0.0", scoreKind: "heuristic-prototype" },
    receivedAt: "2026-09-21T00:00:00.000Z",
    processedAt: "2026-09-21T00:00:00.010Z",
    processingMs: 10,
    triage: {
      route,
      requiresHumanReview: route !== "AUTO_CLOSE",
      escalatedToExtraction: route === "PRIORITY",
      riskScore,
      ruleBasedSignal: { triggered: route === "PRIORITY", matchedRules: [] },
    },
    assessment: {
      sifPotential,
      activity: "Electrical Maintenance",
      primaryRule: route === "PRIORITY" ? "ENERGY_ISOLATION" : null,
      secondaryRules: [],
      hazardEnergy: route === "PRIORITY" ? "Electrical" : null,
      eventStatus: "UNSAFE_ACT",
      barriersFailed: [],
      assets: ["Motor Control Panel MCP-07"],
      rationale: "Test rationale.",
      evidence: route === "PRIORITY" ? ["without isolating and locking out the electrical energy source"] : [],
    },
    extraction: { status: route === "PRIORITY" ? "success" : "skipped", modelVersion: "test-1.0", repairAttempts: 0, failureReason: null },
    clarificationRequest: null,
  };
}

let server;
let base;
let adminToken;
let reviewerToken;
let workerAToken;
let workerBToken;
let workerAId;
let workerBId;
let reviewerId;
let siteId;
let n = 0;

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

async function registerWorker(name, email, emp) {
  const r = await req("POST", "/worker/auth/register", {
    body: { name, employeeId: emp, email, password: "StrongPass123" },
  });
  assert.equal(r.status, 201);
  return r.json.data.user;
}

async function makeReport(token, tag) {
  n += 1;
  const r = await req("POST", "/reports", {
    token,
    body: {
      reportNumber: `OIL-AUD-${tag}-${n}`,
      date: "2026-09-20",
      siteId,
      activity: "Electrical Maintenance",
      reportType: "UNSAFE_ACT",
      description: DESCRIPTION,
      equipment: "Motor Control Panel MCP-07",
    },
  });
  assert.equal(r.status, 201);
  return r.json.data.report;
}

async function makeWorkerReport(token, description = DESCRIPTION) {
  const r = await req("POST", "/worker/reports", {
    token,
    body: {
      date: "2026-09-20",
      siteId,
      activity: "Electrical Maintenance",
      reportType: "UNSAFE_ACT",
      description,
      equipment: "Motor Control Panel MCP-07",
    },
  });
  assert.equal(r.status, 201);
  return r.json.data.report;
}

function stubAI(responder) {
  const srv = http.createServer((rq, rs) => {
    let data = "";
    rq.on("data", (c) => { data += c; });
    rq.on("end", () => responder(rq, rs));
  });
  return new Promise((resolve) => {
    srv.listen(0, "127.0.0.1", () => {
      env.aiServiceUrl = `http://127.0.0.1:${srv.address().port}`;
      resolve(srv);
    });
  });
}

function json(rs, status, obj) {
  rs.writeHead(status, { "Content-Type": "application/json" });
  rs.end(JSON.stringify(obj));
}

function closeSrv(srv) {
  return new Promise((resolve) => srv.close(resolve));
}

async function auditFor(reportId, token) {
  const r = await req("GET", `/reports/${reportId}/audit`, { token });
  assert.equal(r.status, 200);
  return r.json.data.items;
}

function byType(items, type) {
  return items.filter((e) => e.eventType === type);
}

before(async () => {
  await sequelize.sync({ force: true });
  server = app.listen(0);
  await new Promise((resolve) => server.on("listening", resolve));
  base = `http://localhost:${server.address().port}/api/v1`;

  const wa = await registerWorker("Worker A", "worker-a@oil.local", "EMP-AUD-A");
  const wb = await registerWorker("Worker B", "worker-b@oil.local", "EMP-AUD-B");
  workerAId = wa.id;
  workerBId = wb.id;
  workerAToken = (await req("POST", "/auth/login", { body: { email: "worker-a@oil.local", password: "StrongPass123" } })).json.data.token;
  workerBToken = (await req("POST", "/auth/login", { body: { email: "worker-b@oil.local", password: "StrongPass123" } })).json.data.token;

  await req("POST", "/auth/register", { body: { name: "Aud Reviewer", email: "aud-reviewer@oil.local", password: "StrongPass123" } });
  await req("POST", "/auth/register", { body: { name: "Aud Admin", email: "aud-admin@oil.local", password: "StrongPass123" } });
  await User.update({ role: "HSE_REVIEWER" }, { where: { email: "aud-reviewer@oil.local" } });
  await User.update({ role: "HSE_ADMIN" }, { where: { email: "aud-admin@oil.local" } });
  reviewerToken = (await req("POST", "/auth/login", { body: { email: "aud-reviewer@oil.local", password: "StrongPass123" } })).json.data.token;
  adminToken = (await req("POST", "/auth/login", { body: { email: "aud-admin@oil.local", password: "StrongPass123" } })).json.data.token;
  reviewerId = (await User.findOne({ where: { email: "aud-reviewer@oil.local" } })).id;

  const site = await req("POST", "/sites", { token: adminToken, body: { name: "Audit Site", code: "AUD" } });
  siteId = site.json.data.site.id;
  env.aiTimeoutMs = 2000;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
});

describe("W9.6 submission audit", () => {
  it("1-4. REPORT_SUBMITTED with correct reportId, actorUserId, actorType", async () => {
    const report = await makeReport(adminToken, "SUB");
    const items = await auditFor(report.id, adminToken);
    const sub = byType(items, "REPORT_SUBMITTED");
    assert.equal(sub.length, 1);
    assert.equal(sub[0].reportId, report.id);
    assert.equal(sub[0].actorUserId, (await User.findOne({ where: { email: "aud-admin@oil.local" } })).id);
    assert.equal(sub[0].actorType, "HSE");
    assert.equal(sub[0].newStatus, "NEW");
    assert.equal(sub[0].metadata.reportNumber, report.reportNumber);
    assert.equal(sub[0].metadata.reportType, "UNSAFE_ACT");
  });

  it("worker submission records USER actor", async () => {
    const report = await makeWorkerReport(workerAToken);
    const items = await auditFor(report.id, workerAToken);
    const sub = byType(items, "REPORT_SUBMITTED");
    assert.equal(sub.length, 1);
    assert.equal(sub[0].actorUserId, workerAId);
    assert.equal(sub[0].actorType, "USER");
    assert.ok(sub[0].actor && sub[0].actor.id === workerAId);
  });

  it("draft submit creates exactly one REPORT_SUBMITTED; autosaves create none", async () => {
    const d = await req("POST", "/worker/drafts", {
      token: workerAToken,
      body: { reportType: "UNSAFE_ACT", siteId, activity: "Electrical Maintenance", description: DESCRIPTION, date: "2026-09-20", equipment: "Motor Control Panel MCP-07" },
    });
    assert.equal(d.status, 201);
    const draftId = d.json.data.draft.id;
    // Autosave spam: three updates, no report exists yet, no audit possible.
    for (let i = 0; i < 3; i += 1) {
      const u = await req("PATCH", `/worker/drafts/${draftId}`, { token: workerAToken, body: { activity: `Electrical Maintenance ${i}` } });
      assert.equal(u.status, 200);
    }
    const before = await AuditEvent.count();
    const s = await req("POST", `/worker/drafts/${draftId}/submit`, { token: workerAToken });
    assert.equal(s.status, 201);
    const reportId = s.json.data.report.id;
    const items = await auditFor(reportId, workerAToken);
    assert.equal(byType(items, "REPORT_SUBMITTED").length, 1);
    assert.equal(await AuditEvent.count(), before + 1);
  });

  it("retry with same eventKey does not duplicate", async () => {
    const report = await makeReport(adminToken, "DUP");
    const before = await AuditEvent.count({ where: { reportId: report.id } });
    const first = await auditService.createAuditEvent({
      reportId: report.id,
      actorUserId: workerAId,
      actorType: "USER",
      eventType: "REPORT_SUBMITTED",
      eventKey: `REPORT_SUBMITTED:${report.id}`,
      description: "duplicate attempt",
    });
    const second = await auditService.createAuditEvent({
      reportId: report.id,
      actorUserId: workerAId,
      actorType: "USER",
      eventType: "REPORT_SUBMITTED",
      eventKey: `REPORT_SUBMITTED:${report.id}`,
      description: "duplicate attempt",
    });
    assert.equal(first.id, second.id);
    assert.equal(await AuditEvent.count({ where: { reportId: report.id } }), before);
  });

  it("metadata sanitizer strips credentials and tokens", async () => {
    const report = await makeReport(adminToken, "SAN");
    const ev = await auditService.createAuditEvent({
      reportId: report.id,
      actorUserId: null,
      actorType: "SYSTEM",
      eventType: "REPORT_UPDATED",
      eventKey: `SANITIZE-TEST:${report.id}`,
      description: "sanitize check",
      metadata: { changedFields: ["activity"], passwordHash: "abc", jwt: "xyz", nested: { refreshToken: "r" } },
    });
    assert.deepEqual(ev.metadata.changedFields, ["activity"]);
    assert.ok(!("passwordHash" in ev.metadata));
    assert.ok(!("jwt" in ev.metadata));
    assert.ok(!("refreshToken" in (ev.metadata.nested || {})));
  });
});

describe("W9.6 AI assessment audit", () => {
  it("5. legacy AI run records STARTED + COMPLETED with AI actor", async () => {
    const report = await makeReport(adminToken, "AI1");
    const stub = await stubAI((rq, rs) => json(rs, 200, LEGACY_AI));
    try {
      const r = await req("POST", `/analysis/reports/${report.id}`, { token: reviewerToken });
      assert.equal(r.status, 200);
      const items = await auditFor(report.id, adminToken);
      const started = byType(items, "AI_ASSESSMENT_STARTED");
      const done = byType(items, "AI_ASSESSMENT_COMPLETED");
      assert.equal(started.length, 1);
      assert.equal(done.length, 1);
      assert.equal(started[0].actorType, "AI");
      assert.equal(started[0].actorUserId, null);
      assert.equal(done[0].actorType, "AI");
      assert.equal(done[0].actorUserId, null);
      assert.ok(done[0].metadata.analysisId);
    } finally {
      await closeSrv(stub);
    }
  });

  it("6-7. PRIORITY route stores route, riskScore, sifPotential, primaryRule", async () => {
    const report = await makeReport(adminToken, "AI2");
    const stub = await stubAI((rq, rs) => json(rs, 200, layeredAssess("PRIORITY", 0.99, "YES")));
    try {
      const r = await req("POST", `/analysis/reports/${report.id}`, { token: reviewerToken });
      assert.equal(r.status, 200);
      const items = await auditFor(report.id, adminToken);
      const done = byType(items, "AI_ASSESSMENT_COMPLETED");
      assert.equal(done.length, 1);
      assert.equal(done[0].metadata.route, "PRIORITY");
      assert.equal(done[0].metadata.riskScore, 0.99);
      assert.equal(done[0].metadata.sifPotential, true);
      assert.equal(done[0].metadata.primaryRule, "ENERGY_ISOLATION");
    } finally {
      await closeSrv(stub);
    }
  });

  it("8. AUTO_CLOSE creates REPORT_AUTO_CLOSED without a duplicate REPORT_CLOSED", async () => {
    const report = await makeReport(adminToken, "AI3");
    const stub = await stubAI((rq, rs) => json(rs, 200, layeredAssess("AUTO_CLOSE", 0.05, "NO")));
    try {
      const r = await req("POST", `/analysis/reports/${report.id}`, { token: reviewerToken });
      assert.equal(r.status, 200);
      assert.equal(r.json.data.reportStatus, "CLOSED");
      const items = await auditFor(report.id, adminToken);
      const auto = byType(items, "REPORT_AUTO_CLOSED");
      assert.equal(auto.length, 1);
      assert.equal(auto[0].actorType, "AI");
      assert.equal(auto[0].newStatus, "CLOSED");
      assert.equal(auto[0].metadata.route, "AUTO_CLOSE");
      assert.equal(byType(items, "REPORT_CLOSED").length, 0);
    } finally {
      await closeSrv(stub);
    }
  });

  it("AI failure records AI_ASSESSMENT_FAILED without internals", async () => {
    const report = await makeReport(adminToken, "AI4");
    const stub = await stubAI((rq, rs) => json(rs, 500, { error: "boom" }));
    try {
      const r = await req("POST", `/analysis/reports/${report.id}`, { token: reviewerToken });
      assert.equal(r.status, 502);
      const items = await auditFor(report.id, adminToken);
      const failed = byType(items, "AI_ASSESSMENT_FAILED");
      assert.equal(failed.length, 1);
      assert.equal(failed[0].actorType, "AI");
      const blob = JSON.stringify(failed[0]);
      assert.ok(!blob.includes("at Object"));
      assert.ok(!blob.includes("node_modules"));
    } finally {
      await closeSrv(stub);
    }
  });

  it("re-analysis does not duplicate STARTED/COMPLETED events", async () => {
    const report = await makeReport(adminToken, "AI5");
    const stub = await stubAI((rq, rs) => json(rs, 200, LEGACY_AI));
    try {
      assert.equal((await req("POST", `/analysis/reports/${report.id}`, { token: reviewerToken })).status, 200);
      assert.equal((await req("POST", `/analysis/reports/${report.id}`, { token: adminToken })).status, 200);
      const items = await auditFor(report.id, adminToken);
      assert.equal(byType(items, "AI_ASSESSMENT_STARTED").length, 1);
      assert.equal(byType(items, "AI_ASSESSMENT_COMPLETED").length, 1);
      assert.equal(await AIAnalysis.count({ where: { reportId: report.id } }), 1);
    } finally {
      await closeSrv(stub);
    }
  });
});

describe("W9.6 HSE review audit", () => {
  async function analyzedReport(tag) {
    const report = await makeReport(adminToken, tag);
    const stub = await stubAI((rq, rs) => json(rs, 200, LEGACY_AI));
    try {
      assert.equal((await req("POST", `/analysis/reports/${report.id}`, { token: reviewerToken })).status, 200);
    } finally {
      await closeSrv(stub);
    }
    return report;
  }

  it("9. first review records HSE_REVIEW_STARTED", async () => {
    const report = await analyzedReport("RV1");
    const r = await req("POST", "/reviews", {
      token: reviewerToken,
      body: { reportId: report.id, hseDecision: "NEEDS_MORE_INFO", comment: "Isolation verification required." },
    });
    assert.equal(r.status, 201);
    const items = await auditFor(report.id, adminToken);
    const started = byType(items, "HSE_REVIEW_STARTED");
    assert.equal(started.length, 1);
    assert.equal(started[0].actorUserId, reviewerId);
    assert.equal(started[0].actorType, "HSE");
    assert.equal(started[0].previousStatus, "ANALYZED");
    assert.equal(started[0].newStatus, "UNDER_REVIEW");
  });

  it("10. NEEDS_MORE_INFO records decision, comment, statuses", async () => {
    const report = await analyzedReport("RV2");
    const r = await req("POST", "/reviews", {
      token: reviewerToken,
      body: { reportId: report.id, hseDecision: "NEEDS_MORE_INFO", comment: "Isolation verification required." },
    });
    assert.equal(r.status, 201);
    const items = await auditFor(report.id, adminToken);
    const ev = byType(items, "HSE_NEEDS_MORE_INFO");
    assert.equal(ev.length, 1);
    assert.equal(ev[0].actorUserId, reviewerId);
    assert.equal(ev[0].previousStatus, "ANALYZED");
    assert.equal(ev[0].newStatus, "UNDER_REVIEW");
    assert.equal(ev[0].metadata.decision, "NEEDS_MORE_INFO");
    assert.equal(ev[0].metadata.comment, "Isolation verification required.");
  });

  it("worker sees worker-safe history on own report (incl. HSE comment)", async () => {
    const owned = await makeWorkerReport(workerAToken);
    const stub = await stubAI((rq, rs) => json(rs, 200, LEGACY_AI));
    try {
      assert.equal((await req("POST", `/analysis/reports/${owned.id}`, { token: reviewerToken })).status, 200);
    } finally {
      await closeSrv(stub);
    }
    await req("POST", "/reviews", {
      token: reviewerToken,
      body: { reportId: owned.id, hseDecision: "NEEDS_MORE_INFO", comment: "Isolation verification required." },
    });
    const items = await auditFor(owned.id, workerAToken);
    const types = items.map((e) => e.eventType);
    assert.ok(types.includes("REPORT_SUBMITTED"));
    assert.ok(types.includes("AI_ASSESSMENT_COMPLETED"));
    assert.ok(types.includes("HSE_NEEDS_MORE_INFO"));
    const blob = JSON.stringify(items);
    assert.ok(blob.includes("Isolation verification required."));
    assert.ok(!blob.includes("passwordHash"));
  });

  it("11. CONFIRMED closes without duplicate REPORT_CLOSED", async () => {
    const report = await analyzedReport("RV3");
    await req("POST", "/reviews", { token: reviewerToken, body: { reportId: report.id, hseDecision: "NEEDS_MORE_INFO" } });
    const r = await req("POST", "/reviews", { token: reviewerToken, body: { reportId: report.id, hseDecision: "CONFIRMED" } });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.reportStatus, "CLOSED");
    const items = await auditFor(report.id, adminToken);
    assert.equal(byType(items, "HSE_REVIEW_CONFIRMED").length, 1);
    assert.equal(byType(items, "HSE_REVIEW_CONFIRMED")[0].newStatus, "CLOSED");
    assert.equal(byType(items, "REPORT_CLOSED").length, 0);
    // Second review on the same report creates no second REVIEW_STARTED.
    assert.equal(byType(items, "HSE_REVIEW_STARTED").length, 1);
  });

  it("12. REJECTED records decision and CLOSED", async () => {
    const report = await analyzedReport("RV4");
    const r = await req("POST", "/reviews", { token: reviewerToken, body: { reportId: report.id, hseDecision: "REJECTED" } });
    assert.equal(r.status, 201);
    const items = await auditFor(report.id, adminToken);
    const ev = byType(items, "HSE_REVIEW_REJECTED");
    assert.equal(ev.length, 1);
    assert.equal(ev[0].newStatus, "CLOSED");
  });
});

describe("W9.6 report updates audit", () => {
  it("REPORT_UPDATED stores changed field names only", async () => {
    const report = await makeReport(adminToken, "UPD");
    const r = await req("PATCH", `/reports/${report.id}`, {
      token: adminToken,
      body: { activity: "Electrical Maintenance Updated", location: "Bay 3" },
    });
    assert.equal(r.status, 200);
    const items = await auditFor(report.id, adminToken);
    const ev = byType(items, "REPORT_UPDATED");
    assert.equal(ev.length, 1);
    assert.deepEqual([...ev[0].metadata.changedFields].sort(), ["activity", "location"]);
    const blob = JSON.stringify(ev[0]);
    assert.ok(!blob.includes("passwordHash"));
  });
});

describe("W9.6 audit API: ordering, pagination, security", () => {
  it("15-16. history ordered DESC and paginated", async () => {
    const report = await analyzedReport2("PG1");
    const p1 = await req("GET", `/reports/${report.id}/audit?page=1&limit=2`, { token: adminToken });
    assert.equal(p1.status, 200);
    assert.equal(p1.json.data.items.length, 2);
    assert.ok(p1.json.data.pagination.total >= 3);
    assert.equal(p1.json.data.pagination.limit, 2);
    const times = p1.json.data.items.map((e) => new Date(e.createdAt).getTime());
    assert.ok(times[0] >= times[1], "DESC order");
    const p2 = await req("GET", `/reports/${report.id}/audit?page=2&limit=2`, { token: adminToken });
    assert.equal(p2.status, 200);
    const ids1 = new Set(p1.json.data.items.map((e) => e.id));
    for (const e of p2.json.data.items) assert.ok(!ids1.has(e.id), "pages do not overlap");
  });

  it("17-19. ownership: worker reads own, 404 for others, HSE allowed, 401 anonymous", async () => {
    const own = await makeWorkerReport(workerAToken);
    const other = await makeWorkerReport(workerBToken);
    assert.equal((await req("GET", `/reports/${own.id}/audit`, { token: workerAToken })).status, 200);
    assert.equal((await req("GET", `/reports/${other.id}/audit`, { token: workerAToken })).status, 404);
    assert.equal((await req("GET", `/reports/${own.id}/audit`, { token: reviewerToken })).status, 200);
    assert.equal((await req("GET", `/reports/${own.id}/audit`)).status, 401);
    assert.equal((await req("GET", "/reports/not-a-uuid/audit", { token: adminToken })).status, 400);
  });

  it("21-22. no mutation endpoints for audit events", async () => {
    const report = await makeReport(adminToken, "IMM");
    for (const method of ["PATCH", "PUT", "DELETE"]) {
      const r = await req(method, `/reports/${report.id}/audit`, { token: adminToken });
      assert.equal(r.status, 404, `${method} must not exist`);
    }
    const items = await auditFor(report.id, adminToken);
    const r = await req("PATCH", `/audit/${items[0].id}`, { token: adminToken, body: {} });
    assert.equal(r.status, 404);
  });

  it("response exposes no credentials", async () => {
    const report = await makeReport(adminToken, "PRV");
    const items = await auditFor(report.id, adminToken);
    const blob = JSON.stringify(items);
    for (const secret of ["passwordHash", "refreshToken", "Bearer ", "jwt"]) {
      assert.ok(!blob.includes(secret), `leak: ${secret}`);
    }
    assert.ok(items[0].actor === null || items[0].actor.passwordHash === undefined);
  });
});

async function analyzedReport2(tag) {
  const report = await makeReport(adminToken, tag);
  const stub = await stubAI((rq, rs) => json(rs, 200, LEGACY_AI));
  try {
    assert.equal((await req("POST", `/analysis/reports/${report.id}`, { token: reviewerToken })).status, 200);
  } finally {
    await closeSrv(stub);
  }
  return report;
}
