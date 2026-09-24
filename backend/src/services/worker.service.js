"use strict";

// Worker Portal service: thin layer over the existing report infrastructure.
// No duplicate report logic — creation, listing and detail reuse
// report.service.js. Ownership always derives from the JWT identity.
//
// "Needs information" = own non-closed reports where HSE asked for more
// (latest review NEEDS_MORE_INFO) or the AI abstained (route ABSTAIN) and no
// HSE decision has closed the loop yet.

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { AppError } = require("../utils/errors");
const reportService = require("./report.service");
const Report = require("../models/Report");
const Site = require("../models/Site");
const AIAnalysis = require("../models/AIAnalysis");
const Review = require("../models/Review");
const User = require("../models/User");
const logger = require("../config/logger");

function workerReviewShape(review) {
  if (!review) return null;
  return {
    hseDecision: review.hseDecision,
    comment: review.comment,
    reasonCode: review.reasonCode,
    reviewedAt: review.reviewedAt,
  };
}

async function latestReviewFor(reportId) {
  return Review.findOne({
    where: { reportId },
    order: [["reviewedAt", "DESC"], ["createdAt", "DESC"]],
  });
}

function generateReportNumber() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `WRK-${day}-${rand}`;
}

async function createWorkerReport(data, userId) {
  // No AI triggered here — submission stores original evidence only.
  // The existing Phase 7 pipeline runs when HSE analyzes the report.
  let report;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      report = await reportService.createReport(
        { ...data, reportNumber: generateReportNumber() },
        userId
      );
      break;
    } catch (err) {
      if (err && err.code === "DUPLICATE_REPORT_NUMBER" && attempt < 4) continue;
      throw err;
    }
  }
  if (!report) throw new AppError("Could not generate a report number, please retry", 503, "REPORT_NUMBER_FAILED");
  // Notify HSE — best effort, do not fail report creation
  try {
    const notificationService = require("./notification.service");
    const hseIds = await notificationService.getHseUserIds();
    if (hseIds.length > 0) {
      await notificationService.createNotificationsForUsers(hseIds, {
        type: "REPORT_SUBMITTED",
        title: "New Report Submitted",
        message: `Report ${report.reportNumber} has been submitted and is ready for HSE assessment.`,
        reportId: report.id,
        eventKeyPrefix: "REPORT_SUBMITTED",
      });
    }
  } catch (e) {
    logger.error(`[notification] failed REPORT_SUBMITTED for ${report.id}: ${e.message}`);
  }
  return report;
}

async function listMyReports(query, userId) {
  return reportService.listReports(query, { id: userId, role: "USER" });
}

async function getMyReport(id, userId) {
  const report = await Report.findByPk(id, {
    include: [
      { model: Site, as: "site", attributes: ["id", "name", "code"] },
      { model: AIAnalysis, as: "aiAnalysis" },
    ],
  });
  if (!report || report.createdBy !== userId) {
    // Same 404 as missing: no data — or its existence — leaks to other workers.
    throw new AppError("Report not found", 404, "NOT_FOUND");
  }
  const latestReview = await latestReviewFor(report.id);
  const plain = report.get({ plain: true });
  plain.latestReview = workerReviewShape(latestReview);
  return plain;
}

async function getMySummary(userId) {
  const reports = await Report.findAll({
    where: { createdBy: userId },
    attributes: ["id", "status"],
    include: [{ model: AIAnalysis, as: "aiAnalysis", attributes: ["route"], required: false }],
  });
  let underReview = 0;
  let closed = 0;
  let needsInformation = 0;
  for (const report of reports) {
    if (report.status === "UNDER_REVIEW") underReview += 1;
    if (report.status === "CLOSED") closed += 1;
    if (report.status !== "CLOSED") {
      const latest = await latestReviewFor(report.id);
      if (
        (latest && latest.hseDecision === "NEEDS_MORE_INFO") ||
        (report.aiAnalysis && report.aiAnalysis.route === "ABSTAIN")
      ) {
        needsInformation += 1;
      }
    }
  }
  return {
    myReports: reports.length,
    underReview,
    needsInformation,
    closed,
  };
}

async function registerWorker({ name, employeeId, email, mobile, password }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const existingEmail = await User.findOne({ where: { email: normalizedEmail } });
  if (existingEmail) {
    throw new AppError("An account with this email already exists.", 409, "DUPLICATE_EMAIL");
  }
  if (employeeId) {
    const trimmedEmp = String(employeeId).trim();
    const existingEmp = await User.findOne({ where: { employeeId: trimmedEmp } });
    if (existingEmp) {
      throw new AppError("An account with this Employee ID already exists.", 409, "DUPLICATE_EMPLOYEE_ID");
    }
  }
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await User.create({
      name: String(name).trim(),
      employeeId: employeeId ? String(employeeId).trim() : null,
      mobile: mobile ? String(mobile).trim() : null,
      email: normalizedEmail,
      passwordHash,
      role: "USER",
      status: "ACTIVE",
    });
    const plain = user.get({ plain: true });
    const { passwordHash: _ph, ...safe } = plain;
    return safe;
  } catch (err) {
    if (err && err.name === "SequelizeUniqueConstraintError") {
      const fields = err.fields || {};
      if (fields.email || (err.errors && err.errors.some((e) => e.path === "email"))) {
        throw new AppError("An account with this email already exists.", 409, "DUPLICATE_EMAIL");
      }
      if (fields.employeeId || (err.errors && err.errors.some((e) => e.path === "employeeId"))) {
        throw new AppError("An account with this Employee ID already exists.", 409, "DUPLICATE_EMPLOYEE_ID");
      }
    }
    throw err;
  }
}

function toSafeUser(user) {
  const plain = user.get ? user.get({ plain: true }) : user;
  const { passwordHash, ...safe } = plain;
  return safe;
}

async function getWorkerProfile(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
  return toSafeUser(user);
}

async function updateWorkerProfile(userId, data) {
  const user = await User.findByPk(userId);
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
  const updates = {};
  if (data.name !== undefined) {
    const trimmed = String(data.name).trim();
    if (!trimmed) throw new AppError("Name must be at least 2 characters", 400, "VALIDATION_ERROR");
    updates.name = trimmed;
  }
  if (data.mobile !== undefined) {
    const trimmed = String(data.mobile).trim();
    updates.mobile = trimmed ? trimmed : null;
  }
  if (Object.keys(updates).length === 0) {
    throw new AppError("At least one field is required", 400, "VALIDATION_ERROR");
  }
  await user.update(updates);
  return toSafeUser(user);
}

async function changeWorkerPassword(userId, { currentPassword, newPassword }) {
  const user = await User.unscoped().findByPk(userId);
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) {
    throw new AppError("Current password is incorrect.", 401, "INVALID_PASSWORD");
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await user.update({ passwordHash });
  return toSafeUser(user);
}

module.exports = { createWorkerReport, listMyReports, getMyReport, getMySummary, registerWorker, getWorkerProfile, updateWorkerProfile, changeWorkerPassword };
