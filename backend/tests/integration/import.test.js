"use strict";

// Step 4 tests: CSV/XLSX import pipeline (sqlite memory, test-only dialect).
// Small import limits are set BEFORE requiring the app (separate test process).
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = ":memory:";
process.env.JWT_SECRET = "import-test-secret";
process.env.SYNC_DB = "true";
process.env.MAX_IMPORT_ROWS = "50";
process.env.MAX_IMPORT_FILE_SIZE_MB = "5"; // oversize path tested in import-limits.test.js

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const XLSX = require("xlsx");

const app = require("../../src/app");
const { sequelize, User, Report } = require("../../src/models");
const importService = require("../../src/services/import.service");

const HEADER = "reportNumber,date,site,location,activity,reportType,description,equipment,language";
const GOOD_ROW = "OIL-T-001,2026-09-20,TST,Process Area,Maintenance,NEAR_MISS,Technician opened the pump without isolating the electrical supply.,Pump P-101,en";

let server;
let base;
let adminToken;
let reviewerToken;
let userToken;
let reviewerId;

function upload({ file, filename, mime, token }) {
  const form = new FormData();
  if (file !== undefined) {
    form.append("file", new File([file], filename, { type: mime }));
  }
  return fetch(`${base}/reports/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  }).then(async (r) => ({ status: r.status, json: await r.json() }));
}

const csv = (rows) => `${HEADER}\n${rows.join("\n")}\n`;

function xlsxBuffer(aoa) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Reports");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

async function register(name, email) {
  const r = await fetch(`${base}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password: "StrongPassword123" }),
  });
  assert.equal(r.status, 201);
  return (await r.json()).data.token;
}

