"use strict";

const { z } = require("zod");

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().trim().toLowerCase().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters"),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
  })
  .strict();

module.exports = { registerSchema, loginSchema };
