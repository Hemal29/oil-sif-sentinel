"use strict";

const analysisService = require("../services/analysis.service");
const { ok } = require("../utils/apiResponse");

async function analyze(req, res, next) {
  try {
    // Report text is loaded from MySQL inside the service; the client
    // supplies only the report ID in the path.
    const { analysis, reportStatus } = await analysisService.analyzeReport(req.params.id);
    return ok(res, { analysis, reportStatus }, "Analysis completed");
  } catch (err) {
    return next(err);
  }
}

module.exports = { analyze };
