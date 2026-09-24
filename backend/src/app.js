"use strict";

// Central Express app. Thin wiring only — logic lives in services.
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const { notFound, errorHandler } = require("./middlewares/error.middleware");

const authRoutes = require("./routes/auth.routes");
const reportRoutes = require("./routes/report.routes");
const workerRoutes = require("./routes/worker.routes");
const analysisRoutes = require("./routes/analysis.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const patternRoutes = require("./routes/pattern.routes");
const reviewRoutes = require("./routes/review.routes");
const ruleRoutes = require("./routes/rule.routes");
const siteRoutes = require("./routes/site.routes");
const activityRoutes = require("./routes/activity.routes");
const assistantRoutes = require("./routes/assistant.routes");
const notificationRoutes = require("./routes/notification.routes");

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrl.split(","), credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/v1/health", (req, res) => {
  res.status(200).json({ success: true, message: "OIL SIF Sentinel API is running" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/worker", workerRoutes);
app.use("/api/v1/analysis", analysisRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/patterns", patternRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/rules", ruleRoutes);
app.use("/api/v1/sites", siteRoutes);
app.use("/api/v1/activities", activityRoutes);
app.use("/api/v1/assistant", assistantRoutes);
app.use("/api/v1/notifications", notificationRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
