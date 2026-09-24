"use strict";

const { DataTypes } = require("sequelize");

/** Initial schema: core tables (users, sites, activities, life_saving_rules,
 *  reports, ai_analyses, reviews). Remaining tables (patterns, notifications,
 *  analysis_jobs, embeddings) arrive in later migrations. */
async function up(queryInterface) {
  await queryInterface.createTable("users", {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false },
    role: {
      type: DataTypes.ENUM("HSE_ADMIN", "HSE_REVIEWER", "USER"),
      allowNull: false,
      defaultValue: "USER",
    },
    status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.createTable("sites", {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    location: { type: DataTypes.STRING(255), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.createTable("activities", {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.createTable("life_saving_rules", {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    name: { type: DataTypes.STRING(150), allowNull: false },
    code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
    isPrototype: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.createTable("reports", {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    reportNumber: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    siteId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      references: { model: "sites", key: "id" },
    },
    location: { type: DataTypes.STRING(255), allowNull: true },
    activity: { type: DataTypes.STRING(150), allowNull: false },
    reportType: {
      type: DataTypes.ENUM("UNSAFE_ACT", "UNSAFE_CONDITION", "NEAR_MISS"),
      allowNull: false,
    },
    description: { type: DataTypes.TEXT, allowNull: false },
    equipment: { type: DataTypes.STRING(255), allowNull: true },
    language: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "en" },
    sourceFile: { type: DataTypes.STRING(255), allowNull: true },
    status: {
      type: DataTypes.ENUM("NEW", "ANALYZED", "UNDER_REVIEW", "CLOSED"),
      allowNull: false,
      defaultValue: "NEW",
    },
    createdBy: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex("reports", ["date"]);
  await queryInterface.addIndex("reports", ["siteId"]);
  await queryInterface.addIndex("reports", ["reportType"]);
  await queryInterface.addIndex("reports", ["status"]);
  await queryInterface.addIndex("reports", ["createdBy"]);

  await queryInterface.createTable("ai_analyses", {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    reportId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      unique: true,
      references: { model: "reports", key: "id" },
    },
    sifPotential: { type: DataTypes.BOOLEAN, allowNull: true },
    confidence: { type: DataTypes.FLOAT, allowNull: true },
    activity: { type: DataTypes.STRING(150), allowNull: true },
    hazard: { type: DataTypes.STRING(255), allowNull: true },
    barrierFailure: { type: DataTypes.STRING(255), allowNull: true },
    consequence: { type: DataTypes.STRING(255), allowNull: true },
    lifeSavingRuleId: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      references: { model: "life_saving_rules", key: "id" },
    },
    priority: {
      type: DataTypes.ENUM("LOW", "MEDIUM", "HIGH", "CRITICAL"),
      allowNull: true,
    },
    evidence: { type: DataTypes.JSON, allowNull: true },
    extractedEntities: { type: DataTypes.JSON, allowNull: true },
    modelName: { type: DataTypes.STRING(100), allowNull: true },
    modelVersion: { type: DataTypes.STRING(50), allowNull: true },
    analysisStatus: {
      type: DataTypes.ENUM("PENDING", "COMPLETED", "FAILED"),
      allowNull: false,
      defaultValue: "PENDING",
    },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });

  await queryInterface.createTable("reviews", {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    reportId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      references: { model: "reports", key: "id" },
    },
    reviewerId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    aiPrediction: { type: DataTypes.STRING(50), allowNull: true },
    hseDecision: {
      type: DataTypes.ENUM("CONFIRMED", "REJECTED", "NEEDS_MORE_INFO"),
      allowNull: true,
    },
    comment: { type: DataTypes.TEXT, allowNull: true },
    reasonCode: { type: DataTypes.STRING(100), allowNull: true },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex("reviews", ["reportId"]);
  await queryInterface.addIndex("reviews", ["reviewerId"]);
}

async function down(queryInterface) {
  for (const t of ["reviews", "ai_analyses", "reports", "life_saving_rules", "activities", "sites", "users"]) {
    await queryInterface.dropTable(t);
  }
}

module.exports = { up, down };
