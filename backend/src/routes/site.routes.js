"use strict";

const express = require("express");
const siteController = require("../controllers/site.controller");
const authenticate = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");
const { validate, validateIdParam } = require("../middlewares/validation.middleware");
const { siteCreateSchema, siteUpdateSchema } = require("../validators/master.validator");

const router = express.Router();

router.use(authenticate);

router.get("/", siteController.list);
router.get("/:id", validateIdParam, siteController.getById);
router.post("/", requireRole("HSE_ADMIN"), validate(siteCreateSchema), siteController.create);
router.patch("/:id", requireRole("HSE_ADMIN"), validateIdParam, validate(siteUpdateSchema), siteController.update);

module.exports = router;
