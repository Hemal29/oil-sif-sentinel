"use strict";

const { DataTypes } = require("sequelize");

/**
 * Phase 7: layered SIF Precursor AI engine columns on ai_analyses.
 * Purely additive + nullable: historical analyses are preserved untouched.
 * SQLite (tests) and MySQL (prod) compatible. ENUM degrades to TEXT+check
 * on SQLite via Sequelize; MySQL gets native ENUMs.
 */
const NEW_COLUMNS = {
  schemaVersion: { type: DataTypes.STRING(50), allowNull: true },
  riskScore: { type: DataTypes.FLOAT, allowNull: true },
  scoreKind: { type: DataTypes.STRING(50), allowNull: true },
  route: {
    type: DataTypes.ENUM("AUTO_CLOSE", "UNCERTAIN", "PRIORITY", "ABSTAIN"),
    allowNull: true,
  },
  requiresHumanReview: { type: DataTypes.BOOLEAN, allowNull: true },
  escalatedToExtraction: { type: DataTypes.BOOLEAN, allowNull: true },
  matchedRules: { type: DataTypes.JSON, allowNull: true },
  primaryRule: { type: DataTypes.STRING(100), allowNull: true },
  secondaryRules: { type: DataTypes.JSON, allowNull: true },
  hazardEnergy: { type: DataTypes.STRING(100), allowNull: true },
  eventStatus: { type: DataTypes.STRING(50), allowNull: true },
  barriersFailed: { type: DataTypes.JSON, allowNull: true },
  assets: { type: DataTypes.JSON, allowNull: true },
  rationale: { type: DataTypes.TEXT, allowNull: true },
  extractionStatus: { type: DataTypes.STRING(30), allowNull: true },
  repairAttempts: { type: DataTypes.INTEGER, allowNull: true },
  failureReason: { type: DataTypes.TEXT, allowNull: true },
  clarificationRequest: { type: DataTypes.JSON, allowNull: true },
};

async function up(queryInterface) {
  const table = await queryInterface.describeTable("ai_analyses");
  for (const [name, def] of Object.entries(NEW_COLUMNS)) {
    if (!table[name]) {
      await queryInterface.addColumn("ai_analyses", name, def);
    }
  }
  // Idempotent: SYNC_DB environments may already have these indexes.
  const indexes = await queryInterface.showIndex("ai_analyses");
  const indexed = new Set(indexes.flatMap((ix) => (ix.fields || []).map((f) => f.attribute || f.columnName)));
  if (!indexed.has("route")) await queryInterface.addIndex("ai_analyses", ["route"]);
  if (!indexed.has("analysisStatus")) await queryInterface.addIndex("ai_analyses", ["analysisStatus"]);
}

async function down(queryInterface) {
  const indexes = await queryInterface.showIndex("ai_analyses");
  const names = new Set(indexes.map((ix) => ix.name));
  for (const ix of indexes) {
    const cols = (ix.fields || []).map((f) => f.attribute || f.columnName);
    if (cols.length === 1 && (cols[0] === "route" || cols[0] === "analysisStatus") && names.has(ix.name)) {
      await queryInterface.removeIndex("ai_analyses", ix.name);
    }
  }
  for (const name of Object.keys(NEW_COLUMNS)) {
    await queryInterface.removeColumn("ai_analyses", name);
  }
}

module.exports = { up, down };
