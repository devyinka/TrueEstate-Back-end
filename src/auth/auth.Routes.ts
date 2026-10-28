import { Router } from "express";
import { z } from "zod";

import {
  login,
  logout,
  refresh,
  register,
  verifyAccount,
} from "./auth.Controller.js";

import { requireAuth } from "./auth.MiddleWare.js";

import {
  loginRateLimiter,
  refreshRateLimiter,
  registerRateLimiter,
  otpRateLimiter,
} from "./auth.ratelimit.js";

const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    "Phone number must be in international format, e.g. +2348012345678",
  );

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(30, "Password must not exceed 30 characters");

export const registerSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, "First name must be at least 2 characters")
      .max(100, "First name must not exceed 100 characters"),

    lastName: z
      .string()
      .trim()
      .min(2, "Last name must be at least 2 characters")
      .max(100, "Last name must not exceed 100 characters"),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Please provide a valid email address")
      .optional(),

    phone: phoneSchema.optional(),

    password: passwordSchema,

    role: z.enum(["LANDLORD", "AGENT", "TENANT", "TECHNICIAN"]),

    invitationToken: z
      .string()
      .trim()
      .min(1, "Invitation token cannot be empty")
      .optional(),
  })
  .refine((data) => Boolean(data.email || data.phone), {
    message: "Email or phone is required",
    path: ["email"],
  });

export const verifyOtpSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
  code: z
    .string()
    .trim()
    .length(6, "Verification code must be exactly 6 digits")
    .regex(/^\d+$/, "Verification code must contain only numbers"),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Email or phone is required"),

  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

const router = Router();

router.post("/register", registerRateLimiter, register);

router.post("/login", loginRateLimiter, login);

router.post("/refresh", refreshRateLimiter, refresh);

router.post("/verify", otpRateLimiter, verifyAccount);

router.post("/logout", requireAuth, logout);

export default router;
