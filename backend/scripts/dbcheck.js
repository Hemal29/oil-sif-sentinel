"use strict";

// Usage: npm run db:check
// Verifies MySQL connectivity + reports which tables exist.
// Exit 0 = connected, non-zero = connection problem (message explains why).
process.env.SYNC_DB = "false";

const env = require("../src/config/env");
const { sequelize } = require("../src/models");

(async () => {
  console.log(`Checking MySQL at ${env.db.host}:${env.db.port}, db="${env.db.name}", user="${env.db.user}" ...`);
  try {
    await sequelize.authenticate();
    console.log("Connection OK.");
  } catch (err) {
    console.error("CONNECTION FAILED:", err.original ? err.original.message : err.message);
    console.error("Fix: create backend/.env from .env.example and set DB_HOST/DB_PORT/DB_USER/DB_PASSWORD,");
    console.error("ensure MySQL Server is running, and run docs/database/init.sql in Workbench first.");
    process.exit(1);
  }
  try {
    const [tables] = await sequelize.query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME"
    );
    const names = tables.map((t) => t.TABLE_NAME || t.table_name);
    console.log(`Tables in "${env.db.name}": ${names.length ? names.join(", ") : "(none yet — start the API once to create them)"}`);
  } catch (err) {
    console.error("Connected, but cannot list tables:", err.message);
    process.exit(1);
  }
  await sequelize.close();
})();
