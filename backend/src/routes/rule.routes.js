"use strict";

const express = require("express");
const ruleController = require("../controllers/rule.controller");
const authenticate = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");
const { validate, validateIdParam } = require("../middlewares/validation.middleware");
const { ruleCreateSchema, ruleUpdateSchema } = require("../validators/master.validator");

const router = express.Router();

router.use(authenticate);

router.get("/", ruleController.list);
router.get("/:id", validateIdParam, ruleController.getById);
router.post("/", requireRole("HSE_ADMIN"), validate(ruleCreateSchema), ruleController.create);
router.patch("/:id", requireRole("HSE_ADMIN"), validateIdParam, validate(ruleUpdateSchema), ruleController.update);

module.exports = router;
