"use strict";

const { Op } = require("sequelize");
const { AppError } = require("../utils/errors");
const { getPagination } = require("../utils/pagination");
const sequelize = require("../config/database");
const Review = require("../models/Review");
const Report = require("../models/Report");
const Site = require("../models/Site");
const User = require("../models/User");
const AIAnalysis = require("../models/AIAnalysis");
const logger = require("../config/logger");

const REVIEWER_ATTRS = ["id", "name", "email", "role"];

// Report status state machine (no new status values introduced):
//   NEW/ANALYZED --review--> UNDER_REVIEW --CONFIRMED/REJECTED--> CLOSED
//   UNDER_REVIEW --NEEDS_MORE_INFO--> UNDER_REVIEW (stays)
function nextStatus(currentStatus, hseDecision) {
  if (currentStatus === "CLOSED") {
    throw new AppError("This report is already closed.", 409, "REVIEW_NOT_ALLOWED");
  }
  if (hseDecision === "NEEDS_MORE_INFO") return "UNDER_REVIEW";
  return "CLOSED"; // CONFIRMED or REJECTED (from NEW or UNDER_REVIEW)
}

async function createReview({ reportId, hseDecision, comment, reasonCode }, reviewer) {
  const result = await sequelize.transaction(async (t) => {
    const report = await Report.findByPk(reportId, { transaction: t });
    if (!report) {
      throw new AppError("Report not found", 404, "REPORT_NOT_FOUND");
    }

    const previousStatus = report.status;
    const newStatus = nextStatus(report.status, hseDecision);

    // Historical record: always INSERT, never overwrite. aiPrediction stays
    // NULL — no AI in this step, no fake values.
    const review = await Review.create(
      {
        reportId: report.id,
        reviewerId: reviewer.id,
        aiPrediction: null,
        hseDecision,
        comment: comment || null,
        reasonCode: reasonCode || null,
        reviewedAt: new Date(),
      },
      { transaction: t }
    );

    await report.update({ status: newStatus }, { transaction: t });

    // W9.6 — audit what actually happened, atomically with the review.
    const auditService = require("./audit.service");
    const { AUDIT_EVENT_TYPES, AUDIT_ACTOR_TYPES } = require("../utils/auditEvents");
    const isFirstTouch = previousStatus === "NEW" || previousStatus === "ANALYZED";
    if (isFirstTouch) {
      await auditService.createAuditEvent(
        {
          reportId: report.id,
          actorUserId: reviewer.id,
          actorType: AUDIT_ACTOR_TYPES.HSE,
          eventType: AUDIT_EVENT_TYPES.HSE_REVIEW_STARTED,
          eventKey: `HSE_REVIEW_STARTED:${review.id}`,
          description: `HSE review started for report ${report.reportNumber}.`,
          metadata: { reviewId: review.id, reportNumber: report.reportNumber },
          previousStatus,
          newStatus,
        },
        { transaction: t }
      );
    }
    const decisionEvent =
      hseDecision === "NEEDS_MORE_INFO"
        ? AUDIT_EVENT_TYPES.HSE_NEEDS_MORE_INFO
        : hseDecision === "CONFIRMED"
          ? AUDIT_EVENT_TYPES.HSE_REVIEW_CONFIRMED
          : AUDIT_EVENT_TYPES.HSE_REVIEW_REJECTED;
    const decisionLabel =
      hseDecision === "NEEDS_MORE_INFO"
        ? "Additional information requested"
        : hseDecision === "CONFIRMED"
          ? "confirmed"
          : "rejected";
    await auditService.createAuditEvent(
      {
        reportId: report.id,
        actorUserId: reviewer.id,
        actorType: AUDIT_ACTOR_TYPES.HSE,
        eventType: decisionEvent,
        eventKey: `${decisionEvent}:${review.id}`,
        description: `HSE review ${decisionLabel} for report ${report.reportNumber}.`,
        // Worker-safe: comment/reasonCode are already visible on the worker
        // report detail via latestReview, so they are safe in history too.
        metadata: {
          reviewId: review.id,
          decision: hseDecision,
          ...(comment ? { comment: String(comment).slice(0, 2000) } : {}),
          ...(reasonCode ? { reasonCode } : {}),
        },
        previousStatus,
        newStatus,
      },
      { transaction: t }
    );

    return { review, reportStatus: newStatus, reportNumber: report.reportNumber, report };
  });
  // Notifications — best effort, outside transaction to not fail review
  try {
    const notificationService = require("./notification.service");
    const report = result.report;
    const review = result.review;
    const workerId = report.createdBy;
    const reportNumber = report.reportNumber;
    if (hseDecision === "NEEDS_MORE_INFO") {
      await notificationService.createNotification({
        userId: workerId,
        type: "HSE_NEEDS_INFORMATION",
        title: "Additional Information Required",
        message: `HSE requires additional information for report ${reportNumber}.`,
        reportId: report.id,
        eventKey: `HSE_NEEDS_INFORMATION:${review.id}:${workerId}`,
      });
    } else if (hseDecision === "CONFIRMED") {
      await notificationService.createNotification({
        userId: workerId,
        type: "REPORT_CONFIRMED",
        title: "Report Confirmed",
        message: `Your report ${reportNumber} has been reviewed and confirmed by HSE.`,
        reportId: report.id,
        eventKey: `REPORT_CONFIRMED:${review.id}:${workerId}`,
      });
      // Also CLOSED notification if status became CLOSED
      if (result.reportStatus === "CLOSED") {
        await notificationService.createNotification({
          userId: workerId,
          type: "REPORT_CLOSED",
          title: "Report Closed",
          message: `Your report ${reportNumber} has been closed.`,
          reportId: report.id,
          eventKey: `REPORT_CLOSED:${report.id}:${workerId}`,
        });
      }
    } else if (hseDecision === "REJECTED") {
      await notificationService.createNotification({
        userId: workerId,
        type: "REPORT_REJECTED",
        title: "Report Rejected",
        message: `Your report ${reportNumber} has been reviewed and rejected by HSE.`,
        reportId: report.id,
        eventKey: `REPORT_REJECTED:${review.id}:${workerId}`,
      });
      if (result.reportStatus === "CLOSED") {
        await notificationService.createNotification({
          userId: workerId,
          type: "REPORT_CLOSED",
          title: "Report Closed",
          message: `Your report ${reportNumber} has been closed.`,
          reportId: report.id,
          eventKey: `REPORT_CLOSED:${report.id}:${workerId}`,
        });
      }
    }
  } catch (e) {
    logger.error(`[notification] HSE review notification failed for ${reportId}: ${e.message}`);
  }
  return { review: result.review, reportStatus: result.reportStatus };
}

