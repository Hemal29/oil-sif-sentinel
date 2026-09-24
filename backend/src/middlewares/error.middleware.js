"use strict";

function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Multer upload failures → clean client errors (never 500s).
  if (err && (err.name === "MulterError" || err.code === "LIMIT_FILE_SIZE")) {
    const tooLarge = err.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({
      success: false,
      error: {
        code: tooLarge ? "FILE_TOO_LARGE" : "FILE_UPLOAD_ERROR",
        message: tooLarge ? "Uploaded file exceeds the size limit." : err.message || "File upload failed.",
      },
    });
  }

  const status = err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";

  // Never leak raw DB/driver internals to clients.
  let message = err.message || "Internal server error";
  if (status === 500 && !err.statusCode) {
    message = "Internal server error";
  }

  res.status(status).json({
    success: false,
    error: { code, message },
  });
}

module.exports = { notFound, errorHandler };
