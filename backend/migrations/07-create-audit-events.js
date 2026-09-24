"use strict";

const { DataTypes } = require("sequelize");

// W9.6 — additive, reversible audit_events table. Safe for MySQL and
// test SQLite (describeTable guard, no destructive steps).
async function up(queryInterface) {
  let exists = false;
  try {
    await queryInterface.describeTable("audit_events");
    exists = true;
  } catch (err) {
    exists = false;
  }
  if (!exists) {
    await queryInterface.createTable("audit_events", {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      reportId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "reports", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      actorUserId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      actorType: { type: DataTypes.ENUM("USER", "HSE", "AI", "SYSTEM"), allowNull: false },
      eventType: { type: DataTypes.STRING(50), allowNull: false },
      eventKey: { type: DataTypes.STRING(200), allowNull: true, unique: true },
      description: { type: DataTypes.TEXT, allowNull: false },
      metadata: { type: DataTypes.JSON, allowNull: true },
      previousStatus: { type: DataTypes.STRING(30), allowNull: true },
      newStatus: { type: DataTypes.STRING(30), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
    });
  }

  const indexes = await queryInterface.showIndex("audit_events").catch(() => []);
  const has = (col) =>
    indexes.some((ix) => ix.fields && ix.fields.some((f) => (f.attribute || f.columnName) === col));
  if (!has("reportId")) await queryInterface.addIndex("audit_events", ["reportId"]);
  if (!has("eventType")) await queryInterface.addIndex("audit_events", ["eventType"]);
  if (!has("actorUserId")) await queryInterface.addIndex("audit_events", ["actorUserId"]);
  if (!has("createdAt")) await queryInterface.addIndex("audit_events", ["createdAt"]);
  if (!has("eventKey")) {
    await queryInterface.addIndex("audit_events", ["eventKey"], { unique: true }).catch(() => {});
  }
  // Composite reportId + createdAt for timeline pagination.
  const hasComposite = indexes.some(
    (ix) =>
      ix.fields &&
      ix.fields.length === 2 &&
      ix.fields.some((f) => (f.attribute || f.columnName) === "reportId") &&
      ix.fields.some((f) => (f.attribute || f.columnName) === "createdAt")
  );
  if (!hasComposite) {
    await queryInterface.addIndex("audit_events", ["reportId", "createdAt"]).catch(() => {});
  }
}

async function down(queryInterface) {
  const indexes = await queryInterface.showIndex("audit_events").catch(() => []);
  for (const ix of indexes) {
    if (ix.name && ix.name !== "PRIMARY") {
      await queryInterface.removeIndex("audit_events", ix.name).catch(() => {});
    }
  }
  await queryInterface.dropTable("audit_events");
}

module.exports = { up, down };
