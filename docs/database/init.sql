-- OIL SIF Sentinel — database bootstrap.
-- Run once in MySQL Workbench (or mysql CLI) before starting the backend.
-- Tables themselves are created by Sequelize models / migrations.

CREATE DATABASE IF NOT EXISTS oil_sif_sentinel
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Verify:
-- USE oil_sif_sentinel;
-- SHOW TABLES;
