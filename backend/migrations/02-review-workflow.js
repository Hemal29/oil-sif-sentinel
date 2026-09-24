"use strict";

const { DataTypes } = require("sequelize");

/**
 * Step 3: review-workflow indexes + aiPrediction JSON.
 * - Adds missing reviews indexes (hseDecision, createdAt).
 * - Widens aiPrediction to JSON for the future AI workflow.
 *   Safe: no reviews can exist yet (the review API is new in this step),
 *   so there is no legacy string data to convert.
 * Non-destructive: no drops, no table rebuilds.
 */
async function up(queryInterface) {
  await queryInterface.changeColumn("reviews", "aiPrediction", {
    type: DataTypes.JSON,
    allowNull: true,
  });
  await queryInterface.addIndex("reviews", ["hseDecision"]);
  await queryInterface.addIndex("reviews", ["createdAt"]);
}

async function down(queryInterface) {
  await queryInterface.removeIndex("reviews", ["createdAt"]);
  await queryInterface.removeIndex("reviews", ["hseDecision"]);
  await queryInterface.changeColumn("reviews", "aiPrediction", {
    type: DataTypes.STRING(50),
    allowNull: true,
  });
}

module.exports = { up, down };
