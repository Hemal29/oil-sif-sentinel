"use strict";

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { Op } = require("sequelize");
const { z } = require("zod");
const env = require("../config/env");
const { AppError } = require("../utils/errors");
const sequelize = require("../config/database");
const Report = require("../models/Report");
const Site = require("../models/Site");

const MAX_RETURNED_ERRORS = 100;

const REQUIRED_COLUMNS = ["reportNumber", "date", "site", "activity", "reportType", "description"];
const REPORT_TYPES = ["UNSAFE_ACT", "UNSAFE_CONDITION", "NEAR_MISS"];

// Canonical field <- header aliases (compared after lowercase + strip space/_/-).
function buildHeaderMap() {
  const map = {
    reportnumber: "reportNumber",
    date: "date",
    site: "site",
    location: "location",
    activity: "activity",
    reporttype: "reportType",
    description: "description",
    equipment: "equipment",
    language: "language",
    sourcefile: "sourceFile",
  };
  // Singular/plural + common variants resolve through the same key.
  map.sitename = "site";
  map.sitecode = "site";
  map.reportdate = "date";
  return map;
}
const HEADER_MAP = buildHeaderMap();

function normalizeHeader(raw) {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, "");
  return HEADER_MAP[key] || null; // unknown extra columns → ignored
}

const importRowSchema = z.object({
  reportNumber: z.string().trim().min(1).max(50),
  date: z.coerce.date(),
  site: z.string().trim().min(1).max(150),
  location: z.string().trim().max(255).optional(),
  activity: z.string().trim().min(1).max(150),
  reportType: z.enum(REPORT_TYPES),
  description: z.string().trim().min(10).max(20000),
  equipment: z.string().trim().max(255).optional(),
  language: z.string().trim().min(2).max(10).optional(),
});

function normalizeReportType(value) {
  return String(value || "").trim().toUpperCase().replace(/[\s\-]+/g, "_");
}

// Excel serial dates (and native Dates) → YYYY-MM-DD for the DATEONLY column.
function normalizeDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const epoch = Date.UTC(1899, 11, 30);
    const d = new Date(epoch + Math.round(value) * 86400000);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return value;
}

function emptyToUndefined(value) {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s === "" ? undefined : s;
}

function makeBatchId() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `IMP-${stamp}-${rand}`;
}

// Content sniffing — never trust the extension alone.
function assertContentMatchesExtension(filePath, ext) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(8);
    const read = fs.readSync(fd, buf, 0, 8, 0);
    const head = buf.slice(0, read);
    const isZip = head[0] === 0x50 && head[1] === 0x4b; // PK — xlsx
    const isOle = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0; // legacy .xls
    if (ext === ".csv") {
      if (head.includes(0x00)) {
        throw new AppError("File content does not look like CSV text.", 400, "FILE_CONTENT_MISMATCH");
      }
    } else if (!isZip && !isOle) {
      throw new AppError("File content does not match its spreadsheet extension.", 400, "FILE_CONTENT_MISMATCH");
    }
  } finally {
    fs.closeSync(fd);
  }
}

function parseWorkbook(filePath) {
  let workbook;
  try {
    workbook = XLSX.readFile(filePath, { cellDates: true });
  } catch (err) {
    throw new AppError("Could not parse the uploaded file. Ensure it is a valid CSV or Excel workbook.", 400, "FILE_PARSE_ERROR");
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new AppError("The workbook contains no sheets.", 400, "FILE_PARSE_ERROR");
  // header:1 → raw grid so WE control header normalization.
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true });
}

