# Database Schema — OIL SIF Sentinel (MySQL + Sequelize)

Database: `oil_sif_sentinel` (see `init.sql` — run once in MySQL Workbench).

## Tables (core, implemented)

- `users` — id (UUID PK), name, email UNIQUE, passwordHash (never returned),
  role ENUM(HSE_ADMIN, HSE_REVIEWER, USER), status ENUM(ACTIVE, INACTIVE).
- `sites` — id, name, code UNIQUE, location, description, status.
- `activities` — id, name, code UNIQUE, description, status.
- `life_saving_rules` — id, name, code UNIQUE, description, status,
  isPrototype (demo rows only; official OIL taxonomy comes later).
- `reports` — id, reportNumber UNIQUE, date, siteId → sites.id, location,
  activity, reportType ENUM(UNSAFE_ACT, UNSAFE_CONDITION, NEAR_MISS),
  **description (ORIGINAL evidence — immutable, never overwritten by AI)**,
  equipment, language, sourceFile, status ENUM(NEW, ANALYZED, UNDER_REVIEW, CLOSED),
  createdBy → users.id.
- `ai_analyses` — id, reportId UNIQUE → reports.id (1—1), sifPotential,
  confidence 0–1, activity, hazard, barrierFailure, consequence,
  lifeSavingRuleId → life_saving_rules.id, priority ENUM(LOW, MEDIUM, HIGH, CRITICAL),
  evidence JSON, extractedEntities JSON, modelName, modelVersion,
  analysisStatus ENUM(PENDING, COMPLETED, FAILED). Schema only — no inference yet.
- `reviews` — id, reportId → reports.id, reviewerId → users.id,
  aiPrediction, hseDecision ENUM(CONFIRMED, REJECTED, NEEDS_MORE_INFO),
  comment, reasonCode, reviewedAt. HSE review workflow implemented (Step 3):
  one transaction inserts the review and advances report status
  NEW → UNDER_REVIEW → CLOSED; CLOSED reports reject new reviews (409).

## Tables (prepared for later)

`patterns`, `notifications`, `analysis_jobs`, `embeddings` — models exist,
features (pattern engine, notifications, batch jobs, vector search) do not.

## Relationships

User hasMany Reports/Reviews; Site hasMany Reports; Report belongsTo
User/Site, hasOne AIAnalysis, hasMany Reviews/Embeddings; LifeSavingRule
hasMany AIAnalyses; explicit FKs: reports.createdBy, reports.siteId,
ai_analyses.reportId, ai_analyses.lifeSavingRuleId, reviews.reportId,
reviews.reviewerId.

## Indexes

users.email, sites.code, activities.code, life_saving_rules.code,
reports.reportNumber/date/siteId/reportType/status/createdBy,
ai_analyses.reportId, reviews.reportId/reviewerId.

## Migrations

Production schema changes go in `backend/migrations/` (sequelize-cli).
Dev startup runs non-destructive `sequelize.sync()` only. NEVER `force: true`.
