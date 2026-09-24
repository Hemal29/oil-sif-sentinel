"use strict";

// Phase 7 tests: layered SIF assessment contract. The Python service is
// MOCKED with tiny node:http stubs — no live AI server required.
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.JWT_SECRET = "assess-test-secret";
process.env.SYNC_DB = "true";
process.env.AI_SERVICE_URL = "http://127.0.0.1:1"; // unreachable by default

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const env = require("../../src/config/env");
const app = require("../../src/app");
const { sequelize, User } = require("../../src/models");

const DESCRIPTION =
  "Technician opened the pump without isolating the electrical supply in the process area.";

function layeredAssess(overrides = {}) {
  return {
    schemaVersion: "sif-assessment-1.0.0",
    recordId: "REPORT_ID",
    metadata: { taxonomyVersion: "sif-taxonomy-1.0.0", scoreKind: "heuristic-prototype" },
    receivedAt: "2026-09-21T00:00:00.000Z",
    processedAt: "2026-09-21T00:00:00.010Z",
    processingMs: 10,
    triage: {
      route: "PRIORITY",
      requiresHumanReview: true,
      escalatedToExtraction: true,
      riskScore: 0.94,
      ruleBasedSignal: {
        triggered: true,
        matchedRules: [{ code: "SIF-PROTOTYPE-ENERGY-ISOLATION", phrase: "without isolating" }],
      },
    },
    assessment: {
      sifPotential: "YES",
      activity: "Maintenance",
      primaryRule: "SIF-PROTOTYPE-ENERGY-ISOLATION",
      secondaryRules: [],
      hazardEnergy: "Electrical",
      eventStatus: "UNSAFE_ACT",
      barriersFailed: ["Isolation not applied"],
      assets: ["pump"],
      rationale: "Matched rule SIF-PROTOTYPE-ENERGY-ISOLATION.",
      evidence: ["without isolating the electrical supply"],
    },
    extraction: {
      status: "success",
      modelVersion: "sif-engine-1.0.0+rulebased",
      repairAttempts: 0,
      failureReason: null,
    },
    clarificationRequest: null,
    ...overrides,
  };
}

const ABSTAIN_ASSESS = layeredAssess({
  triage: {
    route: "ABSTAIN",
    requiresHumanReview: true,
    escalatedToExtraction: false,
    riskScore: 0.05,
    ruleBasedSignal: { triggered: false, matchedRules: [] },
  },
  assessment: {
    sifPotential: "INSUFFICIENT_INFORMATION",
    activity: null,
    primaryRule: null,
    secondaryRules: [],
    hazardEnergy: null,
    eventStatus: "UNKNOWN",
    barriersFailed: [],
    assets: [],
    rationale: "Insufficient information.",
    evidence: [],
  },
  extraction: { status: "skipped", modelVersion: null, repairAttempts: 0, failureReason: null },
  clarificationRequest: {
    reason: "insufficient information for safe assessment",
    suggestedQuestions: ["What activity was being performed?"],
  },
});

const AUTO_CLOSE_ASSESS = layeredAssess({
  triage: {
    route: "AUTO_CLOSE",
    requiresHumanReview: false,
    escalatedToExtraction: false,
    riskScore: 0.05,
    ruleBasedSignal: { triggered: false, matchedRules: [] },
  },
  assessment: {
    sifPotential: "NO",
    activity: null,
    primaryRule: null,
    secondaryRules: [],
    hazardEnergy: null,
    eventStatus: "UNKNOWN",
    barriersFailed: [],
    assets: [],
    rationale: "No precursor signal.",
    evidence: [],
  },
  extraction: { status: "skipped", modelVersion: null, repairAttempts: 0, failureReason: null },
  clarificationRequest: null,
});

let server;
let base;
let adminToken;
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

