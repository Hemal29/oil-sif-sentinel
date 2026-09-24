"use strict";

// Minimal logger placeholder. Swap with Pino later if needed.
const env = require("./env");

const logger = {
  info: (...args) => console.log("[info]", ...args),
  warn: (...args) => console.warn("[warn]", ...args),
  error: (...args) => console.error("[error]", ...args),
  debug: (...args) => {
    if (env.nodeEnv !== "production") console.debug("[debug]", ...args);
  },
};

module.exports = logger;
