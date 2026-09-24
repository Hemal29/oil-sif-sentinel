"use strict";

const express = require("express");
const analysisController = require("../controllers/analysis.controller");
const authenticate = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");
const { validateIdParam } = require("../middlewares/validation.middleware");

const router = express.Router();

router.use(authenticate);

router.post(
  "/reports/:id",
  requireRole("HSE_ADMIN", "HSE_REVIEWER"),
  validateIdParam,
  analysisController.analyze
);

module.exports = router;
