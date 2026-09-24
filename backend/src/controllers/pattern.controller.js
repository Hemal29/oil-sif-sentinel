"use strict";

const patternService = require("../services/pattern.service");
const { ok, created } = require("../utils/apiResponse");

async function list(req, res, next) {
  try {
    const result = await patternService.list(req.query);
    return ok(res, result, "Patterns list");
  } catch (err) { return next(err); }
}
async function getById(req, res, next) {
  try {
    const record = await patternService.getById(req.params.id);
    return ok(res, { pattern: record }, "Pattern details");
  } catch (err) { return next(err); }
}
async function create(req, res, next) {
  try {
    const record = await patternService.create(req.body);
    return created(res, { pattern: record }, "Pattern created");
  } catch (err) { return next(err); }
}
async function update(req, res, next) {
  try {
    const record = await patternService.update(req.params.id, req.body);
    return ok(res, { pattern: record }, "Pattern updated");
  } catch (err) { return next(err); }
}

module.exports = { list, getById, create, update };
