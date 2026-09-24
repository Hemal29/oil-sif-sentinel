"use strict";

const { AppError } = require("../utils/errors");
const { getPagination } = require("../utils/pagination");
const WorkerDraft = require("../models/WorkerDraft");
const Report = require("../models/Report");
const Site = require("../models/Site");
const crypto = require("crypto");

function generateReportNumber() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `WRK-${day}-${rand}`;
}

function toSafeDraft(draft) {
  return draft.get ? draft.get({ plain: true }) : draft;
}

async function createDraft(data, userId) {
  const draft = await WorkerDraft.create({
    userId,
    reportType: data.reportType || null,
    siteId: data.siteId || null,
    activity: data.activity ? String(data.activity).trim() : null,
    equipment: data.equipment ? String(data.equipment).trim() : null,
    description: data.description ? String(data.description).trim() : null,
    date: data.date ? data.date : null,
    location: data.location ? String(data.location).trim() : null,
  });
  return toSafeDraft(draft);
}

async function listDrafts(query, userId) {
  const { page, limit, skip } = getPagination(query);
  const { rows, count } = await WorkerDraft.findAndCountAll({
    where: { userId },
    limit,
    offset: skip,
    order: [["updatedAt", "DESC"]],
  });
  return {
    items: rows.map(toSafeDraft),
    pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
  };
}

async function getDraft(id, userId) {
  const draft = await WorkerDraft.findOne({ where: { id, userId } });
  if (!draft) throw new AppError("Draft not found", 404, "NOT_FOUND");
  return toSafeDraft(draft);
}

async function updateDraft(id, userId, data) {
  const draft = await WorkerDraft.findOne({ where: { id, userId } });
  if (!draft) throw new AppError("Draft not found", 404, "NOT_FOUND");
  const updates = {};
  if (data.reportType !== undefined) updates.reportType = data.reportType || null;
  if (data.siteId !== undefined) updates.siteId = data.siteId || null;
  if (data.activity !== undefined) updates.activity = data.activity ? String(data.activity).trim() : null;
  if (data.equipment !== undefined) updates.equipment = data.equipment ? String(data.equipment).trim() : null;
  if (data.description !== undefined) updates.description = data.description ? String(data.description).trim() : null;
  if (data.date !== undefined) updates.date = data.date || null;
  if (data.location !== undefined) updates.location = data.location ? String(data.location).trim() : null;
  await draft.update(updates);
  return toSafeDraft(draft);
}

async function deleteDraft(id, userId) {
  const draft = await WorkerDraft.findOne({ where: { id, userId } });
  if (!draft) throw new AppError("Draft not found", 404, "NOT_FOUND");
  await draft.destroy();
}

async function submitDraft(id, userId) {
  const draft = await WorkerDraft.findOne({ where: { id, userId } });
  if (!draft) throw new AppError("Draft not found", 404, "NOT_FOUND");
  const plain = draft.get({ plain: true });

  // Validate as real submitted report using existing strict schema
  const { workerCreateReportSchema } = require("../validators/worker.validator");
  const payload = {
    reportType: plain.reportType || undefined,
    siteId: plain.siteId || undefined,
    activity: plain.activity || undefined,
    equipment: plain.equipment || undefined,
    description: plain.description || undefined,
    date: plain.date || undefined,
    location: plain.location || undefined,
  };
  const parsed = workerCreateReportSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new AppError(first.message, 400, "VALIDATION_ERROR");
  }

  // Verify site exists for submit (same as reportService)
  const site = await Site.findByPk(parsed.data.siteId);
  if (!site) throw new AppError("Site not found", 404, "SITE_NOT_FOUND");

  const sequelize = require("../config/database");
  const logger = require("../config/logger");
  const result = await sequelize.transaction(async (t) => {
    let report;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        report = await Report.create(
          { ...parsed.data, reportNumber: generateReportNumber(), createdBy: userId },
          { transaction: t }
        );
        break;
      } catch (err) {
        if (err && err.name === "SequelizeUniqueConstraintError" && attempt < 4) continue;
        throw err;
      }
    }
    if (!report) throw new AppError("Could not generate a report number, please retry", 503, "REPORT_NUMBER_FAILED");
    await draft.destroy({ transaction: t });
    // W9.6 — Draft → Submit creates exactly one REPORT_SUBMITTED audit event,
    // atomically with report creation. Auto-saves never create audit events.
    const auditService = require("./audit.service");
    const { AUDIT_EVENT_TYPES } = require("../utils/auditEvents");
    await auditService.createAuditEvent(
      {
        reportId: report.id,
        actorUserId: userId,
        actorType: "USER",
        eventType: AUDIT_EVENT_TYPES.REPORT_SUBMITTED,
        eventKey: `REPORT_SUBMITTED:${report.id}`,
        description: `Report ${report.reportNumber} submitted.`,
        metadata: { reportNumber: report.reportNumber, reportType: report.reportType },
        previousStatus: null,
        newStatus: report.status,
      },
      { transaction: t }
    );
    return report;
  });
  // Notify HSE — best effort
  try {
    const notificationService = require("./notification.service");
    const hseIds = await notificationService.getHseUserIds();
    if (hseIds.length > 0) {
      await notificationService.createNotificationsForUsers(hseIds, {
        type: "REPORT_SUBMITTED",
        title: "New Report Submitted",
        message: `Report ${result.reportNumber} has been submitted and is ready for HSE assessment.`,
        reportId: result.id,
        eventKeyPrefix: "REPORT_SUBMITTED",
      });
    }
  } catch (e) {
    logger.error(`[notification] failed REPORT_SUBMITTED for ${result.id}: ${e.message}`);
  }
  return result;
}

module.exports = { createDraft, listDrafts, getDraft, updateDraft, deleteDraft, submitDraft };