function reviewIncludes() {
  return [
    {
      model: Report,
      as: "report",
      include: [
        { model: Site, as: "site", attributes: ["id", "name", "code"] },
        { model: AIAnalysis, as: "aiAnalysis" },
      ],
    },
    { model: User, as: "reviewer", attributes: REVIEWER_ATTRS },
  ];
}

async function getReviewById(id) {
  const review = await Review.findByPk(id, { include: reviewIncludes() });
  if (!review) throw new AppError("Review not found", 404, "NOT_FOUND");
  return review;
}

async function getReviews(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const where = {};
  if (query.reportId) where.reportId = query.reportId;
  if (query.reviewerId) where.reviewerId = query.reviewerId;
  if (query.hseDecision) where.hseDecision = query.hseDecision;
  if (query.dateFrom || query.dateTo) {
    where.createdAt = {};
    if (query.dateFrom) where.createdAt[Op.gte] = query.dateFrom;
    if (query.dateTo) where.createdAt[Op.lte] = query.dateTo;
  }

  const { rows, count } = await Review.findAndCountAll({
    where,
    limit,
    offset: skip,
    order: [["createdAt", "DESC"]],
    include: [
      { model: Report, as: "report", attributes: ["id", "reportNumber", "status", "reportType"] },
      { model: User, as: "reviewer", attributes: REVIEWER_ATTRS },
    ],
  });

  return {
    items: rows,
    pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
  };
}