async function importReportsFromFile({ filePath, originalName, createdBy }) {
  const ext = path.extname(originalName || "").toLowerCase();
  assertContentMatchesExtension(filePath, ext);

  const grid = parseWorkbook(filePath);
  if (grid.length === 0) {
    throw new AppError("The file is empty.", 400, "EMPTY_FILE");
  }

  const rawHeaders = grid[0];
  const colIndexToField = {};
  rawHeaders.forEach((h, i) => {
    const field = normalizeHeader(h);
    if (field && colIndexToField[i] === undefined) colIndexToField[i] = field;
  });

  const missing = REQUIRED_COLUMNS.filter((c) => !Object.values(colIndexToField).includes(c));
  if (missing.length > 0) {
    throw new AppError(`Missing required column(s): ${missing.join(", ")}.`, 400, "MISSING_COLUMNS");
  }

  const dataRows = grid.slice(1).filter((row) => row.some((c) => c !== null && String(c).trim() !== ""));
  const totalRows = dataRows.length;
  if (totalRows === 0) {
    throw new AppError("The file contains no data rows.", 400, "EMPTY_FILE");
  }
  if (totalRows > env.import.maxRows) {
    throw new AppError(
      `Import rejected: ${totalRows} rows exceeds the limit of ${env.import.maxRows}. Split the file and retry.`,
      422,
      "ROW_LIMIT_EXCEEDED"
    );
  }

  // Normalize rows (header aliases applied, types coerced, content untouched).
  const normalized = dataRows.map((row) => {
    const obj = {};
    Object.entries(colIndexToField).forEach(([i, field]) => {
      obj[field] = row[Number(i)];
    });
    if (obj.reportType !== undefined && obj.reportType !== null) obj.reportType = normalizeReportType(obj.reportType);
    if (obj.date !== undefined && obj.date !== null) obj.date = normalizeDate(obj.date);
    ["location", "activity", "equipment", "language", "site", "reportNumber", "description"].forEach((f) => {
      if (obj[f] !== undefined) {
        const v = emptyToUndefined(obj[f]);
        if (v === undefined) delete obj[f];
        else obj[f] = obj[f] instanceof Date || typeof obj[f] === "number" ? obj[f] : v;
      }
    });
    return obj;
  });

  // Resolve sites efficiently: distinct values → single batched query.
  // Case-insensitive on every dialect (LOWER() comparison, not collation luck).
  const distinctSites = [...new Set(normalized.map((r) => (r.site ? String(r.site).trim() : "")).filter(Boolean))];
  const loweredSites = distinctSites.map((s) => s.toLowerCase());
  const siteRows = distinctSites.length
    ? await Site.findAll({
        where: {
          [Op.or]: [
            sequelize.where(sequelize.fn("LOWER", sequelize.col("code")), { [Op.in]: loweredSites }),
            sequelize.where(sequelize.fn("LOWER", sequelize.col("name")), { [Op.in]: loweredSites }),
          ],
        },
      })
    : [];
  // Prefer code match, fall back to name (case-insensitive for real-world files).
  const siteByCode = new Map();
  const siteByName = new Map();
  siteRows.forEach((s) => {
    siteByCode.set(String(s.code).toLowerCase(), s);
    siteByName.set(String(s.name).toLowerCase(), s);
  });
  const resolveSite = (value) => {
    const key = String(value).trim().toLowerCase();
    return siteByCode.get(key) || siteByName.get(key) || null;
  };

  // Duplicate reportNumbers: within the file + already in the database (one query).
  const numbers = normalized.map((r) => (r.reportNumber ? String(r.reportNumber).trim() : "")).filter(Boolean);
  const existingRows = numbers.length
    ? await Report.findAll({ where: { reportNumber: numbers }, attributes: ["reportNumber"] })
    : [];
  const existingNumbers = new Set(existingRows.map((r) => r.reportNumber));
  const seenInFile = new Set();

  // Validate ALL rows first; separate valid/invalid.
  const valid = [];
  const errors = [];
  const pushError = (row, field, code, message) => {
    if (errors.length < MAX_RETURNED_ERRORS) errors.push({ row, field, code, message });
  };

  normalized.forEach((row, i) => {
    const rowNum = i + 2; // 1-based spreadsheet row (header is row 1)
    const num = row.reportNumber ? String(row.reportNumber).trim() : "";

    if (num) {
      if (seenInFile.has(num)) {
        pushError(rowNum, "reportNumber", "DUPLICATE_REPORT", "Report number is duplicated within the file.");
        return;
      }
      seenInFile.add(num);
      if (existingNumbers.has(num)) {
        pushError(rowNum, "reportNumber", "DUPLICATE_REPORT", "Report number already exists.");
        return;
      }
    }

    const parsed = importRowSchema.safeParse(row);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      pushError(rowNum, first.path.join(".") || "row", "ROW_VALIDATION_ERROR", first.message);
      return;
    }

    const siteRecord = resolveSite(parsed.data.site);
    if (!siteRecord) {
      pushError(rowNum, "site", "SITE_NOT_FOUND", `Site '${parsed.data.site}' does not exist.`);
      return;
    }

    valid.push({ data: parsed.data, siteId: siteRecord.id });
  });

  // Bulk insert valid rows in ONE transaction — rollback on unexpected failure.
  const batchId = makeBatchId();
  // Basename only: never store arbitrary filesystem paths.
  const sourceFile = `${batchId}/${path.basename(originalName)}`;
  let inserted = 0;
  if (valid.length > 0) {
    const payload = valid.map(({ data, siteId }) => ({
      reportNumber: data.reportNumber.trim(),
      date: data.date.toISOString().slice(0, 10),
      siteId,
      location: data.location ? data.location.trim() : null,
      activity: data.activity.trim(),
      reportType: data.reportType,
      description: data.description.trim(), // original text, verbatim
      equipment: data.equipment ? data.equipment.trim() : null,
      language: (data.language || "en").trim(),
      sourceFile,
      status: "NEW", // imports always start NEW; no AI, no review here
      createdBy,
    }));
    try {
      const created = await sequelize.transaction(async (t) => Report.bulkCreate(payload, { transaction: t }));
      inserted = created.length;
    } catch (err) {
      if (err && err.name === "SequelizeUniqueConstraintError") {
        // Race: a duplicate slipped in after our pre-check — report it cleanly.
        throw new AppError("Import aborted: a report number already exists.", 409, "DUPLICATE_REPORT");
      }
      throw err; // transaction already rolled back; centralized handler → 500
    }
  }

  const failed = totalRows - inserted;
  const additionalErrors = Math.max(0, (totalRows - valid.length) - errors.length);
  return {
    totalRows,
    imported: inserted,
    failed,
    batchId,
    errors,
    errorsTruncated: additionalErrors > 0,
    additionalErrors,
    message:
      failed === 0
        ? `Import completed: ${inserted} report(s) imported.`
        : `Import completed with some row errors: ${inserted} imported, ${failed} failed.`,
  };
}

module.exports = { importReportsFromFile, normalizeHeader };
