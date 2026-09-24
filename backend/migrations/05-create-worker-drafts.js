"use strict";

const { DataTypes } = require("sequelize");

async function up(queryInterface) {
  await queryInterface.createTable("worker_drafts", {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    reportType: { type: DataTypes.ENUM("UNSAFE_ACT", "UNSAFE_CONDITION", "NEAR_MISS"), allowNull: true },
    siteId: { type: DataTypes.UUID, allowNull: true, references: { model: "sites", key: "id" }, onDelete: "SET NULL", onUpdate: "CASCADE" },
    activity: { type: DataTypes.STRING(150), allowNull: true },
    equipment: { type: DataTypes.STRING(255), allowNull: true },
    date: { type: DataTypes.DATEONLY, allowNull: true },
    location: { type: DataTypes.STRING(255), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex("worker_drafts", ["userId"]);
  await queryInterface.addIndex("worker_drafts", ["updatedAt"]);
}

async function down(queryInterface) {
  await queryInterface.dropTable("worker_drafts");
}

module.exports = { up, down };
