"use strict";

const express = require("express");
const activityController = require("../controllers/activity.controller");
const authenticate = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");
const { validate, validateIdParam } = require("../middlewares/validation.middleware");
const { activityCreateSchema, activityUpdateSchema } = require("../validators/master.validator");

const router = express.Router();

router.use(authenticate);

router.get("/", activityController.list);
router.get("/:id", validateIdParam, activityController.getById);
router.post("/", requireRole("HSE_ADMIN"), validate(activityCreateSchema), activityController.create);
router.patch("/:id", requireRole("HSE_ADMIN"), validateIdParam, validate(activityUpdateSchema), activityController.update);

module.exports = router;
