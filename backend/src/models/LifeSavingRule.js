"use strict";

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const LifeSavingRule = sequelize.define(
  "LifeSavingRule",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(150), allowNull: false },
    code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
    // Demo/placeholder records only — official OIL taxonomy comes later.
    isPrototype: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "life_saving_rules",
    timestamps: true,
    indexes: [{ unique: true, fields: ["code"] }],
  }
);

module.exports = LifeSavingRule;
