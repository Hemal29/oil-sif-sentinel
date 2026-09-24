"use strict";

const { DataTypes } = require("sequelize");

async function up(queryInterface) {
  const table = await queryInterface.describeTable("notifications");
  if (!table.type) {
    await queryInterface.addColumn("notifications", "type", {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "GENERAL",
    });
  }
  if (!table.reportId) {
    await queryInterface.addColumn("notifications", "reportId", {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "reports", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  }
  if (!table.readAt) {
    await queryInterface.addColumn("notifications", "readAt", {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }
  if (!table.eventKey) {
    await queryInterface.addColumn("notifications", "eventKey", {
      type: DataTypes.STRING(200),
      allowNull: true,
      unique: true,
    });
  }
  const indexes = await queryInterface.showIndex("notifications");
  const has = (col) => indexes.some((ix) => ix.fields && ix.fields.some((f) => (f.attribute || f.columnName) === col));
  if (!has("type")) await queryInterface.addIndex("notifications", ["type"]);
  if (!has("reportId")) await queryInterface.addIndex("notifications", ["reportId"]);
  if (!has("isRead")) await queryInterface.addIndex("notifications", ["isRead"]);
  if (!has("readAt")) await queryInterface.addIndex("notifications", ["readAt"]);
  if (!has("createdAt")) await queryInterface.addIndex("notifications", ["createdAt"]);
  if (!has("eventKey")) await queryInterface.addIndex("notifications", ["eventKey"], { unique: true, where: { eventKey: { [require("sequelize").Op.ne]: null } } }).catch(() => queryInterface.addIndex("notifications", ["eventKey"]));
}

async function down(queryInterface) {
  const table = await queryInterface.describeTable("notifications");
  if (table.eventKey) await queryInterface.removeColumn("notifications", "eventKey");
  if (table.readAt) await queryInterface.removeColumn("notifications", "readAt");
  if (table.reportId) await queryInterface.removeColumn("notifications", "reportId");
  if (table.type) await queryInterface.removeColumn("notifications", "type");
}

module.exports = { up, down };
