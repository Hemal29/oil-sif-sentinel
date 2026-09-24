"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const WorkerDraft = sequelize.define(
  "WorkerDraft",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    reportType: {
      type: DataTypes.ENUM("UNSAFE_ACT", "UNSAFE_CONDITION", "NEAR_MISS"),
      allowNull: true,
    },
    siteId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "sites", key: "id" },
    },
    activity: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    equipment: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "worker_drafts",
    timestamps: true,
    indexes: [{ fields: ["userId"] }, { fields: ["updatedAt"] }],
  }
);

module.exports = WorkerDraft;
