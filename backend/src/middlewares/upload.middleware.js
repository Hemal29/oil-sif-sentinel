"use strict";

const path = require("path");
const multer = require("multer");
const env = require("../config/env");
const { AppError } = require("../utils/errors");

const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"];
const ALLOWED_MIME_TYPES = new Set([
  "text/csv",
  "text/plain",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new AppError(`Unsupported file type "${ext}". Only .csv, .xlsx and .xls are allowed.`, 400, "INVALID_FILE_TYPE"));
  }
  if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    return cb(new AppError(`Unsupported file content type "${file.mimetype}".`, 400, "INVALID_FILE_TYPE"));
  }
  return cb(null, true);
}

// Temp disk storage only — files are deleted after processing (see controller).
// NOTE: multer requires an integer byte limit; fractional MB values are floored.
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: Math.floor(env.import.maxFileSizeMB * 1024 * 1024), files: 1 },
  fileFilter,
});

module.exports = upload;
module.exports.ALLOWED_EXTENSIONS = ALLOWED_EXTENSIONS;
