"use strict";

const { AppError } = require("../utils/errors");
const { getPagination } = require("../utils/pagination");
const Notification = require("../models/Notification");
const User = require("../models/User");

const TYPES = Notification.TYPES || [
  "REPORT_SUBMITTED",
  "AI_ASSESSMENT_COMPLETED",
  "AI_PRIORITY_ALERT",
  "HSE_REVIEW_REQUIRED",
  "HSE_NEEDS_INFORMATION",
  "HSE_REVIEW_COMPLETED",
  "REPORT_CONFIRMED",
  "REPORT_REJECTED",
  "REPORT_CLOSED",
  "GENERAL",
];

async function createNotification({ userId, type, title, message, reportId, eventKey }, options = {}) {
  if (!TYPES.includes(type)) throw new AppError(`Invalid notification type ${type}`, 400, "INVALID_NOTIFICATION_TYPE");
  if (!userId) throw new AppError("userId is required", 400, "VALIDATION_ERROR");
  // Idempotent via eventKey
  if (eventKey) {
    const existing = await Notification.findOne({ where: { eventKey }, transaction: options.transaction });
    if (existing) return existing;
  }
  // Also prevent duplicate for same type+report+user without eventKey
  if (reportId && !eventKey) {
    const dup = await Notification.findOne({ where: { userId, type, reportId }, transaction: options.transaction });
    // For REPORT_SUBMITTED we want exactly one per report per user, so return existing
    if (dup) return dup;
  }
  const payload = { userId, type, title, message, reportId: reportId || null, eventKey: eventKey || null };
  const created = await Notification.create(payload, options);
  return created;
}

async function createNotificationsForUsers(userIds, { type, title, message, reportId, eventKeyPrefix }) {
  const results = [];
  for (const uid of userIds) {
    const ek = eventKeyPrefix ? `${eventKeyPrefix}:${uid}` : null;
    // For HSE broadcasts, eventKeyPrefix includes reportId, so per-user key is unique
    const finalKey = ek && reportId ? `${ek}:${reportId}` : ek;
    // Use per-user eventKey to prevent duplicate for same report+user
    const existingCheck = finalKey ? await Notification.findOne({ where: { eventKey: finalKey } }) : null;
    if (existingCheck) {
      results.push(existingCheck);
      continue;
    }
    try {
      const n = await createNotification({ userId: uid, type, title, message, reportId, eventKey: finalKey });
      results.push(n);
    } catch (e) {
      // If unique constraint race, ignore
      if (e.name === "SequelizeUniqueConstraintError") {
        const found = await Notification.findOne({ where: { eventKey: finalKey } });
        if (found) results.push(found);
      } else throw e;
    }
  }
  return results;
}

async function getHseUserIds() {
  const users = await User.findAll({ where: { role: ["HSE_ADMIN", "HSE_REVIEWER"], status: "ACTIVE" }, attributes: ["id"] });
  return users.map((u) => u.id);
}

async function getMyNotifications(userId, query = {}) {
  const { page, limit, skip } = getPagination(query);
  const { rows, count } = await Notification.findAndCountAll({
    where: { userId },
    order: [["createdAt", "DESC"]],
    limit,
    offset: skip,
  });
  return { items: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
}

async function getUnreadCount(userId) {
  const count = await Notification.count({ where: { userId, isRead: false } });
  return count;
}

async function markAsRead(notificationId, userId) {
  const n = await Notification.findOne({ where: { id: notificationId, userId } });
  if (!n) throw new AppError("Notification not found", 404, "NOT_FOUND");
  if (!n.isRead) {
    n.isRead = true;
    n.readAt = new Date();
    await n.save();
  }
  return n;
}

async function markAllAsRead(userId) {
  await Notification.update({ isRead: true, readAt: new Date() }, { where: { userId, isRead: false } });
}

module.exports = {
  TYPES,
  createNotification,
  createNotificationsForUsers,
  getHseUserIds,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
