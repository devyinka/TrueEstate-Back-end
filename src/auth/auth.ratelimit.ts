import rateLimit from "express-rate-limit";

/**
 * Login
 *
 * Protects against password-guessing and credential stuffing.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },
});

/**
 * Registration
 *
 * Prevents automated creation of large numbers of accounts.
 */
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many registration attempts. Please try again later.",
  },
});

/**
 * Forgot password
 *
 * Password-reset endpoints are especially sensitive because
 * they can be abused to spam email.
 */
export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many password reset requests. Please try again later.",
  },
});

/**
 * Email verification
 */
export const verifyEmailRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many verification attempts. Please try again later.",
  },
});

/**
 * Resend verification email
 */
export const resendVerificationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many verification requests. Please try again later.",
  },
});

export const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many token refresh requests. Please try again later.",
  },
});

export const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many verification attempts, please try again later",
  },
});

/**
 * Reset password (Submit code + new password)
 *
 * Protects against brute-forcing the 6-digit reset code.
 * Tied to the 15-minute expiration window of the OTP.
 */
export const resetPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many password reset attempts. Please request a new code.",
  },
});

/**
 * Change password (Authenticated)
 *
 * Prevents account takeover scripts from rapidly guessing
 * the current password on a compromised active session.
 */
export const changePasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many password change attempts. Please try again later.",
  },
});
