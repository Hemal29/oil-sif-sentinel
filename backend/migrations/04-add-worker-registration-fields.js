"use strict";

const { DataTypes } = require("sequelize");

/**
 * Additive migration for Worker Portal self-registration.
 * Adds optional employeeId (unique when present) and mobile fields to users.
 * Existing users remain valid (both columns nullable).
 */
async function up(queryInterface) {
  const table = await queryInterface.describeTable("users");
  if (!table.employeeId) {
    await queryInterface.addColumn("users", "employeeId", {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
    });
  }
  if (!table.mobile) {
    await queryInterface.addColumn("users", "mobile", {
      type: DataTypes.STRING(20),
      allowNull: true,
    });
  }
  // Unique index for employeeId where not null (MySQL allows multiple nulls; keep explicit)
  const indexes = await queryInterface.showIndex("users");
  const hasEmpIdx = indexes.some((ix) => ix.fields && ix.fields.some((f) => (f.attribute || f.columnName) === "employeeId"));
  if (!hasEmpIdx) {
    await queryInterface.addIndex("users", ["employeeId"], { unique: true, name: "users_employeeId_unique" });
  }
}

async function down(queryInterface) {
  const indexes = await queryInterface.showIndex("users");
  if (indexes.some((ix) => ix.name === "users_employeeId_unique")) {
    await queryInterface.removeIndex("users", "users_employeeId_unique");
  }
  const table = await queryInterface.describeTable("users");
  if (table.mobile) await queryInterface.removeColumn("users", "mobile");
  if (table.employeeId) await queryInterface.removeColumn("users", "employeeId");
}

module.exports = { up, down };
