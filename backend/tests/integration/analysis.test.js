"use strict";

// Step 5 tests: AI/NLP orchestration. The Python service is MOCKED with
// tiny node:http stubs — no live AI server required for this suite.
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.JWT_SECRET = "analysis-test-secret";
process.env.SYNC_DB = "true";
process.env.AI_SERVICE_URL = "http://127.0.0.1:1"; // unreachable by default

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const env = require("../../src/config/env");
const app = require("../../src/app");
const { sequelize, User, Report, AIAnalysis } = require("../../src/models");

const VALID_AI = {
  sifPotential: true,
  confidence: 0.82,
  activity: "Maintenance",
  hazard: "Uncontrolled Energy",
  barrierFailure: "Energy Isolation",
  consequence: "Electrocution",
  lifeSavingRuleCode: "PROTO-TEST-RULE",
  priority: "HIGH",
  evidence: ["without isolating the electrical supply"],
  extractedEntities: {
    equipment: ["Pump P-101"],
    hazards: ["Uncontrolled Energy"],
    barriers: ["Energy Isolation"],
    activities: ["Maintenance"],
  },
  modelName: "prototype",
  modelVersion: "0.1.0",
};

const DESCRIPTION =
  "Technician opened the pump without isolating the electrical supply in the process area.";

let server;
let base;
let adminToken;
let reviewerToken;
let userToken;
let siteId;
let lastRequestBody = null;

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

