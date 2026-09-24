"use strict";

const workerService = require("../services/worker.service");
const { ok, created } = require("../utils/apiResponse");

async function create(req, res, next) {
  try {
    // createdBy always comes from the JWT — never from the request body.
    const report = await workerService.createWorkerReport(req.body, req.user.id);
    return created(res, { report }, "Report submitted for assessment");
  } catch (err) {
    return next(err);
  }
}

async function list(req, res, next) {
  try {
    const result = await workerService.listMyReports(req.query, req.user.id);
    return ok(res, result, "My reports");
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const report = await workerService.getMyReport(req.params.id, req.user.id);
    return ok(res, { report }, "Report details");
  } catch (err) {
    return next(err);
  }
}

async function summary(req, res, next) {
  try {
    const summary = await workerService.getMySummary(req.user.id);
    return ok(res, summary, "Worker summary");
  } catch (err) {
    return next(err);
  }
}

async function register(req, res, next) {
  try {
    const user = await workerService.registerWorker(req.body);
    return created(res, { user }, "Worker account created. Please sign in.");
  } catch (err) {
    return next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const user = await workerService.getWorkerProfile(req.user.id);
    return ok(res, { user }, "Worker profile");
  } catch (err) {
    return next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const user = await workerService.updateWorkerProfile(req.user.id, req.body);
    return ok(res, { user }, "Profile updated successfully.");
  } catch (err) {
    return next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const user = await workerService.changeWorkerPassword(req.user.id, req.body);
    return ok(res, { user }, "Password changed successfully.");
  } catch (err) {
    return next(err);
  }
}

module.exports = { create, list, getById, summary, register, getProfile, updateProfile, changePassword };
