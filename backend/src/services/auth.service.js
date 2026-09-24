"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { AppError } = require("../utils/errors");
const User = require("../models/User");

function toSafeUser(user) {
  const plain = user.get ? user.get({ plain: true }) : user;
  const { passwordHash, ...safe } = plain;
  return safe;
}

function signToken(user) {
  if (!env.jwtSecret) {
    throw new AppError("JWT secret is not configured", 500, "CONFIG_ERROR");
  }
  return jwt.sign({ userId: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

async function registerUser({ name, email, password }) {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new AppError("Email is already registered", 409, "DUPLICATE_EMAIL");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  // Public registration always creates a plain USER. Roles are assigned by admins.
  const user = await User.create({ name, email, passwordHash, role: "USER" });
  return { user: toSafeUser(user), token: signToken(user) };
}

async function loginUser({ email, password }) {
  const user = await User.unscoped().findOne({ where: { email } });
  if (!user) {
    throw new AppError("Invalid email or password", 401, "AUTHENTICATION_ERROR");
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new AppError("Invalid email or password", 401, "AUTHENTICATION_ERROR");
  }
  if (user.status !== "ACTIVE") {
    throw new AppError("User account is inactive", 403, "INACTIVE_USER");
  }
  return { user: toSafeUser(user), token: signToken(user) };
}

async function getUserById(userId) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new AppError("User not found", 404, "NOT_FOUND");
  }
  return toSafeUser(user);
}

module.exports = { registerUser, loginUser, getUserById, toSafeUser, signToken };
