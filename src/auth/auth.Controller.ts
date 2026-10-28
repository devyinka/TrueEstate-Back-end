import type { NextFunction, Request, Response } from "express";

import { authService } from "./auth.Service";

import {
  loginSchema,
  refreshSchema,
  registerSchema,
  verifyOtpSchema,
} from "./auth.Routes.js";

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);

  const result = await authService.registerUser(input);

  return res.status(201).json({
    success: true,
    message: "Account created successfully",
    data: result,
  });
}

export async function verifyAccount(req: Request, res: Response) {
  const validatedData = verifyOtpSchema.parse(req.body);

  const result = await authService.verifyAccountOtp(
    validatedData.userId,
    validatedData.code,
  );

  return res.status(200).json({
    success: true,
    message: "Account successfully verified",
    data: result,
  });
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);

  const result = await authService.loginUser(input);

  return res.json({
    success: true,
    message: "Login successful",
    data: result,
  });
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = refreshSchema.parse(req.body);

  const tokens = await authService.refreshSession(refreshToken);

  return res.json({
    success: true,
    message: "Token refreshed successfully",
    data: tokens,
  });
}

export async function logout(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  await authService.logoutSession(req.user.sessionId);

  return res.json({
    success: true,
    message: "Logged out successfully",
  });
}
