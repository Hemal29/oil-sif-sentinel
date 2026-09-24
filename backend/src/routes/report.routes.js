"use strict";

const express = require("express");
const reportController = require("../controllers/report.controller");
const auditController = require("../controllers/audit.controller");
const authenticate = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");
const upload = require("../middlewares/upload.middleware");
const { validate, validateIdParam } = require("../middlewares/validation.middleware");
const {
  createReportSchema,
  updateReportSchema,
  listReportsSchema,
} = require("../validators/report.validator");

const router = express.Router();

router.use(authenticate);

router.post("/", validate(createReportSchema), reportController.create);
router.get("/", validate(listReportsSchema, "query"), reportController.list);
// NOTE: /upload must be registered before /:id.
// HSE only. createdBy comes from the JWT.
router.post(
  "/upload",
  requireRole("HSE_ADMIN", "HSE_REVIEWER"),
  upload.single("file"),
  reportController.uploadReports
);
router.get("/:id", validateIdParam, reportController.getById);
router.patch("/:id", validateIdParam, validate(updateReportSchema), reportController.update);
// W9.6 — read-only activity history. No mutation endpoints exist by design.
router.get("/:id/audit", validateIdParam, auditController.getReportAudit);

module.exports = router;
