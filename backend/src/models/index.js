"use strict";

const sequelize = require("../config/database");
const User = require("./User");
const Site = require("./Site");
const Activity = require("./Activity");
const LifeSavingRule = require("./LifeSavingRule");
const Report = require("./Report");
const AIAnalysis = require("./AIAnalysis");
const Review = require("./Review");
const Pattern = require("./Pattern");
const Notification = require("./Notification");
const AnalysisJob = require("./AnalysisJob");
const Embedding = require("./Embedding");
const WorkerDraft = require("./WorkerDraft");
const AuditEvent = require("./AuditEvent");

// User 1—N Report
User.hasMany(Report, { foreignKey: "createdBy", as: "reports" });
Report.belongsTo(User, { foreignKey: "createdBy", as: "creator" });

// User 1—N Review
User.hasMany(Review, { foreignKey: "reviewerId", as: "reviews" });
Review.belongsTo(User, { foreignKey: "reviewerId", as: "reviewer" });

// Site 1—N Report
Site.hasMany(Report, { foreignKey: "siteId", as: "reports" });
Report.belongsTo(Site, { foreignKey: "siteId", as: "site" });

// Activity 1—N Report (logical link via reports.activity name; no hard FK)
Activity.hasMany(Report, {
  foreignKey: "activity",
  sourceKey: "name",
  as: "reports",
  constraints: false,
});

// Report 1—1 AIAnalysis
Report.hasOne(AIAnalysis, { foreignKey: "reportId", as: "aiAnalysis" });
AIAnalysis.belongsTo(Report, { foreignKey: "reportId", as: "report" });

// LifeSavingRule 1—N AIAnalysis
LifeSavingRule.hasMany(AIAnalysis, { foreignKey: "lifeSavingRuleId", as: "analyses" });
AIAnalysis.belongsTo(LifeSavingRule, { foreignKey: "lifeSavingRuleId", as: "lifeSavingRule" });

// Report 1—N Review
Report.hasMany(Review, { foreignKey: "reportId", as: "reviews" });
Review.belongsTo(Report, { foreignKey: "reportId", as: "report" });

// Report 1—N Embedding
Report.hasMany(Embedding, { foreignKey: "reportId", as: "embeddings" });
Embedding.belongsTo(Report, { foreignKey: "reportId", as: "report" });

// User 1—N WorkerDraft
User.hasMany(WorkerDraft, { foreignKey: "userId", as: "drafts" });
WorkerDraft.belongsTo(User, { foreignKey: "userId", as: "user" });

// Site 1—N WorkerDraft (optional)
Site.hasMany(WorkerDraft, { foreignKey: "siteId", as: "drafts" });
WorkerDraft.belongsTo(Site, { foreignKey: "siteId", as: "site" });

// User 1—N Notification
User.hasMany(Notification, { foreignKey: "userId", as: "notifications" });
Notification.belongsTo(User, { foreignKey: "userId", as: "user" });

// Report 1—N Notification (optional)
Report.hasMany(Notification, { foreignKey: "reportId", as: "notifications" });
Notification.belongsTo(Report, { foreignKey: "reportId", as: "report" });

// Report 1—N AuditEvent (append-only history; SET NULL preserves history)
Report.hasMany(AuditEvent, { foreignKey: "reportId", as: "auditEvents" });
AuditEvent.belongsTo(Report, { foreignKey: "reportId", as: "report" });

// User 1—N AuditEvent as actor (nullable: AI/SYSTEM events carry no user)
User.hasMany(AuditEvent, { foreignKey: "actorUserId", as: "auditEvents" });
AuditEvent.belongsTo(User, { foreignKey: "actorUserId", as: "actor" });

module.exports = {
  sequelize,
  User,
  Site,
  Activity,
  LifeSavingRule,
  Report,
  AIAnalysis,
  Review,
  Pattern,
  Notification,
  AnalysisJob,
  Embedding,
  WorkerDraft,
  AuditEvent,
};
