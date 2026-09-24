"use strict";

const reviewService = require("../services/review.service");
const { ok, created } = require("../utils/apiResponse");

async function create(req, res, next) {
  try {
    // Reviewer comes from the JWT (req.user.id) — never from the body.
    const { review, reportStatus } = await reviewService.createReview(req.body, req.user);
    return created(res, { review, reportStatus }, "Review recorded");
  } catch (err) {
    return next(err);
  }
}

async function list(req, res, next) {
  try {
    const result = await reviewService.getReviews(req.query);
    return ok(res, result, "Reviews list");
  } catch (err) {
    return next(err);
  }
}

async function pending(req, res, next) {
  try {
    const result = await reviewService.getPendingReviews(req.query);
    return ok(res, result, "Pending reviews");
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const review = await reviewService.getReviewById(req.params.id);
    return ok(res, { review }, "Review details");
  } catch (err) {
    return next(err);
  }
}

async function actionCenter(req, res, next) {
  try {
    const result = await reviewService.getActionCenter(req.query);
    return ok(res, result, "Action center");
  } catch (err) {
    return next(err);
  }
}

module.exports = { create, list, pending, getById, actionCenter };
