"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// AI interpretation is stored SEPARATELY from reports.description.
// No AI inference here — schema only.
const AIAnalysis = sequelize.define(
  "AIAnalysis",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    reportId: { type: DataTypes.UUID, allowNull: false, unique: true },
    sifPotential: { type: DataTypes.BOOLEAN, allowNull: true },
    confidence: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: { min: 0, max: 1 },
    },
    activity: { type: DataTypes.STRING(150), allowNull: true },
    hazard: { type: DataTypes.STRING(255), allowNull: true },
    barrierFailure: { type: DataTypes.STRING(255), allowNull: true },
    consequence: { type: DataTypes.STRING(255), allowNull: true },
    lifeSavingRuleId: { type: DataTypes.UUID, allowNull: true },
    priority: {
      type: DataTypes.ENUM("LOW", "MEDIUM", "HIGH", "CRITICAL"),
      allowNull: true,
    },
    evidence: { type: DataTypes.JSON, allowNull: true },
    extractedEntities: { type: DataTypes.JSON, allowNull: true },
    modelName: { type: DataTypes.STRING(100), allowNull: true },
    modelVersion: { type: DataTypes.STRING(50), allowNull: true },
    // Phase 7 layered SIF engine (all nullable: historical rows preserved).
    schemaVersion: { type: DataTypes.STRING(50), allowNull: true },
    riskScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: { min: 0, max: 1 },
    },
    scoreKind: { type: DataTypes.STRING(50), allowNull: true },
    route: {
      type: DataTypes.ENUM("AUTO_CLOSE", "UNCERTAIN", "PRIORITY", "ABSTAIN"),
      allowNull: true,
    },
    requiresHumanReview: { type: DataTypes.BOOLEAN, allowNull: true },
    escalatedToExtraction: { type: DataTypes.BOOLEAN, allowNull: true },
    matchedRules: { type: DataTypes.JSON, allowNull: true },
    primaryRule: { type: DataTypes.STRING(100), allowNull: true },
    secondaryRules: { type: DataTypes.JSON, allowNull: true },
    hazardEnergy: { type: DataTypes.STRING(100), allowNull: true },
    eventStatus: { type: DataTypes.STRING(50), allowNull: true },
    barriersFailed: { type: DataTypes.JSON, allowNull: true },
    assets: { type: DataTypes.JSON, allowNull: true },
    rationale: { type: DataTypes.TEXT, allowNull: true },
    extractionStatus: { type: DataTypes.STRING(30), allowNull: true },
    repairAttempts: { type: DataTypes.INTEGER, allowNull: true },
    failureReason: { type: DataTypes.TEXT, allowNull: true },
    clarificationRequest: { type: DataTypes.JSON, allowNull: true },
    analysisStatus: {
      type: DataTypes.ENUM("PENDING", "COMPLETED", "FAILED"),
      allowNull: false,
      defaultValue: "PENDING",
    },
  },
  {
    tableName: "ai_analyses",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["reportId"] },
      { fields: ["lifeSavingRuleId"] },
      { fields: ["route"] },
      { fields: ["analysisStatus"] },
    ],
  }
);

module.exports = AIAnalysis;
