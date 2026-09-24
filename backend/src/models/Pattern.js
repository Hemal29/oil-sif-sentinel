"use strict";

// Prepared for later stages — pattern engine NOT implemented yet.
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Pattern = sequelize.define(
  "Pattern",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(150), allowNull: false },
    code: { type: DataTypes.STRING(50), allowNull: true, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    metadata: { type: DataTypes.JSON, allowNull: true },
    status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
  },
  { tableName: "patterns", timestamps: true }
);

module.exports = Pattern;
