"use strict";

const app = require("./app");
const env = require("./config/env");
const logger = require("./config/logger");
const { connectDB } = require("./config/database");

// Load models + associations before connecting/syncing.
require("./models");

async function start() {
  try {
    await connectDB();
  } catch (err) {
    logger.error("Cannot start API without a database connection. Check DB_* variables (see .env.example).");
    process.exit(1);
  }

  app.listen(env.port, () => {
    logger.info(`OIL SIF Sentinel API listening on port ${env.port}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { start };
