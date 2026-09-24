"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// W9.6 — Immutable, append-only audit trail for the report lifecycle.
// Rows are INSERT-only: no service or route ever updates or deletes them.
// reportId uses SET NULL on delete so history survives report removal;
// reports are never deleted in normal operation (status-only lifecycle).
const AuditEvent = sequelize.define(
  "AuditEvent",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    reportId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "reports", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    actorUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    actorType: {
      type: DataTypes.ENUM("USER", "HSE", "AI", "SYSTEM"),
      allowNull: false,
    },
    eventType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    eventKey: {
      type: DataTypes.STRING(200),
      allowNull: true,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    previousStatus: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    newStatus: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
  },
  {
    tableName: "audit_events",
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ["reportId"] },
      { fields: ["eventType"] },
      { fields: ["actorUserId"] },
      { fields: ["createdAt"] },
      { fields: ["reportId", "createdAt"] },
      { fields: ["eventKey"], unique: true },
    ],
  }
);

module.exports = AuditEvent;
