"use strict";

const express = require("express");
const patternController = require("../controllers/pattern.controller");
const authenticate = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");
const { validate, validateIdParam } = require("../middlewares/validation.middleware");
const { patternCreateSchema, patternUpdateSchema } = require("../validators/pattern.validator");

const router = express.Router();

router.use(authenticate);

router.get("/", patternController.list);
router.get("/:id", validateIdParam, patternController.getById);
router.post("/", requireRole("HSE_ADMIN"), validate(patternCreateSchema), patternController.create);
router.patch("/:id", requireRole("HSE_ADMIN"), validateIdParam, validate(patternUpdateSchema), patternController.update);

module.exports = router;
