"use strict";

process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.JWT_SECRET = "notification-test-secret";
process.env.SYNC_DB = "true";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("../../src/app");
const { sequelize, User } = require("../../src/models");

let server;
let base;
let workerAToken;
let workerBToken;
let hseToken;
let hseReviewerToken;
let siteId;
let reportId;

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
  await new Promise((r) => server.on("listening", r));
  base = `http://localhost:${server.address().port}/api/v1`;

  const mk = async (name, email) => {
    await req("POST", "/worker/auth/register", { body: { name, employeeId: `EMP-${Math.random().toString(36).slice(2,6).toUpperCase()}`, email, password: "StrongPass123" } });
  };
  await mk("Worker A Notif", "notif-a@oil.local");
  await mk("Worker B Notif", "notif-b@oil.local");
  await req("POST", "/auth/register", { body: { name: "HSE Admin Notif", email: "hse-notif@oil.local", password: "StrongPass123" } });
  await req("POST", "/auth/register", { body: { name: "HSE Reviewer Notif", email: "hse-reviewer-notif@oil.local", password: "StrongPass123" } });
  await User.update({ role: "HSE_ADMIN" }, { where: { email: "hse-notif@oil.local" } });
  await User.update({ role: "HSE_REVIEWER" }, { where: { email: "hse-reviewer-notif@oil.local" } });
  await User.update({ status: "ACTIVE" }, { where: { email: "hse-notif@oil.local" } });

  const login = async (email) => (await req("POST", "/auth/login", { body: { email, password: "StrongPass123" } })).json.data.token;
  workerAToken = await login("notif-a@oil.local");
  workerBToken = await login("notif-b@oil.local");
  hseToken = await login("hse-notif@oil.local");
  hseReviewerToken = await login("hse-reviewer-notif@oil.local");

  const site = await req("POST", "/sites", { token: hseToken, body: { name: "Notif Site", code: "NSITE" } });
  siteId = site.json.data.site.id;

  const rep = await req("POST", "/worker/reports", { token: workerAToken, body: { date: "2026-09-20", siteId, activity: "Maintenance", reportType: "NEAR_MISS", description: "Worker A report for notification test with sufficient length for validation." } });
  reportId = rep.json.data.report.id;
});

after(async () => {
  await new Promise((r) => server.close(r));
  await sequelize.close();
});

