"use strict";

const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { AppError } = require("../utils/errors");
const User = require("../models/User");

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new AppError("Authentication token is missing", 401, "AUTHENTICATION_ERROR");
    }
    if (!env.jwtSecret) {
      throw new AppError("JWT secret is not configured", 500, "CONFIG_ERROR");
    }
    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch (err) {
      throw new AppError("Invalid or expired token", 401, "AUTHENTICATION_ERROR");
    }
    const user = await User.findByPk(payload.userId);
    if (!user) {
      throw new AppError("User no longer exists", 401, "AUTHENTICATION_ERROR");
    }
    if (user.status !== "ACTIVE") {
      throw new AppError("User account is inactive", 403, "INACTIVE_USER");
    }
    req.user = user.get({ plain: true });
    delete req.user.passwordHash;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = authenticate;
