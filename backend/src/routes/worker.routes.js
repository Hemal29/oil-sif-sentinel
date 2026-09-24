"use strict";

const express = require("express");
const workerController = require("../controllers/worker.controller");
const authenticate = require("../middlewares/auth.middleware");
const { validate, validateIdParam } = require("../middlewares/validation.middleware");
const {
  workerCreateReportSchema,
  workerListReportsSchema,
  workerRegisterSchema,
  workerProfileUpdateSchema,
  workerPasswordChangeSchema,
  workerDraftCreateSchema,
  workerDraftUpdateSchema,
} = require("../validators/worker.validator");
const draftController = require("../controllers/draft.controller");
const { requireRole } = require("../middlewares/role.middleware");

const router = express.Router();

// Public: Worker self-registration — no JWT, always creates role USER.
// Strict schema rejects any client-supplied role/status/createdBy.
router.post("/auth/register", validate(workerRegisterSchema), workerController.register);

// Worker Portal: any authenticated role may use these (HSE keeps its own
// full UI); every handler scopes to the JWT identity, so workers only ever
// see their own submissions.
router.use(authenticate);

router.get("/profile", workerController.getProfile);
router.patch("/profile", validate(workerProfileUpdateSchema), workerController.updateProfile);
router.patch("/profile/password", validate(workerPasswordChangeSchema), workerController.changePassword);

// Drafts — USER only, text-only, no AI
router.post("/drafts", requireRole("USER"), validate(workerDraftCreateSchema), draftController.create);
router.get("/drafts", requireRole("USER"), draftController.list);
router.get("/drafts/:id", requireRole("USER"), validateIdParam, draftController.getById);
router.patch("/drafts/:id", requireRole("USER"), validateIdParam, validate(workerDraftUpdateSchema), draftController.update);
router.delete("/drafts/:id", requireRole("USER"), validateIdParam, draftController.remove);
router.post("/drafts/:id/submit", requireRole("USER"), validateIdParam, draftController.submit);

router.get("/summary", workerController.summary);
router.post("/reports", validate(workerCreateReportSchema), workerController.create);
router.get("/reports", validate(workerListReportsSchema, "query"), workerController.list);
router.get("/reports/:id", validateIdParam, workerController.getById);

module.exports = router;
