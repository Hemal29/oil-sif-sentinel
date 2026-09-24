"use strict";

const { Op } = require("sequelize");
const { AppError } = require("../utils/errors");
const { getPagination } = require("../utils/pagination");
const { IMMUTABLE_REPORT_FIELDS } = require("../validators/report.validator");
const Report = require("../models/Report");
const Site = require("../models/Site");
const User = require("../models/User");
const AIAnalysis = require("../models/AIAnalysis");
const logger = require("../config/logger");
const { AUDIT_EVENT_TYPES, actorTypeForRole } = require("../utils/auditEvents");

const SORT_FIELDS = ["date", "createdAt", "reportNumber"];

function duplicateError(err) {
  if (err && err.name === "SequelizeUniqueConstraintError") {
    throw new AppError("Report number already exists", 409, "DUPLICATE_REPORT_NUMBER");
  }
  throw err;
}

function isWorker(user) {
  return user && user.role === "USER";
}

async function createReport(data, userIdOrUser, options = {}) {
  const site = await Site.findByPk(data.siteId);
  if (!site) {
    throw new AppError("Site not found", 404, "SITE_NOT_FOUND");
  }
  const actorUser =
    userIdOrUser && typeof userIdOrUser === "object" ? userIdOrUser : null;
  const userId = actorUser ? actorUser.id : userIdOrUser;
  let report;
  try {
    report = await Report.create({ ...data, createdBy: userId }, { transaction: options.transaction });
  } catch (err) {
    return duplicateError(err);
  }
  // W9.6 — audit the real submission event (idempotent via eventKey).
  // Actor role resolves from the JWT user when provided, else the DB row.
  try {
    let resolvedActor = actorUser;
    if (!resolvedActor && userId) {
      const row = await User.findByPk(userId, { attributes: ["id", "role"] });
      if (row) resolvedActor = { id: row.id, role: row.role };
    }
    const auditService = require("./audit.service");
    await auditService.createAuditEvent(
      {
        reportId: report.id,
        actorUserId: userId,
        eventType: AUDIT_EVENT_TYPES.REPORT_SUBMITTED,
        eventKey: `REPORT_SUBMITTED:${report.id}`,
        description: `Report ${report.reportNumber} submitted.`,
        metadata: { reportNumber: report.reportNumber, reportType: report.reportType },
        previousStatus: null,
        newStatus: report.status,
      },
      { transaction: options.transaction, actorUser: resolvedActor }
    );
  } catch (err) {
    logger.error(`[audit] REPORT_SUBMITTED failed for ${report.id}: ${err.message}`);
  }
  return report;
}

async function listReports(query = {}, user = null) {
  const { page, limit, skip } = getPagination(query);
  const where = {};

  // Workers see only their own submissions (JWT identity, never client input).
  // HSE roles keep full visibility — unchanged behavior.
  if (isWorker(user)) {
    where.createdBy = user.id;
  }

  if (query.search) {
    where[Op.or] = [
      { reportNumber: { [Op.like]: `%${query.search}%` } },
      { description: { [Op.like]: `%${query.search}%` } },
    ];
  }
  if (query.site) where.siteId = query.site;
  if (query.activity) where.activity = { [Op.like]: `%${query.activity}%` };
  if (query.reportType) where.reportType = query.reportType;
  if (query.status) where.status = query.status;
  if (query.dateFrom || query.dateTo) {
    where.date = {};
    if (query.dateFrom) where.date[Op.gte] = query.dateFrom;
    if (query.dateTo) where.date[Op.lte] = query.dateTo;
  }

  const sortBy = SORT_FIELDS.includes(query.sortBy) ? query.sortBy : "createdAt";
  const sortOrder = String(query.sortOrder || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

  const { rows, count } = await Report.findAndCountAll({
    where,
    limit, // never load the whole table
    offset: skip,
    order: [[sortBy, sortOrder]],
    include: [
      { model: Site, as: "site", attributes: ["id", "name", "code"] },
      { model: User, as: "creator", attributes: ["id", "name", "email"] },
      {
        model: AIAnalysis,
        as: "aiAnalysis",
        required: false,
        attributes: [
          "id",
          "reportId",
          "sifPotential",
          "confidence",
          "priority",
          "route",
          "analysisStatus",
          "riskScore",
          "primaryRule",
          "secondaryRules",
          "hazardEnergy",
          "barriersFailed",
          "assets",
          "rationale",
          "extractionStatus",
        ],
      },
    ],
  });

  return {
    items: rows,
    pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
  };
}

async function getReportById(id, user = null) {
  const report = await Report.findByPk(id, {
    include: [
      { model: Site, as: "site", attributes: ["id", "name", "code"] },
      { model: User, as: "creator", attributes: ["id", "name", "email"] },
      { model: AIAnalysis, as: "aiAnalysis" },
    ],
  });
  if (!report) throw new AppError("Report not found", 404, "NOT_FOUND");
  // Ownership: a worker accessing another worker's report gets 404 (same as
  // missing) so no report data — or its existence — ever leaks.
  if (isWorker(user) && report.createdBy !== user.id) {
    throw new AppError("Report not found", 404, "NOT_FOUND");
  }
  return report;
}

async function updateReport(id, data, user = null) {
  if (isWorker(user) && data.status !== undefined) {
    // Report lifecycle is HSE-driven; workers cannot move their own reports.
    throw new AppError("Only HSE reviewers can change report status", 403, "FORBIDDEN");
  }
  const immutableSent = IMMUTABLE_REPORT_FIELDS.filter((f) => data[f] !== undefined);
  if (immutableSent.length > 0) {
    throw new AppError(
      `These fields cannot be modified after creation: ${immutableSent.join(", ")}. ` +
        "Original report text is immutable evidence; corrections need an audit/version mechanism.",
      422,
      "IMMUTABLE_FIELD"
    );
  }
  const report = await Report.findByPk(id);
  if (!report) throw new AppError("Report not found", 404, "NOT_FOUND");
  if (isWorker(user) && report.createdBy !== user.id) {
    throw new AppError("Report not found", 404, "NOT_FOUND");
  }
  const previousStatus = report.status;
  let updated;
  try {
    updated = await report.update(data);
  } catch (err) {
    return duplicateError(err);
  }
  // W9.6 — audit meaningful metadata updates only (field names, never values).
  try {
    const changedFields = Object.keys(data).filter((f) => f !== "status");
    if (changedFields.length > 0) {
      const auditService = require("./audit.service");
      await auditService.createAuditEvent(
        {
          reportId: report.id,
          actorUserId: user ? user.id : null,
          eventType: AUDIT_EVENT_TYPES.REPORT_UPDATED,
          eventKey: `REPORT_UPDATED:${report.id}:${updated.updatedAt.getTime()}`,
          description: `Report ${report.reportNumber} updated.`,
          metadata: { reportNumber: report.reportNumber, changedFields },
          previousStatus,
          newStatus: updated.status,
        },
        { actorUser: user }
      );
    }
  } catch (err) {
    logger.error(`[audit] REPORT_UPDATED failed for ${id}: ${err.message}`);
  }
  return updated;
}

module.exports = { createReport, listReports, getReportById, updateReport };
