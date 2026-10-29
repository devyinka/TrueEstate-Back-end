import type { Request, Response } from "express";
import { authService } from "./auth.Service";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  verifyOtpSchema,
  socialAuthSchema,
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
  return res.json({ success: true, message: "Login successful", data: result });
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
    return res
      .status(401)
      .json({ success: false, message: "Authentication required" });
  }
  await authService.logoutSession(req.user.sessionId);
  return res.json({ success: true, message: "Logged out successfully" });
}

export const forgotPassword = async (req: Request, res: Response) => {
  const { identifier } = forgotPasswordSchema.parse(req.body);
  const result = await authService.forgotPassword(identifier);
  return res.status(200).json({ success: true, message: result.message });
};

export const resetPassword = async (req: Request, res: Response) => {
  const { identifier, code, newPassword } = resetPasswordSchema.parse(req.body);
  const result = await authService.resetPassword(identifier, code, newPassword);
  return res.status(200).json({ success: true, message: result.message });
};

export const changePassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const result = await authService.changePassword(
    req.user!.id,
    currentPassword,
    newPassword,
  );
  return res.status(200).json({ success: true, message: result.message });
};

export async function googleAuth(req: Request, res: Response) {
  const input = socialAuthSchema.parse(req.body);

  const result = await authService.handleSocialAuth({
    ...input,
    provider: "GOOGLE",
  });

  const statusCode = result.isNewUser ? 201 : 200;

  return res.status(statusCode).json({
    success: true,
    message: result.isNewUser
      ? "Account created successfully"
      : "Login successful",
    data: {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      pendingInvitation: result.pendingInvitation,
    },
  });
}

export async function appleAuth(req: Request, res: Response) {
  const input = socialAuthSchema.parse(req.body);

  const result = await authService.handleSocialAuth({
    ...input,
    provider: "APPLE",
  });

  const statusCode = result.isNewUser ? 201 : 200;

  return res.status(statusCode).json({
    success: true,
    message: result.isNewUser
      ? "Account created successfully"
      : "Login successful",
    data: {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      pendingInvitation: result.pendingInvitation,
    },
  });
}
