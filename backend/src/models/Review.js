"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// HSE review workflow (Step 3). Each row is an immutable historical record —
// reviews are never overwritten; a new review row is inserted instead.
// aiPrediction stays NULL until the AI workflow lands (no fake values).
const Review = sequelize.define(
  "Review",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    reportId: { type: DataTypes.UUID, allowNull: false },
    reviewerId: { type: DataTypes.UUID, allowNull: false },
    aiPrediction: { type: DataTypes.JSON, allowNull: true },
    hseDecision: {
      type: DataTypes.ENUM("CONFIRMED", "REJECTED", "NEEDS_MORE_INFO"),
      allowNull: true,
    },
    comment: { type: DataTypes.TEXT, allowNull: true },
    reasonCode: { type: DataTypes.STRING(100), allowNull: true },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "reviews",
    timestamps: true,
    indexes: [
      { fields: ["reportId"] },
      { fields: ["reviewerId"] },
      { fields: ["hseDecision"] },
      { fields: ["createdAt"] },
    ],
  }
);

module.exports = Review;