before(async () => {
  await sequelize.sync({ force: true });
  server = app.listen(0);
  await new Promise((resolve) => server.on("listening", resolve));
  base = `http://localhost:${server.address().port}/api/v1`;

  await req("POST", "/auth/register", { body: { name: "Assess Admin", email: "assess-a@example.com", password: "StrongPassword123" } });
  await req("POST", "/auth/register", { body: { name: "Assess Reviewer", email: "assess-b@example.com", password: "StrongPassword123" } });
  await User.update({ role: "HSE_REVIEWER" }, { where: { email: "assess-b@example.com" } });
  await User.update({ role: "HSE_ADMIN" }, { where: { email: "assess-a@example.com" } });
  const login = async (email) =>
    (await req("POST", "/auth/login", { body: { email, password: "StrongPassword123" } })).json.data.token;
  adminToken = await login("assess-a@example.com");
  reviewerToken = await login("assess-b@example.com");

  const site = await req("POST", "/sites", {
    token: adminToken,
    body: { name: "Assess Site", code: "ASITE2" },
  });
  siteId = site.json.data.site.id;
  env.aiTimeoutMs = 2000;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
});

async function makeReport(n, description = DESCRIPTION) {
  const r = await req("POST", "/reports", {
    token: adminToken,
    body: {
      reportNumber: `OIL-S7-${n}`,
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

describe("layered assessment persistence", () => {
  it("PRIORITY persists route, risk, rules, extraction and legacy mapping", async () => {
    const id = await makeReport("p1");
    const stub = await stubAI((rq, rs) => json(rs, 200, layeredAssess()));
    try {
      const r = await req("POST", `/analysis/reports/${id}`, { token: reviewerToken });
      assert.equal(r.status, 200);
      const a = r.json.data.analysis;
      assert.equal(a.analysisStatus, "COMPLETED");
      assert.equal(a.route, "PRIORITY");
      assert.equal(a.riskScore, 0.94);
      assert.equal(a.requiresHumanReview, true);
      assert.equal(a.escalatedToExtraction, true);
      assert.equal(a.primaryRule, "SIF-PROTOTYPE-ENERGY-ISOLATION");
      assert.equal(a.hazardEnergy, "Electrical");
      assert.equal(a.eventStatus, "UNSAFE_ACT");
      assert.deepEqual(a.barriersFailed, ["Isolation not applied"]);
      assert.deepEqual(a.assets, ["pump"]);
      assert.equal(a.extractionStatus, "success");
      assert.equal(a.modelName, "sif-engine");
      assert.equal(a.modelVersion, "sif-engine-1.0.0+rulebased");
      assert.equal(a.clarificationRequest, null);
      // Legacy mapping keeps old consumers working.
      assert.equal(a.sifPotential, true);
      assert.equal(a.priority, "CRITICAL");
      assert.equal(a.confidence, 0.94);
      assert.deepEqual(a.evidence, ["without isolating the electrical supply"]);
    } finally {
      await closeSrv(stub);
    }
  });

  it("ABSTAIN stores null SIF, LOW priority and clarification questions", async () => {
    const id = await makeReport("a1");
    const stub = await stubAI((rq, rs) => json(rs, 200, ABSTAIN_ASSESS));
    try {
      const r = await req("POST", `/analysis/reports/${id}`, { token: reviewerToken });
      assert.equal(r.status, 200);
      const a = r.json.data.analysis;
      assert.equal(a.route, "ABSTAIN");
      assert.equal(a.sifPotential, null);
      assert.equal(a.priority, "LOW");
      assert.equal(a.clarificationRequest.reason, "insufficient information for safe assessment");
      assert.deepEqual(a.clarificationRequest.suggestedQuestions, ["What activity was being performed?"]);
    } finally {
      await closeSrv(stub);
    }
  });

  it("AUTO_CLOSE stores SIF=false, LOW priority, no review flag", async () => {
    const id = await makeReport("c1");
    const stub = await stubAI((rq, rs) => json(rs, 200, AUTO_CLOSE_ASSESS));
    try {
      const r = await req("POST", `/analysis/reports/${id}`, { token: reviewerToken });
      assert.equal(r.status, 200);
      const a = r.json.data.analysis;
      assert.equal(a.route, "AUTO_CLOSE");
      assert.equal(a.sifPotential, false);
      assert.equal(a.priority, "LOW");
      assert.equal(a.requiresHumanReview, false);
    } finally {
      await closeSrv(stub);
    }
  });
});

describe("layered assessment validation", () => {
  it("502 on fabricated evidence / bad route / missing clarification", async () => {
    const badEvidence = layeredAssess({
      assessment: { ...layeredAssess().assessment, evidence: ["invented phrase never written"] },
    });
    const badRoute = layeredAssess({ triage: { ...layeredAssess().triage, route: "MAYBE" } });
    const noClarify = { ...ABSTAIN_ASSESS, clarificationRequest: null };
    for (let i = 0; i < 3; i++) {
      const payload = [badEvidence, badRoute, noClarify][i];
      const stub = await stubAI((rq, rs) => json(rs, 200, payload));
      try {
        const id = await makeReport(`v${i}`);
        const r = await req("POST", `/analysis/reports/${id}`, { token: reviewerToken });
        assert.equal(r.status, 502, `case ${i} should be 502`);
      } finally {
        await closeSrv(stub);
      }
    }
  });

  it("falls back to legacy /analyze when the layered endpoint is missing", async () => {
    const legacy = {
      sifPotential: true,
      confidence: 0.8,
      activity: "Maintenance",
      hazard: "Uncontrolled Energy",
      barrierFailure: "Energy Isolation",
      consequence: "Electrocution",
      lifeSavingRuleCode: null,
      priority: "HIGH",
      evidence: ["without isolating the electrical supply"],
      extractedEntities: { equipment: [], hazards: [], barriers: [], activities: [] },
      modelName: "prototype",
      modelVersion: "0.1.0",
    };
    const stub = await stubAI((rq, rs) => {
      if (rq.url === "/v1/reports/assess") return json(rs, 404, { error: "not found" });
      return json(rs, 200, legacy);
    });
    try {
      const id = await makeReport("legacy1");
      const r = await req("POST", `/analysis/reports/${id}`, { token: reviewerToken });
      assert.equal(r.status, 200);
      assert.equal(r.json.data.analysis.sifPotential, true);
      assert.equal(r.json.data.analysis.modelName, "prototype");
      assert.equal(r.json.data.analysis.route, null);
    } finally {
      await closeSrv(stub);
    }
  });
});

describe("layered dashboard analytics", () => {
  it("serves precursor rules, barriers and energies from real rows", async () => {
    const id = await makeReport("d1");
    const stub = await stubAI((rq, rs) => json(rs, 200, layeredAssess()));
    try {
      await req("POST", `/analysis/reports/${id}`, { token: reviewerToken });
      for (const path of ["/dashboard/precursor-rules", "/dashboard/barriers", "/dashboard/energies"]) {
        const r = await req("GET", `${path}?dateFrom=2026-01-01&dateTo=2026-12-31`, { token: reviewerToken });
        assert.equal(r.status, 200, path);
        assert.ok(Array.isArray(r.json.data.items), path);
      }
      const rules = await req("GET", "/dashboard/precursor-rules?dateFrom=2026-01-01&dateTo=2026-12-31", { token: reviewerToken });
      // p1 (persistence test) + d1 share the same primary rule in this file's DB.
      assert.deepEqual(rules.json.data.items, [{ name: "SIF-PROTOTYPE-ENERGY-ISOLATION", count: 2 }]);
      const barriers = await req("GET", "/dashboard/barriers?dateFrom=2026-01-01&dateTo=2026-12-31", { token: reviewerToken });
      assert.deepEqual(barriers.json.data.items, [{ name: "Isolation not applied", count: 2 }]);
      const overview = await req("GET", "/dashboard/overview?dateFrom=2026-01-01&dateTo=2026-12-31", { token: reviewerToken });
      assert.equal(overview.json.data.priorityReports, 2);
    } finally {
      await closeSrv(stub);
    }
  });
});
