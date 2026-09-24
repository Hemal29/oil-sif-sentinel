"use strict";

const { Sequelize } = require("sequelize");
const env = require("./env");
const logger = require("./logger");

let sequelize;

if (env.db.dialect === "sqlite") {
  // Test-only path. Real environments use MySQL.
  sequelize = new Sequelize({
    dialect: "sqlite",
    storage: env.db.storage,
    logging: false,
  });
} else {
  sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
    host: env.db.host,
    port: env.db.port,
    dialect: "mysql",
    logging: env.nodeEnv === "development" ? false : false,
  });
}

async function connectDB() {
  try {
    await sequelize.authenticate();
    logger.info(`Database connected (${env.db.dialect})`);
  } catch (err) {
    // Never log credentials.
    logger.error(`Database connection failed (dialect=${env.db.dialect}, host=${env.db.host}, db=${env.db.name}): ${err.message}`);
    throw err;
  }

  if (env.syncDb) {
    // Non-destructive: creates missing tables only. NEVER force/alter here.
    await sequelize.sync();
    logger.info("Database synchronized (missing tables created, existing data untouched)");
  }
  return sequelize;
}

module.exports = sequelize;
module.exports.sequelize = sequelize;
module.exports.connectDB = connectDB;
