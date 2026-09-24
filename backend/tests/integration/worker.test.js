"use strict";

// Phase 8 tests: Worker Portal RBAC + ownership. The Python service is MOCKED
// with tiny node:http stubs — no live AI server required for this suite.
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.JWT_SECRET = "worker-test-secret";
process.env.SYNC_DB = "true";
process.env.AI_SERVICE_URL = "http://127.0.0.1:1"; // unreachable by default

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const env = require("../../src/config/env");
const app = require("../../src/app");
const { sequelize, User, AIAnalysis } = require("../../src/models");

let server;
let base;
let workerAToken;
let workerBToken;
let reviewerToken;
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

function stubAI(responder) {
  const srv = http.createServer((rq, rs) => {
    let data = "";
    rq.on("data", (c) => { data += c; });
    rq.on("end", () => responder(rq, rs, data));
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

const VALID_ASSESS = {
  schemaVersion: "sif-assessment-1.0.0",
  recordId: "REPORT_ID",
  metadata: { scoreKind: "heuristic-prototype" },
  receivedAt: "2026-09-21T00:00:00.000Z",
  processedAt: "2026-09-21T00:00:00.010Z",
  processingMs: 10,
  triage: {
    route: "PRIORITY",
    requiresHumanReview: true,
    escalatedToExtraction: true,
    riskScore: 0.9,
    ruleBasedSignal: {
      triggered: true,
      matchedRules: [{ code: "SIF-PROTOTYPE-WORKING-AT-HEIGHT", phrase: "without harness" }],
    },
  },
  assessment: {
    sifPotential: "YES",
    activity: "Work at Height",
    primaryRule: "SIF-PROTOTYPE-WORKING-AT-HEIGHT",
    secondaryRules: [],
    hazardEnergy: "Gravity",
    eventStatus: "UNSAFE_ACT",
    barriersFailed: ["Fall protection not used"],
    assets: ["scaffold"],
    rationale: "Worker exposed at height without harness.",
    evidence: ["without harness"],
  },
  extraction: { status: "success", modelVersion: "sif-engine-1.0.0+rulebased", repairAttempts: 0, failureReason: null },
  clarificationRequest: null,
};

const DESC = "Worker was working at height on the scaffold without harness near unit 2.";

function workerPayload(overrides = {}) {
  return {
    date: "2026-09-20",
    siteId,
    activity: "Maintenance",
    reportType: "NEAR_MISS",
    description: DESC,
    ...overrides,
  };
}

before(async () => {
  await sequelize.sync({ force: true });
  server = app.listen(0);
  await new Promise((resolve) => server.on("listening", resolve));
  base = `http://localhost:${server.address().port}/api/v1`;

  for (const [name, email] of [["Worker A", "worker-a@example.com"], ["Worker B", "worker-b@example.com"], ["Worker Reviewer", "worker-reviewer@example.com"]]) {
    const r = await req("POST", "/auth/register", { body: { name, email, password: "StrongPassword123" } });
    assert.equal(r.status, 201);
  }
  await User.update({ role: "HSE_REVIEWER" }, { where: { email: "worker-reviewer@example.com" } });
  const login = async (email) =>
    (await req("POST", "/auth/login", { body: { email, password: "StrongPassword123" } })).json.data.token;
  workerAToken = await login("worker-a@example.com");
  workerBToken = await login("worker-b@example.com");
  reviewerToken = await login("worker-reviewer@example.com");

  const site = await req("POST", "/sites", {
    token: reviewerToken,
    body: { name: "Worker Site", code: "WSITE" },
  });
  // Sites require HSE_ADMIN; reviewer gets 403 -> create via admin promotion.
  if (site.status !== 201) {
    await User.update({ role: "HSE_ADMIN" }, { where: { email: "worker-reviewer@example.com" } });
    reviewerToken = await login("worker-reviewer@example.com");
    const retry = await req("POST", "/sites", {
      token: reviewerToken,
      body: { name: "Worker Site", code: "WSITE" },
    });
    assert.equal(retry.status, 201);
    siteId = retry.json.data.site.id;
  } else {
    siteId = site.json.data.site.id;
  }
  env.aiTimeoutMs = 2000;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
});

describe("worker report submission", () => {
  it("401 without JWT; USER can create with auto-generated number", async () => {
    assert.equal((await req("POST", "/worker/reports", { body: workerPayload() })).status, 401);
    const r = await req("POST", "/worker/reports", { token: workerAToken, body: workerPayload() });
    assert.equal(r.status, 201);
    assert.ok(/^WRK-\d{8}-[0-9A-F]{4}$/.test(r.json.data.report.reportNumber));
    assert.equal(r.json.data.report.status, "NEW");
  });

  it("rejects invalid input: missing type/site, empty/short description", async () => {
    const cases = [
      { ...workerPayload(), reportType: undefined },
      { ...workerPayload(), siteId: "not-a-uuid" },
      { ...workerPayload(), description: "   " },
      { ...workerPayload(), description: "too short" },
      { ...workerPayload(), activity: "x" },
    ];
    for (const body of cases) {
      const r = await req("POST", "/worker/reports", { token: workerAToken, body });
      assert.equal(r.status, 400, JSON.stringify(body).slice(0, 80));
    }
  });

  it("ignores client-supplied reportNumber/createdBy (strict schema)", async () => {
    const r = await req("POST", "/worker/reports", {
      token: workerAToken,
      body: { ...workerPayload(), reportNumber: "HACK-1", createdBy: "hacker", status: "CLOSED" },
    });
    assert.equal(r.status, 400);
  });
});

describe("worker ownership (IDOR)", () => {
  it("lists only own reports; detail of another worker's report is 404 without data", async () => {
    const a = await req("POST", "/worker/reports", { token: workerAToken, body: workerPayload() });
    const idA = a.json.data.report.id;
    const b = await req("POST", "/worker/reports", { token: workerBToken, body: workerPayload() });
    const idB = b.json.data.report.id;

    const listA = await req("GET", "/worker/reports", { token: workerAToken });
    assert.equal(listA.status, 200);
    assert.ok(listA.json.data.items.length >= 1);
    assert.ok(listA.json.data.items.every((r) => r.reportNumber.startsWith("WRK-")));
    // B's report must not appear in A's list.
    assert.ok(!listA.json.data.items.some((r) => r.id === idB));

    const cross = await req("GET", `/worker/reports/${idB}`, { token: workerAToken });
    assert.equal(cross.status, 404);
    assert.ok(!JSON.stringify(cross.json).includes(DESC.slice(0, 20)));

    // Legacy endpoints enforce the same ownership for USER role.
    const legacyCross = await req("GET", `/reports/${idB}`, { token: workerAToken });
    assert.equal(legacyCross.status, 404);
    const legacyList = await req("GET", "/reports", { token: workerAToken });
    assert.ok(legacyList.json.data.items.every((r) => r.id !== idB));

    // ...while the owner and HSE still see it.
    assert.equal((await req("GET", `/worker/reports/${idA}`, { token: workerAToken })).status, 200);
    assert.equal((await req("GET", `/reports/${idB}`, { token: reviewerToken })).status, 200);
  });

  it("USER cannot PATCH status or description; cannot touch foreign reports", async () => {
    const a = await req("POST", "/worker/reports", { token: workerAToken, body: workerPayload() });
    const idA = a.json.data.report.id;
    const b = await req("POST", "/worker/reports", { token: workerBToken, body: workerPayload() });
    const idB = b.json.data.report.id;

    assert.equal((await req("PATCH", `/reports/${idA}`, { token: workerAToken, body: { status: "CLOSED" } })).status, 403);
    assert.equal((await req("PATCH", `/reports/${idA}`, { token: workerAToken, body: { description: "rewritten" } })).status, 422);
    assert.equal((await req("PATCH", `/reports/${idB}`, { token: workerAToken, body: { location: "x" } })).status, 404);
  });

  it("USER cannot access HSE review or analysis controls", async () => {
    const a = await req("POST", "/worker/reports", { token: workerAToken, body: workerPayload() });
    const idA = a.json.data.report.id;
    assert.equal((await req("POST", "/reviews", { token: workerAToken, body: { reportId: idA, hseDecision: "CONFIRMED" } })).status, 403);
    assert.equal((await req("POST", `/analysis/reports/${idA}`, { token: workerAToken })).status, 403);
  });
});

describe("worker visibility of AI + HSE outcomes", () => {
  it("submission flows through Phase 7 when HSE analyzes; worker sees read-only AI data", async () => {
    const created = await req("POST", "/worker/reports", { token: workerAToken, body: workerPayload() });
    const id = created.json.data.report.id;
    const stub = await stubAI((rq, rs) => json(rs, 200, VALID_ASSESS));
    try {
      const an = await req("POST", `/analysis/reports/${id}`, { token: reviewerToken });
      assert.equal(an.status, 200);
      const detail = await req("GET", `/worker/reports/${id}`, { token: workerAToken });
      assert.equal(detail.status, 200);
      const ai = detail.json.data.report.aiAnalysis;
      assert.equal(ai.route, "PRIORITY");
      assert.equal(ai.riskScore, 0.9);
      assert.equal(ai.primaryRule, "SIF-PROTOTYPE-WORKING-AT-HEIGHT");
      assert.deepEqual(ai.evidence, ["without harness"]);
      assert.equal(detail.json.data.report.latestReview, null);
    } finally {
      await closeSrv(stub);
    }
  });

  it("AI failure stores FAILED with no fake SIF verdict for the worker", async () => {
    env.aiServiceUrl = "http://127.0.0.1:1";
    const created = await req("POST", "/worker/reports", { token: workerAToken, body: workerPayload() });
    const id = created.json.data.report.id;
    const stub = await stubAI((rq, rs) => json(rs, 200, VALID_ASSESS));
    try {
      // Point at nothing: service unavailable.
      env.aiServiceUrl = "http://127.0.0.1:1";
      const an = await req("POST", `/analysis/reports/${id}`, { token: reviewerToken });
      assert.equal(an.status, 503);
      const row = await AIAnalysis.findOne({ where: { reportId: id } });
      assert.equal(row.analysisStatus, "FAILED");
      assert.equal(row.sifPotential, null);
      assert.equal(row.route, null);
    } finally {
      await closeSrv(stub);
    }
  });

  it("ABSTAIN surfaces clarification questions; summary counts are real", async () => {
    const abstain = {
      ...VALID_ASSESS,
      triage: { route: "ABSTAIN", requiresHumanReview: true, escalatedToExtraction: false, riskScore: 0.05, ruleBasedSignal: { triggered: false, matchedRules: [] } },
      assessment: {
        sifPotential: "INSUFFICIENT_INFORMATION", activity: null, primaryRule: null, secondaryRules: [],
        hazardEnergy: null, eventStatus: "UNKNOWN", barriersFailed: [], assets: [],
        rationale: "Insufficient information.", evidence: [],
      },
      extraction: { status: "skipped", modelVersion: null, repairAttempts: 0, failureReason: null },
      clarificationRequest: { reason: "insufficient information", suggestedQuestions: ["Was the equipment energized?"] },
    };
    const created = await req("POST", "/worker/reports", { token: workerAToken, body: workerPayload({ description: "Something unsafe was seen near the plant yesterday evening during rounds." }) });
    const id = created.json.data.report.id;
    const stub = await stubAI((rq, rs) => json(rs, 200, abstain));
    try {
      assert.equal((await req("POST", `/analysis/reports/${id}`, { token: reviewerToken })).status, 200);
      const detail = await req("GET", `/worker/reports/${id}`, { token: workerAToken });
      assert.equal(detail.json.data.report.aiAnalysis.route, "ABSTAIN");
      assert.deepEqual(detail.json.data.report.aiAnalysis.clarificationRequest.suggestedQuestions, ["Was the equipment energized?"]);
      const summary = await req("GET", "/worker/summary", { token: workerAToken });
      assert.equal(summary.status, 200);
      assert.ok(summary.json.data.myReports >= 3);
      assert.ok(summary.json.data.needsInformation >= 1);
    } finally {
      await closeSrv(stub);
    }
  });

  it("HSE review status is visible read-only; HSE flow unchanged", async () => {
    const created = await req("POST", "/worker/reports", { token: workerAToken, body: workerPayload() });
    const id = created.json.data.report.id;
    const rev = await req("POST", "/reviews", { token: reviewerToken, body: { reportId: id, hseDecision: "NEEDS_MORE_INFO", comment: "Please add the exact location.", reasonCode: "INSUFFICIENT_INFORMATION" } });
    assert.equal(rev.status, 201);
    const detail = await req("GET", `/worker/reports/${id}`, { token: workerAToken });
    assert.equal(detail.json.data.report.latestReview.hseDecision, "NEEDS_MORE_INFO");
    assert.equal(detail.json.data.report.latestReview.comment, "Please add the exact location.");
    const summary = await req("GET", "/worker/summary", { token: workerAToken });
    assert.ok(summary.json.data.underReview >= 1);
    assert.ok(summary.json.data.needsInformation >= 1);
  });
});
