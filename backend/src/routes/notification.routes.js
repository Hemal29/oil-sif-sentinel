"use strict";

const express = require("express");
const notificationController = require("../controllers/notification.controller");
const authenticate = require("../middlewares/auth.middleware");
const { validateIdParam } = require("../middlewares/validation.middleware");

const router = express.Router();

router.use(authenticate);

router.get("/", notificationController.list);
router.get("/unread-count", notificationController.unreadCount);
router.patch("/read-all", notificationController.markAllRead);
router.patch("/:id/read", validateIdParam, notificationController.markRead);

module.exports = router;
