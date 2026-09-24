"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// NOTE: reports.description is the ORIGINAL source evidence.
// It must NEVER be overwritten by AI output (AI lives in ai_analyses).
// PATCH endpoints reject changes to immutable fields (see report.service.js).
const Report = sequelize.define(
  "Report",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    reportNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    siteId: { type: DataTypes.UUID, allowNull: false },
    location: { type: DataTypes.STRING(255), allowNull: true },
    activity: { type: DataTypes.STRING(150), allowNull: false },
    reportType: {
      type: DataTypes.ENUM("UNSAFE_ACT", "UNSAFE_CONDITION", "NEAR_MISS"),
      allowNull: false,
    },
    description: { type: DataTypes.TEXT, allowNull: false },
    equipment: { type: DataTypes.STRING(255), allowNull: true },
    language: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "en",
    },
    sourceFile: { type: DataTypes.STRING(255), allowNull: true },
    status: {
      type: DataTypes.ENUM("NEW", "ANALYZED", "UNDER_REVIEW", "CLOSED"),
      allowNull: false,
      defaultValue: "NEW",
    },
    createdBy: { type: DataTypes.UUID, allowNull: false },
  },
  {
    tableName: "reports",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["reportNumber"] },
      { fields: ["date"] },
      { fields: ["siteId"] },
      { fields: ["reportType"] },
      { fields: ["status"] },
      { fields: ["createdBy"] },
    ],
  }
);

module.exports = Report;