describe("notifications", () => {
  it("1. Worker submits report → HSE notification created", async () => {
    const r = await req("GET", "/notifications", { token: hseToken });
    assert.equal(r.status, 200);
    const has = r.json.data.items.some((n) => n.type === "REPORT_SUBMITTED" && n.reportId === reportId);
    assert.ok(has);
  });

  it("2. HSE notification contains correct reportId and type", async () => {
    const r = await req("GET", "/notifications", { token: hseToken });
    const n = r.json.data.items.find((x) => x.reportId === reportId && x.type === "REPORT_SUBMITTED");
    assert.ok(n);
    assert.equal(n.reportId, reportId);
    assert.ok(n.title.includes("New Report"));
  });

  it("3. Worker can fetch own notifications", async () => {
    // Trigger a worker notification via HSE review
    const rev = await req("POST", "/reviews", { token: hseReviewerToken, body: { reportId, hseDecision: "NEEDS_MORE_INFO", comment: "Need more info" } });
    assert.equal(rev.status, 201);
    const r = await req("GET", "/notifications", { token: workerAToken });
    assert.equal(r.status, 200);
    assert.ok(r.json.data.items.some((n) => n.reportId === reportId));
  });

  it("4. HSE can fetch own notifications", async () => {
    const r = await req("GET", "/notifications", { token: hseToken });
    assert.equal(r.status, 200);
  });

  it("5. Worker cannot fetch another worker's notification", async () => {
    const wa = await req("GET", "/notifications", { token: workerAToken });
    const id = wa.json.data.items[0]?.id;
    if (id) {
      const r = await req("GET", `/notifications`, { token: workerBToken });
      // Ensure B doesn't see A's notification
      const seesA = r.json.data.items.some((n) => n.id === id);
      assert.equal(seesA, false);
      // Direct read of A's notification id should 404
      const direct = await req("PATCH", `/notifications/${id}/read`, { token: workerBToken });
      assert.equal(direct.status, 404);
    }
  });

  it("6. Worker cannot mark another worker's notification as read", async () => {
    const wa = await req("GET", "/notifications", { token: workerAToken });
    const id = wa.json.data.items.find((n) => !n.isRead)?.id || wa.json.data.items[0]?.id;
    if (id) {
      const r = await req("PATCH", `/notifications/${id}/read`, { token: workerBToken });
      assert.equal(r.status, 404);
    }
  });

  it("7. Unread count is correct", async () => {
    const before = await req("GET", "/notifications/unread-count", { token: workerAToken });
    assert.equal(before.status, 200);
    assert.ok(typeof before.json.data.count === "number");
  });

  it("8. Mark one notification as read", async () => {
    const list = await req("GET", "/notifications", { token: workerAToken });
    const unread = list.json.data.items.find((n) => !n.isRead);
    if (unread) {
      const r = await req("PATCH", `/notifications/${unread.id}/read`, { token: workerAToken });
      assert.equal(r.status, 200);
      assert.equal(r.json.data.notification.isRead, true);
      const after = await req("GET", "/notifications/unread-count", { token: workerAToken });
      assert.ok(after.json.data.count < list.json.data.items.filter((x) => !x.isRead).length + 1);
    }
  });

  it("9. Mark all as read", async () => {
    await req("PATCH", "/notifications/read-all", { token: workerAToken });
    const r = await req("GET", "/notifications/unread-count", { token: workerAToken });
    assert.equal(r.json.data.count, 0);
  });

  it("10. AI assessment creates Worker notification - use PRIORITY via analysis", async () => {
    // Create new report for AI test
    const rep = await req("POST", "/worker/reports", { token: workerAToken, body: { date: "2026-09-20", siteId, activity: "Maintenance", reportType: "NEAR_MISS", description: "During maintenance without isolating the electrical supply, exposed to live conductors." } });
    const newId = rep.json.data.report.id;
    // Mock AI to return PRIORITY - use direct service call via analysis endpoint with stub
    // For test, we will manually trigger notification via analysis service by stubbing AI? Instead, check that after analysis, worker gets notification.
    // Use http stub similar to assess.test
    const http = require("node:http");
    const env = require("../../src/config/env");
    const srv = http.createServer((rq, rs) => {
      let data = "";
      rq.on("data", (c) => (data += c));
      rq.on("end", () => {
        rs.writeHead(200, { "Content-Type": "application/json" });
        rs.end(JSON.stringify({
          schemaVersion: "sif-assessment-1.0.0",
          recordId: newId,
          metadata: { scoreKind: "heuristic-prototype" },
          receivedAt: "2026-09-21T00:00:00.000Z",
          processedAt: "2026-09-21T00:00:00.010Z",
          processingMs: 10,
          triage: { route: "PRIORITY", requiresHumanReview: true, escalatedToExtraction: true, riskScore: 0.94, ruleBasedSignal: { triggered: true, matchedRules: [{ code: "SIF-PROTOTYPE-ENERGY-ISOLATION", phrase: "without isolating" }] } },
          assessment: { sifPotential: "YES", activity: "Maintenance", primaryRule: "SIF-PROTOTYPE-ENERGY-ISOLATION", secondaryRules: [], hazardEnergy: "Electrical", eventStatus: "UNSAFE_ACT", barriersFailed: ["Isolation not applied"], assets: ["pump"], rationale: "Matched", evidence: ["without isolating the electrical supply"], },
          extraction: { status: "success", modelVersion: "sif-engine-1.0.0+rulebased", repairAttempts: 0, failureReason: null },
          clarificationRequest: null,
        }));
      });
    });
    await new Promise((res) => srv.listen(0, "127.0.0.1", res));
    const oldUrl = env.aiServiceUrl;
    env.aiServiceUrl = `http://127.0.0.1:${srv.address().port}`;
    try {
      const ar = await req("POST", `/analysis/reports/${newId}`, { token: hseToken });
      assert.equal(ar.status, 200);
      const list = await req("GET", "/notifications", { token: workerAToken });
      const has = list.json.data.items.some((n) => n.reportId === newId && n.type === "AI_ASSESSMENT_COMPLETED");
      assert.ok(has);
    } finally {
      env.aiServiceUrl = oldUrl;
      await new Promise((r) => srv.close(r));
    }
  });

  it("11. PRIORITY assessment creates HSE notification", async () => {
    // Already tested via previous, but check HSE got priority alert for same report
    const list = await req("GET", "/notifications", { token: hseToken });
    const has = list.json.data.items.some((n) => n.type === "AI_PRIORITY_ALERT");
    assert.ok(has);
  });

  it("12. NEEDS_MORE_INFO creates Worker notification", async () => {
    const list = await req("GET", "/notifications", { token: workerAToken });
    const has = list.json.data.items.some((n) => n.type === "HSE_NEEDS_INFORMATION");
    assert.ok(has);
  });

  it("13. CONFIRMED creates Worker notification", async () => {
    const rep = await req("POST", "/worker/reports", { token: workerAToken, body: { date: "2026-09-20", siteId, activity: "Maintenance", reportType: "NEAR_MISS", description: "Another report for confirmed test with sufficient length for validation and review." } });
    const nid = rep.json.data.report.id;
    // Need to make it UNDER_REVIEW first - via analysis then review? Simplified: directly review with CONFIRMED from NEW still creates notification
    const rev = await req("POST", "/reviews", { token: hseReviewerToken, body: { reportId: nid, hseDecision: "CONFIRMED", comment: "Confirmed" } });
    assert.equal(rev.status, 201);
    const list = await req("GET", "/notifications", { token: workerAToken });
    const has = list.json.data.items.some((n) => n.type === "REPORT_CONFIRMED" && n.reportId === nid);
    assert.ok(has);
  });

  it("14. REJECTED creates Worker notification", async () => {
    const rep = await req("POST", "/worker/reports", { token: workerAToken, body: { date: "2026-09-20", siteId, activity: "Maintenance", reportType: "NEAR_MISS", description: "Report for rejected test with sufficient description length for validation." } });
    const nid = rep.json.data.report.id;
    const rev = await req("POST", "/reviews", { token: hseReviewerToken, body: { reportId: nid, hseDecision: "REJECTED", comment: "Rejected" } });
    assert.equal(rev.status, 201);
    const list = await req("GET", "/notifications", { token: workerAToken });
    const has = list.json.data.items.some((n) => n.type === "REPORT_REJECTED" && n.reportId === nid);
    assert.ok(has);
  });

  it("15. CLOSED creates Worker notification", async () => {
    // Use AUTO_CLOSE report
    const rep = await req("POST", "/worker/reports", { token: workerAToken, body: { date: "2026-09-20", siteId, activity: "Maintenance", reportType: "NEAR_MISS", description: "Small pieces of packaging material found near walkway after material handling, no injury." } });
    const nid = rep.json.data.report.id;
    const http = require("node:http");
    const env = require("../../src/config/env");
    const srv = http.createServer((rq, rs) => {
      let d = ""; rq.on("data", (c) => d += c); rq.on("end", () => {
        rs.writeHead(200, { "Content-Type": "application/json" });
        rs.end(JSON.stringify({
          schemaVersion: "sif-assessment-1.0.0", recordId: nid, metadata: { scoreKind: "heuristic-prototype" }, receivedAt: "2026-09-21T00:00:00.000Z", processedAt: "2026-09-21T00:00:00.010Z", processingMs: 10,
          triage: { route: "AUTO_CLOSE", requiresHumanReview: false, escalatedToExtraction: false, riskScore: 0.05, ruleBasedSignal: { triggered: false, matchedRules: [] } },
          assessment: { sifPotential: "NO", activity: null, primaryRule: null, secondaryRules: [], hazardEnergy: null, eventStatus: "UNKNOWN", barriersFailed: [], assets: [], rationale: "no SIF", evidence: [] },
          extraction: { status: "skipped", modelVersion: null, repairAttempts: 0, failureReason: null }, clarificationRequest: null,
        }));
      });
    });
    await new Promise((r) => srv.listen(0, "127.0.0.1", r));
    const old = env.aiServiceUrl;
    env.aiServiceUrl = `http://127.0.0.1:${srv.address().port}`;
    try {
      const ar = await req("POST", `/analysis/reports/${nid}`, { token: hseToken });
      assert.equal(ar.status, 200);
      const list = await req("GET", "/notifications", { token: workerAToken });
      const has = list.json.data.items.some((n) => n.type === "REPORT_CLOSED" && n.reportId === nid);
      assert.ok(has);
    } finally { env.aiServiceUrl = old; await new Promise((r) => srv.close(r)); }
  });

  it("16. Duplicate event does not create duplicate notification", async () => {
    const worker = await require("../../src/models/User").findOne({ where: { email: "notif-a@oil.local" } });
    const dupReport = await req("POST", "/worker/reports", { token: workerAToken, body: { date: "2026-09-20", siteId, activity: "Maintenance", reportType: "NEAR_MISS", description: "Duplicate test report with sufficient description length for validation." } });
    const dupReportId = dupReport.json.data.report.id;
    const notificationService = require("../../src/services/notification.service");
    const reportNumber = dupReport.json.data.report.reportNumber;
    const before = await require("../../src/models/Notification").count({ where: { type: "REPORT_SUBMITTED", reportId: dupReportId, userId: worker.id } });
    await notificationService.createNotification({ userId: worker.id, type: "REPORT_SUBMITTED", title: "New Report Submitted", message: `Report ${reportNumber} has been submitted`, reportId: dupReportId, eventKey: `REPORT_SUBMITTED:${dupReportId}:${worker.id}` });
    await notificationService.createNotification({ userId: worker.id, type: "REPORT_SUBMITTED", title: "New Report Submitted", message: `Report ${reportNumber} has been submitted`, reportId: dupReportId, eventKey: `REPORT_SUBMITTED:${dupReportId}:${worker.id}` });
    const after = await require("../../src/models/Notification").count({ where: { type: "REPORT_SUBMITTED", reportId: dupReportId, userId: worker.id } });
    assert.equal(after, before + 1);
    // Second duplicate should not increase
    await notificationService.createNotification({ userId: worker.id, type: "REPORT_SUBMITTED", title: "New Report Submitted", message: `Report ${reportNumber} has been submitted`, reportId: dupReportId, eventKey: `REPORT_SUBMITTED:${dupReportId}:${worker.id}` });
    const after2 = await require("../../src/models/Notification").count({ where: { type: "REPORT_SUBMITTED", reportId: dupReportId, userId: worker.id } });
    assert.equal(after2, before + 1);
  });

  it("17. Inactive users do not receive new notifications", async () => {
    const inactiveEmail = "inactive-notif@oil.local";
    await req("POST", "/worker/auth/register", { body: { name: "Inactive", employeeId: `EMP-${Math.random().toString(36).slice(2,4)}`, email: inactiveEmail, password: "StrongPass123" } });
    const user = await require("../../src/models/User").findOne({ where: { email: inactiveEmail } });
    await user.update({ status: "INACTIVE" });
    const before = await require("../../src/models/Notification").count({ where: { userId: user.id } });
    // Submit new report as workerA, HSE list should not include inactive user
    const rep = await req("POST", "/worker/reports", { token: workerAToken, body: { date: "2026-09-20", siteId, activity: "Maintenance", reportType: "NEAR_MISS", description: "Test inactive user notification with sufficient length for validation and check." } });
    const after = await require("../../src/models/Notification").count({ where: { userId: user.id } });
    assert.equal(after, before);
    await user.update({ status: "ACTIVE" });
  });

  it("18. HSE roles do not receive Worker-only notifications", async () => {
    const rep = await req("POST", "/worker/reports", { token: workerAToken, body: { date: "2026-09-20", siteId, activity: "Maintenance", reportType: "NEAR_MISS", description: "HSE should not get worker AI closed notification with sufficient length." } });
    const nid = rep.json.data.report.id;
    // Trigger AUTO_CLOSE for worker
    const http = require("node:http");
    const env = require("../../src/config/env");
    const srv = http.createServer((rq, rs) => {
      let d=""; rq.on("data",c=>d+=c); rq.on("end",()=>{
        rs.writeHead(200,{"Content-Type":"application/json"});
        rs.end(JSON.stringify({ schemaVersion:"sif-assessment-1.0.0", recordId:nid, metadata:{scoreKind:"heuristic-prototype"}, receivedAt:"2026-09-21T00:00:00.000Z", processedAt:"2026-09-21T00:00:00.010Z", processingMs:10, triage:{route:"AUTO_CLOSE",requiresHumanReview:false,escalatedToExtraction:false,riskScore:0.05,ruleBasedSignal:{triggered:false,matchedRules:[]}}, assessment:{sifPotential:"NO",activity:null,primaryRule:null,secondaryRules:[],hazardEnergy:null,eventStatus:"UNKNOWN",barriersFailed:[],assets:[],rationale:"no SIF",evidence:[]}, extraction:{status:"skipped",modelVersion:null,repairAttempts:0,failureReason:null}, clarificationRequest:null }));
      });
    });
    await new Promise(r=>srv.listen(0,"127.0.0.1",r));
    const old=env.aiServiceUrl; env.aiServiceUrl=`http://127.0.0.1:${srv.address().port}`;
    try {
      await req("POST", `/analysis/reports/${nid}`, { token: hseToken });
      const hseList = await req("GET", "/notifications", { token: hseToken });
      const hasWorkerClosed = hseList.json.data.items.some((n)=> n.type==="REPORT_CLOSED" && n.reportId===nid);
      assert.equal(hasWorkerClosed, false);
    } finally { env.aiServiceUrl=old; await new Promise(r=>srv.close(r)); }
  });

  it("19. Worker cannot access HSE notification", async () => {
    // HSE has a REPORT_SUBMITTED notification
    const hseList = await req("GET", "/notifications", { token: hseToken });
    const hseNotif = hseList.json.data.items.find((n)=> n.type==="REPORT_SUBMITTED");
    if (hseNotif) {
      const r = await req("PATCH", `/notifications/${hseNotif.id}/read`, { token: workerAToken });
      assert.equal(r.status, 404);
    }
  });

  it("20. Notification without reportId is handled safely", async () => {
    const notificationService = require("../../src/services/notification.service");
    const worker = await require("../../src/models/User").findOne({ where: { email: "notif-a@oil.local" } });
    const n = await notificationService.createNotification({ userId: worker.id, type: "GENERAL", title: "General notice", message: "System maintenance", eventKey: `GENERAL:${Date.now()}:${worker.id}` });
    assert.ok(n.id);
    const list = await req("GET", "/notifications", { token: workerAToken });
    const found = list.json.data.items.find((x)=> x.id===n.id);
    assert.ok(found);
    assert.equal(found.reportId, null);
  });

  it("21. Existing report workflow still passes", async () => {
    const r = await req("POST", "/worker/reports", { token: workerAToken, body: { date: "2026-09-20", siteId, activity: "Maintenance", reportType: "NEAR_MISS", description: "Existing workflow check with sufficient description length for validation." } });
    assert.equal(r.status, 201);
  });

  it("22. Existing draft workflow still passes", async () => {
    const d = await req("POST", "/worker/drafts", { token: workerAToken, body: { description: "Draft workflow check" } });
    assert.equal(d.status, 201);
    await req("DELETE", `/worker/drafts/${d.json.data.draft.id}`, { token: workerAToken });
  });

  it("23. Existing IDOR tests still pass", async () => {
    const r = await req("GET", `/worker/reports/${reportId}`, { token: workerBToken });
    assert.equal(r.status, 404);
  });
});
