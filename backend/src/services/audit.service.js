"use strict";

// W9.6 — Audit service. Append-only: create + read. No update, no delete.
// Metadata is sanitized: sensitive keys are stripped, values truncated.

const { AppError } = require("../utils/errors");
const { getPagination } = require("../utils/pagination");
const { AUDIT_EVENT_TYPES, AUDIT_ACTOR_TYPES } = require("../utils/auditEvents");
const logger = require("../config/logger");
const AuditEvent = require("../models/AuditEvent");
const User = require("../models/User");

const VALID_EVENT_TYPES = new Set(Object.values(AUDIT_EVENT_TYPES));
const VALID_ACTOR_TYPES = new Set(Object.values(AUDIT_ACTOR_TYPES));

// Never persisted: credentials, tokens, auth material.
const SENSITIVE_KEY_PATTERN =
  /password|passwd|pwd|secret|token|jwt|refresh|api[-_]?key|cookie|session|authorization|auth[-_]?header|private[-_]?key|client[-_]?secret/i;

const MAX_STRING_LENGTH = 2000;
const MAX_METADATA_KEYS = 20;

function sanitizeValue(value, depth = 0) {
  if (depth > 4) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => sanitizeValue(v, depth + 1));
  }
  if (typeof value === "object") {
    const out = {};
    let count = 0;
    for (const [k, v] of Object.entries(value)) {
      if (count >= MAX_METADATA_KEYS) break;
      if (SENSITIVE_KEY_PATTERN.test(k)) continue;
      out[k] = sanitizeValue(v, depth + 1);
      count += 1;
    }
    return out;
  }
  return String(value).slice(0, MAX_STRING_LENGTH);
}

function sanitizeMetadata(metadata) {
  if (metadata === null || metadata === undefined) return null;
  if (typeof metadata !== "object") return null;
  return sanitizeValue(metadata);
}

function actorTypeFor(user, explicitActorType) {
  if (explicitActorType) {
    if (!VALID_ACTOR_TYPES.has(explicitActorType)) {
      throw new AppError(`Invalid actor type ${explicitActorType}`, 400, "INVALID_ACTOR_TYPE");
    }
    return explicitActorType;
  }
  if (!user) return AUDIT_ACTOR_TYPES.SYSTEM;
  if (user.role === "HSE_ADMIN" || user.role === "HSE_REVIEWER") return AUDIT_ACTOR_TYPES.HSE;
  if (user.role === "USER") return AUDIT_ACTOR_TYPES.USER;
  return AUDIT_ACTOR_TYPES.SYSTEM;
}

// Idempotent via eventKey: a retried business event never creates a second row.
async function createAuditEvent(
  { reportId, actorUserId, actorType, eventType, description, metadata, previousStatus, newStatus, eventKey },
  options = {}
) {
  if (!eventType || !VALID_EVENT_TYPES.has(eventType)) {
    throw new AppError(`Invalid audit event type ${eventType}`, 400, "INVALID_EVENT_TYPE");
  }
  if (!description || !String(description).trim()) {
    throw new AppError("Audit event description is required", 400, "VALIDATION_ERROR");
  }
  const resolvedActorType = actorTypeFor(options.actorUser || null, actorType);
  // AI/SYSTEM events must not carry a fake user id.
  const resolvedActorUserId =
    resolvedActorType === AUDIT_ACTOR_TYPES.AI || resolvedActorType === AUDIT_ACTOR_TYPES.SYSTEM
      ? null
      : actorUserId || (options.actorUser ? options.actorUser.id : null);

  if (eventKey) {
    const existing = await AuditEvent.findOne({ where: { eventKey }, transaction: options.transaction });
    if (existing) return existing;
  }

  try {
    const created = await AuditEvent.create(
      {
        reportId: reportId || null,
        actorUserId: resolvedActorUserId,
        actorType: resolvedActorType,
        eventType,
        eventKey: eventKey || null,
        description: String(description).slice(0, MAX_STRING_LENGTH),
        metadata: sanitizeMetadata(metadata),
        previousStatus: previousStatus || null,
        newStatus: newStatus || null,
      },
      { transaction: options.transaction }
    );
    return created;
  } catch (err) {
    // Unique race on eventKey: return the winner instead of failing the business op.
    if (err && err.name === "SequelizeUniqueConstraintError" && eventKey) {
      const winner = await AuditEvent.findOne({ where: { eventKey } });
      if (winner) return winner;
    }
    logger.error(`[audit] create failed eventType=${eventType} reportId=${reportId}: ${err.message}`);
    throw err;
  }
}

const ACTOR_ATTRS = ["id", "name", "role"];

// Worker-safe projection: strip internal failure detail; actor limited to id/name/role.
function toSafeEvent(event, viewerRole) {
  const plain = event.get ? event.get({ plain: true }) : event;
  const { ...rest } = plain;
  if (viewerRole === "USER" && rest.metadata && typeof rest.metadata === "object") {
    const { failureReason, errorCode, error, stack, ...safeMeta } = rest.metadata;
    rest.metadata = safeMeta;
  }
  return rest;
}

async function getReportAuditHistory(reportId, query = {}, viewer = null) {
  const { page, limit, skip } = getPagination(query);
  const viewerRole = viewer && viewer.role === "USER" ? "USER" : "HSE";
  const { rows, count } = await AuditEvent.findAndCountAll({
    where: { reportId },
    limit,
    offset: skip,
    order: [["createdAt", "DESC"]],
    include: [{ model: User, as: "actor", attributes: ACTOR_ATTRS, required: false }],
  });
  return {
    items: rows.map((r) => toSafeEvent(r, viewerRole)),
    pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
  };
}

async function getAuditEvents(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const where = {};
  if (query.eventType && VALID_EVENT_TYPES.has(query.eventType)) where.eventType = query.eventType;
  if (query.reportId) where.reportId = query.reportId;
  if (query.actorUserId) where.actorUserId = query.actorUserId;
  const { rows, count } = await AuditEvent.findAndCountAll({
    where,
    limit,
    offset: skip,
    order: [["createdAt", "DESC"]],
    include: [{ model: User, as: "actor", attributes: ACTOR_ATTRS, required: false }],
  });
  return {
    items: rows,
    pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
  };
}

module.exports = {
  createAuditEvent,
  getReportAuditHistory,
  getAuditEvents,
  sanitizeMetadata,
  VALID_EVENT_TYPES,
};
