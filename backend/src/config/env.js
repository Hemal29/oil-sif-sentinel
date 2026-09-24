"use strict";

require("dotenv").config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  db: {
    // DB_DIALECT is "mysql" in real environments.
    // Tests may set DB_DIALECT=sqlite to run against in-memory SQLite.
    dialect: process.env.DB_DIALECT || "mysql",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    name: process.env.DB_NAME || "oil_sif_sentinel",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    storage: process.env.DB_STORAGE || ":memory:",
  },
  // Controlled, non-destructive sync (creates missing tables only).
  // Production should use migrations instead (SYNC_DB=false).
  syncDb: (process.env.SYNC_DB || (process.env.NODE_ENV === "production" ? "false" : "true")) === "true",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  aiServiceUrl: process.env.AI_SERVICE_URL || "http://localhost:8000",
  aiTimeoutMs: parseInt(process.env.AI_TIMEOUT_MS, 10) || 30000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  logLevel: process.env.LOG_LEVEL || "info",
  import: {
    maxFileSizeMB: parseFloat(process.env.MAX_IMPORT_FILE_SIZE_MB) || 10,
    maxRows: parseInt(process.env.MAX_IMPORT_ROWS, 10) || 10000,
  },
};
