"use strict";

const express = require("express");
const dashboardController = require("../controllers/dashboard.controller");
const authenticate = require("../middlewares/auth.middleware");
const { validate } = require("../middlewares/validation.middleware");
const { dashboardQuerySchema } = require("../validators/dashboard.validator");

const router = express.Router();

// Safety-intelligence reads: any authenticated role. No role gate, no new roles.
router.use(authenticate);
router.use(validate(dashboardQuerySchema, "query"));

router.get("/overview", dashboardController.overview);
router.get("/trends", dashboardController.trends);
router.get("/distributions", dashboardController.distributions);
router.get("/sites", dashboardController.sites);
router.get("/activities", dashboardController.activities);
router.get("/life-saving-rules", dashboardController.lifeSavingRules);
router.get("/precursor-rules", dashboardController.precursorRules);
router.get("/barriers", dashboardController.barriers);
router.get("/energies", dashboardController.energies);
router.get("/recent-reports", dashboardController.recentReports);
router.get("/pending-reviews", dashboardController.pendingReviews);

module.exports = router;
