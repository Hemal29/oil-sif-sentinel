"use strict";

// W9.6 — read-only audit history. No PATCH/PUT/DELETE exists by design:
// the trail is append-only; corrections are new events, never edits.
const reportService = require("../services/report.service");
const auditService = require("../services/audit.service");
const { ok } = require("../utils/apiResponse");

async function getReportAudit(req, res, next) {
  try {
    // Ownership + existence enforced by the existing service:
    // workers get 404 for other workers' reports (no leak), HSE keeps access.
    await reportService.getReportById(req.params.id, req.user);
    const result = await auditService.getReportAuditHistory(req.params.id, req.query, req.user);
    return ok(res, result, "Report activity history");
  } catch (err) {
    return next(err);
  }
}

module.exports = { getReportAudit };
