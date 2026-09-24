"use strict";

const dashboardService = require("../services/dashboard.service");
const { ok } = require("../utils/apiResponse");

function withRange(req) {
  return dashboardService.resolveRange(req.query);
}

async function overview(req, res, next) {
  try {
    return ok(res, await dashboardService.getOverview(withRange(req)), "Dashboard overview");
  } catch (err) {
    return next(err);
  }
}

async function trends(req, res, next) {
  try {
    return ok(res, await dashboardService.getTrends(withRange(req)), "Report trends");
  } catch (err) {
    return next(err);
  }
}

async function distributions(req, res, next) {
  try {
    return ok(res, await dashboardService.getDistributions(withRange(req)), "Distributions");
  } catch (err) {
    return next(err);
  }
}

async function sites(req, res, next) {
  try {
    return ok(res, { items: await dashboardService.getSiteAnalytics(withRange(req)) }, "Site analytics");
  } catch (err) {
    return next(err);
  }
}

async function activities(req, res, next) {
  try {
    return ok(res, { items: await dashboardService.getActivityAnalytics(withRange(req)) }, "Activity analytics");
  } catch (err) {
    return next(err);
  }
}

async function lifeSavingRules(req, res, next) {
  try {
    return ok(res, { items: await dashboardService.getRuleAnalytics(withRange(req)) }, "Life-saving rule analytics");
  } catch (err) {
    return next(err);
  }
}

async function recentReports(req, res, next) {
  try {
    const limit = req.query.limit || 10;
    return ok(res, { items: await dashboardService.getRecentReports(limit) }, "Recent high-priority reports");
  } catch (err) {
    return next(err);
  }
}

async function pendingReviews(req, res, next) {
  try {
    const limit = req.query.limit || 20;
    return ok(res, await dashboardService.getPendingReviews(limit, withRange(req)), "Pending HSE reviews");
  } catch (err) {
    return next(err);
  }
}

async function precursorRules(req, res, next) {
  try {
    return ok(res, { items: await dashboardService.getPrecursorRules(withRange(req)) }, "Top SIF precursor rules");
  } catch (err) {
    return next(err);
  }
}

async function barriers(req, res, next) {
  try {
    return ok(res, { items: await dashboardService.getBarrierAnalytics(withRange(req)) }, "Top failed barriers");
  } catch (err) {
    return next(err);
  }
}

async function energies(req, res, next) {
  try {
    return ok(res, { items: await dashboardService.getEnergyAnalytics(withRange(req)) }, "Top hazard energies");
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  overview,
  trends,
  distributions,
  sites,
  activities,
  lifeSavingRules,
  precursorRules,
  barriers,
  energies,
  recentReports,
  pendingReviews,
};
