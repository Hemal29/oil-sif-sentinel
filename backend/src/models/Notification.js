"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const NOTIFICATION_TYPES = [
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

const Notification = sequelize.define(
  "Notification",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "GENERAL" },
    title: { type: DataTypes.STRING(200), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: true },
    reportId: { type: DataTypes.UUID, allowNull: true },
    isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    readAt: { type: DataTypes.DATE, allowNull: true },
    eventKey: { type: DataTypes.STRING(200), allowNull: true, unique: true },
  },
  {
    tableName: "notifications",
    timestamps: true,
    indexes: [
      { fields: ["userId"] },
      { fields: ["type"] },
      { fields: ["reportId"] },
      { fields: ["isRead"] },
      { fields: ["readAt"] },
      { fields: ["createdAt"] },
      { fields: ["eventKey"], unique: true },
    ],
  }
);

Notification.TYPES = NOTIFICATION_TYPES;

module.exports = Notification;
