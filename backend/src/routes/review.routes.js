"use strict";

const express = require("express");
const reviewController = require("../controllers/review.controller");
const authenticate = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");
const { validate, validateIdParam } = require("../middlewares/validation.middleware");
const { createReviewSchema, listReviewsSchema, actionCenterQuerySchema } = require("../validators/review.validator");

const router = express.Router();

router.use(authenticate);

router.post(
  "/",
  requireRole("HSE_ADMIN", "HSE_REVIEWER"),
  validate(createReviewSchema),
  reviewController.create
);
router.get("/", validate(listReviewsSchema, "query"), reviewController.list);
// NOTE: /action-center and /pending must be registered before /:id.
router.get("/action-center", requireRole("HSE_ADMIN", "HSE_REVIEWER"), validate(actionCenterQuerySchema, "query"), reviewController.actionCenter);
router.get("/pending", reviewController.pending);
router.get("/:id", validateIdParam, reviewController.getById);

module.exports = router;
