"use strict";

const notificationService = require("../services/notification.service");
const { ok } = require("../utils/apiResponse");

async function list(req, res, next) {
  try {
    const result = await notificationService.getMyNotifications(req.user.id, req.query);
    return ok(res, result, "Notifications");
  } catch (err) { return next(err); }
}
async function unreadCount(req, res, next) {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    return ok(res, { count }, "Unread count");
  } catch (err) { return next(err); }
}
async function markRead(req, res, next) {
  try {
    const n = await notificationService.markAsRead(req.params.id, req.user.id);
    return ok(res, { notification: n }, "Marked as read");
  } catch (err) { return next(err); }
}
async function markAllRead(req, res, next) {
  try {
    await notificationService.markAllAsRead(req.user.id);
    return ok(res, {}, "All marked as read");
  } catch (err) { return next(err); }
}

module.exports = { list, unreadCount, markRead, markAllRead };