// Stub "Python" server with a programmable responder.
function stubAI(responder) {
  const srv = http.createServer((rq, rs) => {
    let data = "";
    rq.on("data", (c) => { data += c; });
    rq.on("end", () => {
      try {
        lastRequestBody = JSON.parse(data);
      } catch {
        lastRequestBody = null;
      }
      responder(rq, rs, lastRequestBody);
    });
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

async function register(name, email) {
  const r = await req("POST", "/auth/register", {
    body: { name, email, password: "StrongPassword123" },
  });
  assert.equal(r.status, 201);
  return r.json.data.token;
}

async function makeReport(token, n, description = DESCRIPTION) {
  const r = await req("POST", "/reports", {
    token,
    body: {
      reportNumber: `OIL-A-${n}`,
      date: "2026-09-20",
      siteId,
      activity: "Maintenance",
      reportType: "NEAR_MISS",
      description,
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

  userToken = await register("Analysis User", "analysis-user@example.com");
  reviewerToken = await register("Analysis Reviewer", "analysis-reviewer@example.com");
  adminToken = await register("Analysis Admin", "analysis-admin@example.com");
  await User.update({ role: "HSE_REVIEWER" }, { where: { email: "analysis-reviewer@example.com" } });
  await User.update({ role: "HSE_ADMIN" }, { where: { email: "analysis-admin@example.com" } });
  const login = async (email) =>
    (await req("POST", "/auth/login", { body: { email, password: "StrongPassword123" } })).json.data.token;
  reviewerToken = await login("analysis-reviewer@example.com");
  adminToken = await login("analysis-admin@example.com");

  const site = await req("POST", "/sites", {
    token: adminToken,
    body: { name: "Analysis Site", code: "ASITE" },
  });
  siteId = site.json.data.site.id;

  // Rule the stub references — proves code->id resolution.
  await req("POST", "/rules", {
    token: adminToken,
    body: { name: "Prototype test rule", code: "PROTO-TEST-RULE", description: "test-only prototype rule" },
  });

  env.aiTimeoutMs = 2000;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
});

describe("analysis auth + request validation", () => {
  it("401 without JWT, 401 with invalid JWT, 403 for USER", async () => {
    const id = await makeReport(adminToken, "auth1");
    const stub = await stubAI((rq, rs) => json(rs, 200, VALID_AI));
    try {
      assert.equal((await req("POST", `/analysis/reports/${id}`)).status, 401);
      assert.equal((await req("POST", `/analysis/reports/${id}`, { token: "bad.token.here" })).status, 401);
      assert.equal((await req("POST", `/analysis/reports/${id}`, { token: userToken })).status, 403);
    } finally {
      await closeSrv(stub);
    }
  });

  it("404 for unknown report, 400 for malformed UUID", async () => {
    assert.equal(
      (await req("POST", "/analysis/reports/123e4567-e89b-42d3-a456-426614174000", { token: reviewerToken })).status,
      404
    );
    assert.equal((await req("POST", "/analysis/reports/not-a-uuid", { token: reviewerToken })).status, 400);
  });

  it("422 for empty description", async () => {
    const id = await makeReport(adminToken, "empty1");
    await Report.update({ description: "   " }, { where: { id } });
    const stub = await stubAI((rq, rs) => json(rs, 200, VALID_AI));
    try {
      const r = await req("POST", `/analysis/reports/${id}`, { token: reviewerToken });
      assert.equal(r.status, 422);
      assert.equal(r.json.error.code, "REPORT_DESCRIPTION_EMPTY");
    } finally {
      await closeSrv(stub);
    }
  });
});

describe("analysis success path", () => {
  it("persists COMPLETED analysis, resolves rule, leaves description intact, NEW->ANALYZED", async () => {
    const id = await makeReport(adminToken, "ok1");
    lastRequestBody = null;
    const stub = await stubAI((rq, rs) => json(rs, 200, VALID_AI));
    try {
      const r = await req("POST", `/analysis/reports/${id}`, { token: reviewerToken });
      assert.equal(r.status, 200);
      assert.equal(r.json.data.reportStatus, "ANALYZED");
      const a = r.json.data.analysis;
      assert.equal(a.analysisStatus, "COMPLETED");
      assert.equal(a.sifPotential, true);
      assert.equal(a.confidence, 0.82);
      assert.equal(a.modelName, "prototype");
      assert.equal(a.modelVersion, "0.1.0");
      assert.ok(a.lifeSavingRuleId, "rule code resolved to id");
      assert.deepEqual(a.evidence, ["without isolating the electrical supply"]);
      // Contract: backend sends DB text, never client text.
      assert.equal(lastRequestBody.record_id, id);
      assert.equal(lastRequestBody.text, DESCRIPTION);
      const stored = await Report.findByPk(id);
      assert.equal(stored.description, DESCRIPTION);
      assert.equal(stored.status, "ANALYZED");
    } finally {
      await closeSrv(stub);
    }
  });

  it("stores null rule id for unknown lifeSavingRuleCode", async () => {
    const id = await makeReport(adminToken, "ok2");
    const stub = await stubAI((rq, rs) => json(rs, 200, { ...VALID_AI, lifeSavingRuleCode: "NO-SUCH-RULE" }));
    try {
      const r = await req("POST", `/analysis/reports/${id}`, { token: reviewerToken });
      assert.equal(r.status, 200);
      assert.equal(r.json.data.analysis.lifeSavingRuleId, null);
    } finally {
      await closeSrv(stub);
    }
  });

  it("re-analysis updates the same row (no duplicates)", async () => {
    const id = await makeReport(adminToken, "ok3");
    const stub = await stubAI((rq, rs) => json(rs, 200, VALID_AI));
    try {
      await req("POST", `/analysis/reports/${id}`, { token: reviewerToken });
      const second = await req("POST", `/analysis/reports/${id}`, { token: adminToken });
      assert.equal(second.status, 200);
      assert.equal(await AIAnalysis.count({ where: { reportId: id } }), 1);
      assert.equal(second.json.data.reportStatus, "ANALYZED");
    } finally {
      await closeSrv(stub);
    }
  });

  it("does not move UNDER_REVIEW or CLOSED reports", async () => {
    const under = await makeReport(adminToken, "ok4");
    await Report.update({ status: "UNDER_REVIEW" }, { where: { id: under } });
    const closed = await makeReport(adminToken, "ok5");
    await Report.update({ status: "CLOSED" }, { where: { id: closed } });
    const stub = await stubAI((rq, rs) => json(rs, 200, VALID_AI));
    try {
      const r1 = await req("POST", `/analysis/reports/${under}`, { token: reviewerToken });
      assert.equal(r1.json.data.reportStatus, "UNDER_REVIEW");
      const r2 = await req("POST", `/analysis/reports/${closed}`, { token: reviewerToken });
      assert.equal(r2.status, 200);
      assert.equal(r2.json.data.reportStatus, "CLOSED");
    } finally {
      await closeSrv(stub);
    }
  });
});

describe("analysis failure paths", () => {
  it("503 when Python is unavailable + FAILED row persisted", async () => {
    env.aiServiceUrl = "http://127.0.0.1:1"; // nothing listens here
    const id = await makeReport(adminToken, "f1");
    const r = await req("POST", `/analysis/reports/${id}`, { token: reviewerToken });
    assert.equal(r.status, 503);
    assert.equal(r.json.error.code, "AI_SERVICE_UNAVAILABLE");
    const row = await AIAnalysis.findOne({ where: { reportId: id } });
    assert.equal(row.analysisStatus, "FAILED");
  });

  it("504 on Python timeout", async () => {
    env.aiTimeoutMs = 300;
    const stub = await stubAI((rq, rs) => setTimeout(() => json(rs, 200, VALID_AI), 1500));
    try {
      const id = await makeReport(adminToken, "f2");
      const r = await req("POST", `/analysis/reports/${id}`, { token: reviewerToken });
      assert.equal(r.status, 504);
      assert.equal(r.json.error.code, "AI_SERVICE_TIMEOUT");
    } finally {
      env.aiTimeoutMs = 2000;
      await closeSrv(stub);
    }
  });

  it("502 on Python 4xx / 5xx", async () => {
    const s4 = await stubAI((rq, rs) => json(rs, 422, { error: "bad" }));
    const id1 = await makeReport(adminToken, "f3");
    assert.equal((await req("POST", `/analysis/reports/${id1}`, { token: reviewerToken })).status, 502);
    await closeSrv(s4);
    const s5 = await stubAI((rq, rs) => json(rs, 500, { error: "boom" }));
    const id2 = await makeReport(adminToken, "f4");
    const r = await req("POST", `/analysis/reports/${id2}`, { token: reviewerToken });
    assert.equal(r.status, 502);
    assert.equal(r.json.error.code, "AI_SERVICE_BAD_RESPONSE");
    await closeSrv(s5);
  });

  it("502 on malformed JSON", async () => {
    const stub = await stubAI((rq, rs) => {
      rs.writeHead(200, { "Content-Type": "text/html" });
      rs.end("<html>not json");
    });
    try {
      const id = await makeReport(adminToken, "f5");
      assert.equal((await req("POST", `/analysis/reports/${id}`, { token: reviewerToken })).status, 502);
    } finally {
      await closeSrv(stub);
    }
  });

  it("502 on invalid schema: confidence, priority, empty/fabricated evidence", async () => {
    const cases = [
      { ...VALID_AI, confidence: 1.5 },
      { ...VALID_AI, priority: "EXTREME" },
      { ...VALID_AI, evidence: [] },
      { ...VALID_AI, evidence: ["completely invented phrase never written"] },
      { ...VALID_AI, sifPotential: "yes" },
    ];
    for (let i = 0; i < cases.length; i++) {
      const payload = cases[i];
      const stub = await stubAI((rq, rs) => json(rs, 200, payload));
      try {
        const id = await makeReport(adminToken, `f6${i}`);
        const r = await req("POST", `/analysis/reports/${id}`, { token: reviewerToken });
        assert.equal(r.status, 502, `case ${i} should be 502`);
        assert.ok(["AI_RESPONSE_VALIDATION_FAILED", "AI_SERVICE_BAD_RESPONSE"].includes(r.json.error.code));
        const row = await AIAnalysis.findOne({ where: { reportId: id } });
        assert.equal(row.analysisStatus, "FAILED");
      } finally {
        await closeSrv(stub);
      }
    }
  });

  it("keeps previous COMPLETED data when re-analysis fails", async () => {
    const id = await makeReport(adminToken, "f7");
    const good = await stubAI((rq, rs) => json(rs, 200, VALID_AI));
    await req("POST", `/analysis/reports/${id}`, { token: reviewerToken });
    await closeSrv(good);
    const bad = await stubAI((rq, rs) => json(rs, 200, { ...VALID_AI, confidence: 9 }));
    try {
      const r = await req("POST", `/analysis/reports/${id}`, { token: reviewerToken });
      assert.equal(r.status, 502);
      const row = await AIAnalysis.findOne({ where: { reportId: id } });
      assert.equal(row.analysisStatus, "FAILED");
      assert.equal(row.confidence, 0.82, "previous valid payload preserved");
    } finally {
      await closeSrv(bad);
    }
  });
});
