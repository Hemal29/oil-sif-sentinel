"use strict";

// Thin controller placeholder — delegates to services/. No business logic here yet.

async function placeholder(req, res, next) {
  try {
    return res.status(200).json({ success: true, message: "Not implemented yet" });
  } catch (err) { next(err); }
}

module.exports = { placeholder };
