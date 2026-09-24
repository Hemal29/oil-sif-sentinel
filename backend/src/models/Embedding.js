"use strict";

// Prepared for later stages — embeddings/vector search NOT implemented yet.
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Embedding = sequelize.define(
  "Embedding",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    reportId: { type: DataTypes.UUID, allowNull: false },
    model: { type: DataTypes.STRING(100), allowNull: true },
    dimension: { type: DataTypes.INTEGER, allowNull: true },
    vector: { type: DataTypes.JSON, allowNull: true },
  },
  {
    tableName: "embeddings",
    timestamps: true,
    indexes: [{ fields: ["reportId"] }],
  }
);

module.exports = Embedding;
