"use strict";

// Prepared for later stages — batch jobs (BullMQ) NOT implemented yet.
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AnalysisJob = sequelize.define(
  "AnalysisJob",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type: { type: DataTypes.STRING(100), allowNull: false },
    status: {
      type: DataTypes.ENUM("PENDING", "COMPLETED", "FAILED"),
      allowNull: false,
      defaultValue: "PENDING",
    },
    payload: { type: DataTypes.JSON, allowNull: true },
    result: { type: DataTypes.JSON, allowNull: true },
  },
  { tableName: "analysis_jobs", timestamps: true }
);

module.exports = AnalysisJob;