// Pending = reports awaiting a final HSE decision.
async function getPendingReviews(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const { rows, count } = await Report.findAndCountAll({
    where: { status: "UNDER_REVIEW" },
    limit,
    offset: skip,
    order: [["createdAt", "DESC"]],
    attributes: [
      "id",
      "reportNumber",
      "date",
      "location",
      "activity",
      "reportType",
      "description",
      "equipment",
      "status",
      "createdAt",
    ],
    include: [
      { model: Site, as: "site", attributes: ["id", "name", "code"] },
      { model: AIAnalysis, as: "aiAnalysis" },
    ],
  });

  return {
    items: rows,
    pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
  };
}

async function getActionCenter(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const whereReport = {};
  const whereAI = {};
  let needReviewJoin = false;

  if (query.siteId) whereReport.siteId = query.siteId;
  if (query.reportType) whereReport.reportType = query.reportType;
  if (query.dateFrom || query.dateTo) {
    whereReport.date = {};
    if (query.dateFrom) whereReport.date[Op.gte] = query.dateFrom;
    if (query.dateTo) whereReport.date[Op.lte] = query.dateTo;
  }
  if (query.route) {
    whereAI.route = query.route;
    needReviewJoin = true;
  }
  if (query.sifPotential) {
    if (query.sifPotential === "YES") whereAI.sifPotential = true;
    else if (query.sifPotential === "NO") whereAI.sifPotential = false;
    else if (query.sifPotential === "INSUFFICIENT") whereAI.sifPotential = null;
    needReviewJoin = true;
  }

  // For status that maps to Report.status directly
  const directStatuses = ["NEW", "ANALYZED", "UNDER_REVIEW", "CLOSED"];
  if (query.status && directStatuses.includes(query.status)) {
    whereReport.status = query.status;
  }

  // Search
  const search = query.search ? String(query.search).trim() : null;
  if (search) {
    whereReport[Op.or] = [
      { reportNumber: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
      { activity: { [Op.like]: `%${search}%` } },
      { equipment: { [Op.like]: `%${search}%` } },
    ];
  }

  // Base include for AI
  const aiInclude = {
    model: AIAnalysis,
    as: "aiAnalysis",
    required: needReviewJoin ? true : false,
    where: Object.keys(whereAI).length ? whereAI : undefined,
    attributes: ["id", "route", "riskScore", "sifPotential", "priority", "analysisStatus", "primaryRule", "hazardEnergy"],
  };

  // For status that is review decision, we need to filter via latest review
  const reviewStatuses = ["NEEDS_MORE_INFO", "CONFIRMED", "REJECTED"];
  const isReviewStatus = query.status && reviewStatuses.includes(query.status);

  let reportIdsForReviewStatus = null;
  if (isReviewStatus) {
    // Find reportIds whose latest review decision matches
    const allReviews = await Review.findAll({
      attributes: ["reportId", "hseDecision", "reviewedAt", "createdAt"],
      order: [["reportId", "ASC"], ["reviewedAt", "DESC"], ["createdAt", "DESC"]],
      raw: true,
    });
    const latestByReport = new Map();
    for (const r of allReviews) {
      if (!latestByReport.has(r.reportId)) latestByReport.set(r.reportId, r.hseDecision);
    }
    reportIdsForReviewStatus = [...latestByReport.entries()].filter(([, dec]) => dec === query.status).map(([rid]) => rid);
    if (reportIdsForReviewStatus.length === 0) {
      return {
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        summary: await getActionCenterSummary(),
      };
    }
    whereReport.id = { [Op.in]: reportIdsForReviewStatus };
  }

  // For search that is on description etc, we already have whereReport[Op.or]

  const { rows, count } = await Report.findAndCountAll({
    where: whereReport,
    include: [
      { model: Site, as: "site", attributes: ["id", "name", "code"] },
      { model: User, as: "creator", attributes: ["id", "name", "email"] },
      aiInclude,
    ],
    order: [["createdAt", "DESC"]],
    limit,
    offset: skip,
    distinct: true,
  });

  // Need to fetch latest review for each to handle isReviewStatus already filtered, but for general we need to ensure distinct count is correct when we filtered via reportIds
  // For other statuses, we already have whereReport

  // Enrich with submittedBy and risk etc for response - already via includes
  const items = rows.map((r) => {
    const plain = r.get({ plain: true });
    return plain;
  });

  // If we filtered via review status, count is already filtered; else need to ensure pagination total is count from query

  const pagination = { page, limit, total: count, totalPages: Math.ceil(count / limit) };
  const summary = await getActionCenterSummary();

  return { items, pagination, summary };
}

async function getActionCenterSummary() {
  // Pending Review: reports requiring HSE action (ANALYZED or UNDER_REVIEW and not CLOSED, route not AUTO_CLOSE)
  const pendingReview = await Report.count({
    where: { status: { [Op.in]: ["ANALYZED", "UNDER_REVIEW"] } },
    include: [{ model: AIAnalysis, as: "aiAnalysis", required: false, where: { route: { [Op.ne]: "AUTO_CLOSE" } } }],
    distinct: true,
    col: "id",
  }).catch(async () => {
    // Fallback: count without AI join if route filter fails due to null
    const total = await Report.count({ where: { status: { [Op.in]: ["ANALYZED", "UNDER_REVIEW"] } } });
    const autoClose = await Report.count({
      where: { status: { [Op.in]: ["ANALYZED", "UNDER_REVIEW"] } },
      include: [{ model: AIAnalysis, as: "aiAnalysis", where: { route: "AUTO_CLOSE" }, required: true }],
    });
    return total - autoClose;
  });

  // More accurate fallback for pending if above fails: simple count of UNDER_REVIEW + ANALYZED
  let pendingCount = pendingReview;
  if (typeof pendingCount !== "number" || isNaN(pendingCount)) {
    pendingCount = await Report.count({ where: { status: { [Op.in]: ["ANALYZED", "UNDER_REVIEW"] } } });
  }

  const priority = await Report.count({
    where: { status: { [Op.ne]: "CLOSED" } },
    include: [{ model: AIAnalysis, as: "aiAnalysis", where: { route: "PRIORITY", analysisStatus: "COMPLETED" }, required: true }],
    distinct: true,
    col: "id",
  });

  const uncertainOrAbstain = await Report.count({
    where: { status: { [Op.ne]: "CLOSED" } },
    include: [{ model: AIAnalysis, as: "aiAnalysis", where: { route: { [Op.in]: ["UNCERTAIN", "ABSTAIN"] }, analysisStatus: "COMPLETED" }, required: true }],
    distinct: true,
    col: "id",
  });

  // Needs Information: latest review NEEDS_MORE_INFO
  const allReviews = await Review.findAll({
    attributes: ["reportId", "hseDecision", "reviewedAt", "createdAt"],
    order: [["reportId", "ASC"], ["reviewedAt", "DESC"], ["createdAt", "DESC"]],
    raw: true,
  });
  const latestByReport = new Map();
  for (const r of allReviews) {
    if (!latestByReport.has(r.reportId)) latestByReport.set(r.reportId, r.hseDecision);
  }
  let needsInformation = 0;
  for (const dec of latestByReport.values()) if (dec === "NEEDS_MORE_INFO") needsInformation++;

  // Ensure pendingReview is not double-counted with other categories, but we keep as defined
  return {
    pendingReview: pendingCount,
    priority,
    uncertainOrAbstain,
    needsInformation,
  };
}

module.exports = { createReview, getReviewById, getReviews, getPendingReviews, getActionCenter, getActionCenterSummary, nextStatus };