before(async () => {
  await sequelize.sync({ force: true });
  server = app.listen(0);
  await new Promise((resolve) => server.on("listening", resolve));
  base = `http://localhost:${server.address().port}/api/v1`;

  userToken = await register("Import User", "import-user@example.com");
  reviewerToken = await register("Import Reviewer", "import-reviewer@example.com");
  adminToken = await register("Import Admin", "import-admin@example.com");
  await User.update({ role: "HSE_REVIEWER" }, { where: { email: "import-reviewer@example.com" } });
  await User.update({ role: "HSE_ADMIN" }, { where: { email: "import-admin@example.com" } });
  const login = async (email) =>
    (await (await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "StrongPassword123" }),
    })).json()).data.token;
  reviewerToken = await login("import-reviewer@example.com");
  adminToken = await login("import-admin@example.com");
  reviewerId = (await User.findOne({ where: { email: "import-reviewer@example.com" } })).id;

  const site = await fetch(`${base}/sites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: "Import Site", code: "TST" }),
  });
  assert.equal(site.status, 201);
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
});

describe("import auth", () => {
  const body = csv([GOOD_ROW]);
  it("401 without JWT", async () => {
    const r = await upload({ file: body, filename: "a.csv", mime: "text/csv" });
    assert.equal(r.status, 401);
  });
  it("403 for USER", async () => {
    const r = await upload({ file: body, filename: "a.csv", mime: "text/csv", token: userToken });
    assert.equal(r.status, 403);
  });
  it("reviewer and admin allowed", async () => {
    const a = await upload({ file: csv([GOOD_ROW.replace("OIL-T-001", "OIL-T-010")]), filename: "a.csv", mime: "text/csv", token: reviewerToken });
    assert.equal(a.status, 200);
    assert.equal(a.json.data.imported, 1);
    const b = await upload({ file: csv([GOOD_ROW.replace("OIL-T-001", "OIL-T-011")]), filename: "a.csv", mime: "text/csv", token: adminToken });
    assert.equal(b.status, 200);
  });
});

describe("file validation", () => {
  it("400 when no file sent", async () => {
    const r = await upload({ token: reviewerToken });
    assert.equal(r.status, 400);
    assert.equal(r.json.error.code, "FILE_REQUIRED");
  });
  it("400 on unsupported extension", async () => {
    const r = await upload({ file: "hello", filename: "evil.txt", mime: "text/plain", token: reviewerToken });
    assert.equal(r.status, 400);
    assert.equal(r.json.error.code, "INVALID_FILE_TYPE");
  });
  it("400 when content does not match extension", async () => {
    const r = await upload({ file: "just some text", filename: "fake.xlsx", mime: "application/octet-stream", token: reviewerToken });
    assert.equal(r.status, 400);
    assert.equal(r.json.error.code, "FILE_CONTENT_MISMATCH");
  });
});

describe("headers", () => {
  it("400 on missing required column", async () => {
    const bad = "reportNumber,date,site\nOIL-T-020,2026-09-20,TST\n";
    const r = await upload({ file: bad, filename: "a.csv", mime: "text/csv", token: reviewerToken });
    assert.equal(r.status, 400);
    assert.equal(r.json.error.code, "MISSING_COLUMNS");
  });
  it("accepts alias headers, ignores unknown extra columns", async () => {
    const aliased = "Report Number,report_date,Site Name,Activity,report_type,Description,extra_col\nOIL-T-021,2026-09-20,TST,Maintenance,near miss,Worker noticed oil leaking near the flange joint area.,zzz\n";
    const r = await upload({ file: aliased, filename: "a.csv", mime: "text/csv", token: reviewerToken });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.imported, 1);
  });
});

describe("rows", () => {
  it("rejects invalid type/date/description/activity/site per row", async () => {
    const rows = csv([
      "OIL-T-030,2026-09-20,TST,Area,Maintenance,FIRE,Valid description text here for row one.,,en",
      "OIL-T-031,not-a-date,TST,Area,Maintenance,NEAR_MISS,Valid description text here for row two.,,en",
      "OIL-T-032,2026-09-20,TST,Area,Maintenance,NEAR_MISS,short,,en",
      "OIL-T-033,2026-09-20,TST,Area,,NEAR_MISS,Valid description text here for row four.,,en",
      "OIL-T-034,2026-09-20,GHOST,Area,Maintenance,NEAR_MISS,Valid description text here for row five.,,en",
    ]);
    const r = await upload({ file: rows, filename: "a.csv", mime: "text/csv", token: reviewerToken });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.totalRows, 5);
    assert.equal(r.json.data.imported, 0);
    assert.equal(r.json.data.failed, 5);
    const codes = r.json.data.errors.map((e) => e.code);
    assert.ok(codes.includes("ROW_VALIDATION_ERROR"));
    assert.ok(codes.includes("SITE_NOT_FOUND"));
  });

  it("rejects duplicates (existing DB + within file) without overwriting", async () => {
    const before = await Report.findOne({ where: { reportNumber: "OIL-T-010" } });
    const rows = csv([
      GOOD_ROW.replace("OIL-T-001", "OIL-T-010"),
      GOOD_ROW.replace("OIL-T-001", "OIL-T-040"),
      GOOD_ROW.replace("OIL-T-001", "OIL-T-040"),
    ]);
    const r = await upload({ file: rows, filename: "a.csv", mime: "text/csv", token: reviewerToken });
    assert.equal(r.json.data.imported, 1);
    assert.equal(r.json.data.failed, 2);
    assert.ok(r.json.data.errors.every((e) => e.code === "DUPLICATE_REPORT"));
    const after = await Report.findOne({ where: { reportNumber: "OIL-T-010" } });
    assert.equal(after.id, before.id); // untouched
  });

  it("partial import inserts valid rows and preserves text/status/creator", async () => {
    const rows = csv([
      GOOD_ROW.replace("OIL-T-001", "OIL-T-050"),
      "OIL-T-051,2026-09-20,GHOST,Area,Maintenance,NEAR_MISS,Valid description text that will fail on site.,,en",
    ]);
    const r = await upload({ file: rows, filename: "keep.csv", mime: "text/csv", token: reviewerToken });
    assert.equal(r.json.data.imported, 1);
    assert.equal(r.json.data.failed, 1);
    const stored = await Report.findOne({ where: { reportNumber: "OIL-T-050" } });
    assert.equal(stored.description, "Technician opened the pump without isolating the electrical supply.");
    assert.equal(stored.status, "NEW");
    assert.equal(stored.createdBy, reviewerId);
    assert.match(stored.sourceFile, /^IMP-\d+-[A-F0-9]+\/keep\.csv$/);
  });

  it("422 when rows exceed MAX_IMPORT_ROWS", async () => {
    const rows = csv(Array.from({ length: 55 }, (_, i) => GOOD_ROW.replace("OIL-T-001", `OIL-LIM-${i}`)));
    // Bypass the 1KB multer limit: call the service directly with a temp file.
    const tmp = path.join(os.tmpdir(), `lim-${Date.now()}.csv`);
    fs.writeFileSync(tmp, rows);
    try {
      await assert.rejects(
        importService.importReportsFromFile({ filePath: tmp, originalName: "lim.csv", createdBy: reviewerId }),
        (e) => e.code === "ROW_LIMIT_EXCEEDED"
      );
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it("rolls back when bulk insert fails unexpectedly", async () => {
    const tmp = path.join(os.tmpdir(), `rb-${Date.now()}.csv`);
    fs.writeFileSync(tmp, csv([GOOD_ROW.replace("OIL-T-001", "OIL-RB-001")]));
    const before = await Report.count();
    const original = Report.bulkCreate;
    Report.bulkCreate = () => Promise.reject(new Error("boom"));
    try {
      await assert.rejects(
        importService.importReportsFromFile({ filePath: tmp, originalName: "rb.csv", createdBy: reviewerId }),
        /boom/
      );
    } finally {
      Report.bulkCreate = original;
      fs.unlinkSync(tmp);
    }
    assert.equal(await Report.count(), before); // nothing partially inserted
  });
});

describe("xlsx + cleanup", () => {
  it("imports valid XLSX", async () => {
    const buf = xlsxBuffer([
      ["reportNumber", "date", "site", "activity", "reportType", "description"],
      ["OIL-T-060", "2026-09-20", "TST", "Maintenance", "UNSAFE_CONDITION", "Corroded pipe support noticed during routine inspection round."],
    ]);
    const r = await upload({ file: buf, filename: "r.xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", token: reviewerToken });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.imported, 1);
  });

  it("leaves no temp files behind", async () => {
    const entries = fs.readdirSync("uploads/").filter((f) => f !== ".gitkeep");
    assert.deepEqual(entries, []);
  });
});
