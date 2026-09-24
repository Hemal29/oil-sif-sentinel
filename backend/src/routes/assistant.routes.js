"use strict";

// Route placeholder. Validation + auth middleware will be added before controllers.
const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({ success: true, message: "Not implemented yet" });
});

module.exports = router;
