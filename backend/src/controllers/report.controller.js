"use strict";

const fs = require("fs");
const reportService = require("../services/report.service");
const importService = require("../services/import.service");
const { AppError } = require("../utils/errors");
const { ok, created } = require("../utils/apiResponse");

async function create(req, res, next) {
  try {
    // No AI triggered here — report creation stores original evidence only.
    const report = await reportService.createReport(req.body, req.user);
    return created(res, { report }, "Report created");
  } catch (err) {
    return next(err);
  }
}

async function list(req, res, next) {
  try {
    const result = await reportService.listReports(req.query, req.user);
    return ok(res, result, "Reports list");
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const report = await reportService.getReportById(req.params.id, req.user);
    return ok(res, { report }, "Report details");
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const report = await reportService.updateReport(req.params.id, req.body, req.user);
    return ok(res, { report }, "Report updated");
  } catch (err) {
    return next(err);
  }
}

async function uploadReports(req, res, next) {
  // createdBy always comes from the JWT — never from the file.
  const tmpPath = req.file ? req.file.path : null;
  try {
    if (!req.file) {
      throw new AppError("No file uploaded. Send multipart/form-data with field name 'file'.", 400, "FILE_REQUIRED");
    }
    const summary = await importService.importReportsFromFile({
      filePath: req.file.path,
      originalName: req.file.originalname,
      createdBy: req.user.id,
    });
    return ok(res, summary, summary.message);
  } catch (err) {
    return next(err);
  } finally {
    // Temp files are never kept — success or failure.
    if (tmpPath) {
      fs.unlink(tmpPath, () => {});
    }
  }
}

module.exports = { create, list, getById, update, uploadReports };
