"use strict";

const authService = require("../services/auth.service");
const { ok, created } = require("../utils/apiResponse");

async function register(req, res, next) {
  try {
    const { user, token } = await authService.registerUser(req.body);
    return created(res, { user, token }, "Registration successful");
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { user, token } = await authService.loginUser(req.body);
    return ok(res, { user, token }, "Login successful");
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await authService.getUserById(req.user.id);
    return ok(res, { user }, "Current user");
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login, me };
