"use strict";

// Dashboard is strictly READ-ONLY: aggregate SELECTs only, never mutations.
// All KPIs/charts come from real MySQL rows (no hardcoded or sample data).
// SIF and priority counts use COMPLETED AI analyses only; reports without a
// COMPLETED analysis are reported as UNANALYZED (never as non-SIF).

const { Op } = require("sequelize");
const sequelize = require("../config/database");
const Report = require("../models/Report");
const AIAnalysis = require("../models/AIAnalysis");
const Site = require("../models/Site");
const LifeSavingRule = require("../models/LifeSavingRule");

const REPORT_TYPES = ["UNSAFE_ACT", "UNSAFE_CONDITION", "NEAR_MISS"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const HIGH_CRITICAL = ["HIGH", "CRITICAL"];
const PRESET_DAYS = { "7d": 6, "30d": 29, "90d": 89, "1y": 364 };

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDays(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Date behavior (documented): filtering uses reports.date (the incident date
// as stored, YYYY-MM-DD). Bounds are inclusive. All math is in UTC so no
// server-timezone shift can silently move a boundary. Explicit dateFrom/dateTo
// take precedence over preset; default preset is 30d.
function resolveRange(query = {}) {
  const preset = query.preset || "30d";
  const end = query.dateTo || todayUTC();
  let start = query.dateFrom || null;
  if (!start && preset !== "all") {
    start = shiftDays(end, -PRESET_DAYS[preset]);
  }
  return { dateFrom: start, dateTo: query.dateTo || null, preset, end };
}

function reportWhere(range) {
  const where = {};
  if (range.dateFrom || range.dateTo) {
    where.date = {};
    if (range.dateFrom) where.date[Op.gte] = range.dateFrom;
    if (range.dateTo) where.date[Op.lte] = range.dateTo;
  }
  return where;
}

function completedInRange(range) {
  return {
    analysisStatus: "COMPLETED",
    "$report.date$": undefined, // replaced below; keeps shape obvious
  };
}

// Join filter: completed analysis whose report falls in range.
function reportIncludeInRange(range) {
  return { model: Report, as: "report", attributes: [], required: true, where: reportWhere(range) };
}

async function countCompleted(range, extra = {}) {
  return AIAnalysis.count({
    where: { analysisStatus: "COMPLETED", ...extra },
    include: [reportIncludeInRange(range)],
  });
}

async function getOverview(range) {
  const where = reportWhere(range);
  const [totalReports, sifPotential, highPriority, pendingReviews,
    aiAbstained, aiUncertain, autoClosed, priorityReports] = await Promise.all([
    Report.count({ where }),
    countCompleted(range, { sifPotential: true }),
    countCompleted(range, { priority: { [Op.in]: HIGH_CRITICAL } }),
    Report.count({ where: { ...where, status: "UNDER_REVIEW" } }),
    countCompleted(range, { route: "ABSTAIN" }),
    countCompleted(range, { route: "UNCERTAIN" }),
    countCompleted(range, { route: "AUTO_CLOSE" }),
    countCompleted(range, { route: "PRIORITY" }),
  ]);
  return { totalReports, sifPotential, highPriority, pendingReviews,
    aiAbstained, aiUncertain, autoClosed, priorityReports };
}

function zeroFilled(obj, keys) {
  const out = {};
  for (const k of keys) out[k] = obj[k] || 0;
  return out;
}

async function getDistributions(range) {
  const where = reportWhere(range);
  const [typeRows, priorityRows, sifCount, analyzedCount, totalReports] = await Promise.all([
    Report.findAll({
      attributes: ["reportType", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
      where,
      group: ["reportType"],
      raw: true,
    }),
    AIAnalysis.findAll({
      attributes: ["priority", [sequelize.fn("COUNT", sequelize.col("AIAnalysis.id")), "count"]],
      where: { analysisStatus: "COMPLETED" },
      include: [reportIncludeInRange(range)],
      group: ["priority"],
      raw: true,
    }),
    countCompleted(range, { sifPotential: true }),
    AIAnalysis.count({ distinct: true, col: "reportId", where: { analysisStatus: "COMPLETED" }, include: [reportIncludeInRange(range)] }),
    Report.count({ where }),
  ]);
  const byType = {};
  for (const r of typeRows) byType[r.reportType] = Number(r.count);
  const byPriority = {};
  for (const r of priorityRows) {
    if (r.priority) byPriority[r.priority] = Number(r.count);
  }
  const sif = sifCount;
  const nonSif = analyzedCount - sif;
  return {
    reportType: zeroFilled(byType, REPORT_TYPES),
    priority: zeroFilled(byPriority, PRIORITIES),
    sif: { sif, nonSif, unanalyzed: totalReports - analyzedCount },
  };
}

function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

function bucketKey(dateStr, bucket) {
  if (bucket === "day") return dateStr;
  if (bucket === "week") return mondayOf(dateStr);
  return dateStr.slice(0, 7); // month: YYYY-MM
}

function bucketSequence(start, end, bucket) {
  const keys = [];
  if (bucket === "day") {
    for (let d = start; d <= end; d = shiftDays(d, 1)) keys.push(d);
  } else if (bucket === "week") {
    for (let d = mondayOf(start); d <= end; d = shiftDays(d, 7)) keys.push(d);
  } else {
    let cur = start.slice(0, 7);
    const last = end.slice(0, 7);
    while (cur <= last) {
      keys.push(cur);
      const [y, m] = cur.split("-").map(Number);
      const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
      cur = next;
    }
  }
  return keys;
}

async function getTrends(range) {
  const where = reportWhere(range);
  const [dailyTotals, dailySif] = await Promise.all([
    Report.findAll({
      attributes: ["date", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
      where,
      group: ["date"],
      raw: true,
    }),
    AIAnalysis.findAll({
      attributes: [[sequelize.col("report.date"), "date"], [sequelize.fn("COUNT", sequelize.col("AIAnalysis.id")), "count"]],
      where: { analysisStatus: "COMPLETED", sifPotential: true },
      include: [reportIncludeInRange(range)],
      group: ["report.date"],
      raw: true,
    }),
  ]);
  if (dailyTotals.length === 0) return { bucket: "day", points: [] };

  const dates = dailyTotals.map((r) => r.date).sort();
  const start = range.dateFrom || dates[0];
  const end = range.dateTo || todayUTC();
  const spanDays = Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000);
  // Grouping rule (documented): <=31d daily, <=120d weekly (Monday start), else monthly.
  const bucket = spanDays <= 31 ? "day" : spanDays <= 120 ? "week" : "month";

  const totals = {};
  for (const r of dailyTotals) {
    const k = bucketKey(r.date, bucket);
    totals[k] = (totals[k] || 0) + Number(r.count);
  }
  const sifs = {};
  for (const r of dailySif) {
    const k = bucketKey(r.date, bucket);
    sifs[k] = (sifs[k] || 0) + Number(r.count);
  }
  const points = bucketSequence(start, end, bucket).map((date) => ({
    date,
    totalReports: totals[date] || 0,
    sifReports: sifs[date] || 0,
  }));
  return { bucket, points };
}

async function getSiteAnalytics(range) {
  const where = reportWhere(range);
  const [totals, sifs, highs] = await Promise.all([
    Report.findAll({
      attributes: ["siteId", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
      where,
      group: ["siteId"],
      raw: true,
    }),
    AIAnalysis.findAll({
      attributes: [[sequelize.col("report.siteId"), "siteId"], [sequelize.fn("COUNT", sequelize.col("AIAnalysis.id")), "count"]],
      where: { analysisStatus: "COMPLETED", sifPotential: true },
      include: [reportIncludeInRange(range)],
      group: ["report.siteId"],
      raw: true,
    }),
    AIAnalysis.findAll({
      attributes: [[sequelize.col("report.siteId"), "siteId"], [sequelize.fn("COUNT", sequelize.col("AIAnalysis.id")), "count"]],
      where: { analysisStatus: "COMPLETED", priority: { [Op.in]: HIGH_CRITICAL } },
      include: [reportIncludeInRange(range)],
      group: ["report.siteId"],
      raw: true,
    }),
  ]);
  const ids = [...new Set(totals.map((r) => r.siteId))];
  const sites = ids.length
    ? await Site.findAll({ where: { id: { [Op.in]: ids } }, attributes: ["id", "name", "code"] })
    : [];
  const byId = new Map(sites.map((s) => [s.id, s]));
  const lookup = (rows) => {
    const m = new Map();
    for (const r of rows) m.set(r.siteId, Number(r.count));
    return m;
  };
  const sifMap = lookup(sifs);
  const highMap = lookup(highs);
  return totals
    .map((r) => ({
      siteId: r.siteId,
      siteName: byId.get(r.siteId)?.name || "Unknown site",
      siteCode: byId.get(r.siteId)?.code || null,
      reportCount: Number(r.count),
      sifCount: sifMap.get(r.siteId) || 0,
      highCriticalCount: highMap.get(r.siteId) || 0,
    }))
    .sort((a, b) => b.reportCount - a.reportCount);
}

async function getActivityAnalytics(range) {
  const where = reportWhere(range);
  const [totals, sifs, highs] = await Promise.all([
    Report.findAll({
      attributes: ["activity", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
      where,
      group: ["activity"],
      raw: true,
    }),
    AIAnalysis.findAll({
      attributes: [[sequelize.col("report.activity"), "activity"], [sequelize.fn("COUNT", sequelize.col("AIAnalysis.id")), "count"]],
      where: { analysisStatus: "COMPLETED", sifPotential: true },
      include: [reportIncludeInRange(range)],
      group: ["report.activity"],
      raw: true,
    }),
    AIAnalysis.findAll({
      attributes: [[sequelize.col("report.activity"), "activity"], [sequelize.fn("COUNT", sequelize.col("AIAnalysis.id")), "count"]],
      where: { analysisStatus: "COMPLETED", priority: { [Op.in]: HIGH_CRITICAL } },
      include: [reportIncludeInRange(range)],
      group: ["report.activity"],
      raw: true,
    }),
  ]);
  const lookup = (rows) => {
    const m = new Map();
    for (const r of rows) m.set(r.activity, Number(r.count));
    return m;
  };
  const sifMap = lookup(sifs);
  const highMap = lookup(highs);
  return totals
    .map((r) => ({
      activity: r.activity,
      reportCount: Number(r.count),
      sifCount: sifMap.get(r.activity) || 0,
      highCriticalCount: highMap.get(r.activity) || 0,
    }))
    .sort((a, b) => b.reportCount - a.reportCount);
}

async function getRuleAnalytics(range) {
  const base = {
    analysisStatus: "COMPLETED",
    lifeSavingRuleId: { [Op.ne]: null },
  };
  const [totals, sifs] = await Promise.all([
    AIAnalysis.findAll({
      attributes: ["lifeSavingRuleId", [sequelize.fn("COUNT", sequelize.col("AIAnalysis.id")), "count"]],
      where: base,
      include: [reportIncludeInRange(range)],
      group: ["lifeSavingRuleId"],
      raw: true,
    }),
    AIAnalysis.findAll({
      attributes: ["lifeSavingRuleId", [sequelize.fn("COUNT", sequelize.col("AIAnalysis.id")), "count"]],
      where: { ...base, sifPotential: true },
      include: [reportIncludeInRange(range)],
      group: ["lifeSavingRuleId"],
      raw: true,
    }),
  ]);
  const ids = [...new Set(totals.map((r) => r.lifeSavingRuleId))];
  const rules = ids.length
    ? await LifeSavingRule.findAll({ where: { id: { [Op.in]: ids } }, attributes: ["id", "code", "name", "isPrototype"] })
    : [];
  const byId = new Map(rules.map((r) => [r.id, r]));
  const sifMap = new Map(sifs.map((r) => [r.lifeSavingRuleId, Number(r.count)]));
  return totals
    .map((r) => ({
      ruleId: r.lifeSavingRuleId,
      ruleCode: byId.get(r.lifeSavingRuleId)?.code || "UNKNOWN",
      ruleName: byId.get(r.lifeSavingRuleId)?.name || "Unknown rule",
      isPrototype: byId.get(r.lifeSavingRuleId)?.isPrototype ?? true,
      reportCount: Number(r.count),
      sifCount: sifMap.get(r.lifeSavingRuleId) || 0,
    }))
    .sort((a, b) => b.reportCount - a.reportCount);
}

// Phase 7: text-grounded analytics over the layered engine columns.
// Dialect-agnostic on purpose (works on MySQL JSON + SQLite): completed
// analyses in range are fetched once and counted in JS. All counts come
// from real rows — no hardcoded or sample data.
async function getCompletedAssessments(range) {
  return AIAnalysis.findAll({
    where: { analysisStatus: "COMPLETED" },
    attributes: ["primaryRule", "hazardEnergy", "barriersFailed", "route"],
    include: [reportIncludeInRange(range)],
    raw: true,
  });
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  // raw:true returns JSON columns as strings on SQLite (objects on MySQL).
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function topCounts(rows, pick, limit = 10) {
  const counts = new Map();
  for (const row of rows) {
    for (const key of pick(row)) {
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

async function getPrecursorRules(range) {
  const rows = await getCompletedAssessments(range);
  return topCounts(rows, (r) => (r.primaryRule ? [r.primaryRule] : []));
}

async function getBarrierAnalytics(range) {
  const rows = await getCompletedAssessments(range);
  return topCounts(rows, (r) => asArray(r.barriersFailed));
}

async function getEnergyAnalytics(range) {
  const rows = await getCompletedAssessments(range);
  return topCounts(rows, (r) => (r.hazardEnergy ? [r.hazardEnergy] : []));
}

async function getRecentReports(limit = 10) {  const rows = await AIAnalysis.findAll({
    where: { analysisStatus: "COMPLETED", priority: { [Op.in]: HIGH_CRITICAL } },
    include: [
      {
        model: Report,
        as: "report",
        required: true,
        attributes: ["id", "reportNumber", "date", "activity", "reportType", "status"],
        include: [{ model: Site, as: "site", attributes: ["id", "name", "code"] }],
      },
    ],
    order: [[{ model: Report, as: "report" }, "date", "DESC"]],
    limit,
  });
  return rows.map((a) => ({
    analysisId: a.id,
    reportId: a.report.id,
    reportNumber: a.report.reportNumber,
    date: a.report.date,
    siteName: a.report.site?.name || "Unknown site",
    activity: a.report.activity,
    reportType: a.report.reportType,
    sifPotential: a.sifPotential,
    priority: a.priority,
    status: a.report.status,
  }));
}

async function getPendingReviews(limit = 20, range) {
  const where = { status: "UNDER_REVIEW", ...reportWhere(range) };
  const rows = await Report.findAndCountAll({
    where,
    attributes: ["id", "reportNumber", "date", "activity", "reportType", "status"],
    include: [
      { model: Site, as: "site", attributes: ["id", "name", "code"] },
      { model: AIAnalysis, as: "aiAnalysis", required: false },
    ],
    order: [["date", "ASC"], ["createdAt", "ASC"]],
    limit,
  });
  return {
    items: rows.rows.map((r) => ({
      reportId: r.id,
      reportNumber: r.reportNumber,
      date: r.date,
      siteName: r.site?.name || "Unknown site",
      activity: r.activity,
      reportType: r.reportType,
      sifPotential: r.aiAnalysis?.analysisStatus === "COMPLETED" ? r.aiAnalysis.sifPotential : null,
      priority: r.aiAnalysis?.analysisStatus === "COMPLETED" ? r.aiAnalysis.priority : null,
      status: r.status,
    })),
    total: rows.count,
  };
}

module.exports = {
  resolveRange,
  getOverview,
  getDistributions,
  getTrends,
  getSiteAnalytics,
  getActivityAnalytics,
  getRuleAnalytics,
  getPrecursorRules,
  getBarrierAnalytics,
  getEnergyAnalytics,
  getRecentReports,
  getPendingReviews,
};
