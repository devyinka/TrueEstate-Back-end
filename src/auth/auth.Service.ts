import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  authSessions,
  tenantInvitations,
  agentInvitations,
  tenants,
  users,
  landlords,
  agents,
  technicians,
  landlordAgents,
  otps,
} from "../db/schema.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "./Jwt.js";
import { emailService } from "../thirdparty_services/emailService.js";
import type { LoginInput, RegisterInput } from "./auth.type.js";
import { env } from "../config/env.js";
import { AppError } from "../errors/appError.js";
import { calculateExpiryDate } from "../lib/helper.js";
import { generateSessionId, hashToken } from "../lib/crypo.js";

// ==========================================
// SOCIAL AUTH IMPORTS
// ==========================================
import { OAuth2Client } from "google-auth-library";
import appleSignin from "apple-signin-auth";
import crypto from "crypto";

// Initialize Google Client (ensure GOOGLE_WEB_CLIENT_ID is in your .env / env.js)
const googleClient = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);

function sanitizeUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const authService = {
  //==========================================
  // CREATE AND MANAGE SESSIONS
  // ==========================================
  createSession: async (user: typeof users.$inferSelect) => {
    const sessionId = generateSessionId();

    const accessToken = signAccessToken({
      sub: user.id,
      sid: sessionId,
      role: user.role,
    });

    const refreshToken = signRefreshToken({
      sub: user.id,
      sid: sessionId,
    });

    await db.insert(authSessions).values({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      status: "ACTIVE",
      expiresAt: calculateExpiryDate(env.jwtRefreshExpiresIn),
    });

    return {
      accessToken,
      refreshToken,
    };
  },

  //==========================================
  // OTP GENERATION AND MANAGEMENT
  // ==========================================
  generateVerificationOtp: async (userId: string) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db
      .update(otps)
      .set({ status: "EXPIRED" })
      .where(and(eq(otps.userId, userId), eq(otps.status, "PENDING")));

    const [newOtp] = await db
      .insert(otps)
      .values({
        userId,
        code,
        type: "ACCOUNT_VERIFICATION",
        status: "PENDING",
        expiresAt,
      })
      .returning();

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (user?.email) {
      await emailService.sendOtpEmail(user.email, code, user.firstName);
    }

    return newOtp;
  },

  //==========================================
  // OTP VERIFICATION AND ACCOUNT ACTIVATION
  // ==========================================
  verifyAccountOtp: async (userId: string, code: string) => {
    const otp = await db.query.otps.findFirst({
      where: and(
        eq(otps.userId, userId),
        eq(otps.code, code),
        eq(otps.type, "ACCOUNT_VERIFICATION"),
        eq(otps.status, "PENDING"),
      ),
    });

    if (!otp) throw new AppError("Invalid verification code", 400);

    if (otp.expiresAt < new Date()) {
      await db
        .update(otps)
        .set({ status: "EXPIRED" })
        .where(eq(otps.id, otp.id));
      throw new AppError("Verification code has expired", 400);
    }

    const verifiedUser = await db.transaction(async (tx) => {
      await tx
        .update(otps)
        .set({ status: "USED", updatedAt: new Date() } as any)
        .where(eq(otps.id, otp.id));

      const [updatedUser] = await tx
        .update(users)
        .set({ status: "ACTIVE", updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();

      return updatedUser;
    });

    let hasPendingInvitation = false;

    if (verifiedUser.email) {
      if (verifiedUser.role === "TENANT") {
        const invite = await db.query.tenantInvitations.findFirst({
          where: and(
            eq(tenantInvitations.email, verifiedUser.email),
            eq(tenantInvitations.status, "PENDING"),
          ),
        });
        hasPendingInvitation = !!invite;
      } else if (verifiedUser.role === "AGENT") {
        const invite = await db.query.agentInvitations.findFirst({
          where: and(
            eq(agentInvitations.email, verifiedUser.email),
            eq(agentInvitations.status, "PENDING"),
          ),
        });
        hasPendingInvitation = !!invite;
      }
    }

    const tokens = await authService.createSession(verifiedUser);

    return {
      user: {
        ...sanitizeUser(verifiedUser),
        hasPendingInvitation,
      },
      ...tokens,
    };
  },

  //==========================================
  // ACCOUNT REGISTRATION (EMAIL/PASSWORD)
  // ==========================================
  registerUser: async (input: RegisterInput) => {
    const email = input.email?.trim().toLowerCase() ?? null;
    const phone = input.phone?.trim() ?? null;

    if (email) {
      const existingEmail = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
      if (existingEmail)
        throw new AppError("An account with this email already exists", 409);
    }

    if (phone) {
      const existingPhone = await db.query.users.findFirst({
        where: eq(users.phone, phone),
      });
      if (existingPhone)
        throw new AppError("An account with this phone already exists", 409);
    }

    if (
      input.invitationToken &&
      input.role !== "TENANT" &&
      input.role !== "AGENT"
    ) {
      throw new AppError(
        "Invitation token can only be used when registering as a tenant or agent",
        400,
      );
    }

    const passwordHash = await hashPassword(input.password);

    const user = await db.transaction(async (transaction) => {
      let tenantInvitation = null;
      let agentInvitation = null;

      if (input.invitationToken) {
        const tokenHash = hashToken(input.invitationToken);

        if (input.role === "TENANT") {
          tenantInvitation =
            await transaction.query.tenantInvitations.findFirst({
              where: eq(tenantInvitations.tokenHash, tokenHash),
            });
          if (!tenantInvitation)
            throw new AppError("Invalid tenant invitation token", 400);
          if (tenantInvitation.status !== "PENDING")
            throw new AppError(
              "This tenant invitation is no longer available",
              400,
            );

          if (tenantInvitation.expiresAt <= new Date()) {
            await transaction
              .update(tenantInvitations)
              .set({ status: "EXPIRED", updatedAt: new Date() })
              .where(eq(tenantInvitations.id, tenantInvitation.id));
            throw new AppError("This tenant invitation has expired", 400);
          }

          const emailMatches =
            tenantInvitation.email &&
            email &&
            tenantInvitation.email.toLowerCase() === email;
          const phoneMatches =
            tenantInvitation.phone && phone && tenantInvitation.phone === phone;
          if (!emailMatches && !phoneMatches)
            throw new AppError(
              "Your email or phone does not match the invitation",
              403,
            );
        }

        if (input.role === "AGENT") {
          agentInvitation = await transaction.query.agentInvitations.findFirst({
            where: eq(agentInvitations.tokenHash, tokenHash),
          });
          if (!agentInvitation)
            throw new AppError("Invalid agent invitation token", 400);
          if (agentInvitation.status !== "PENDING")
            throw new AppError(
              "This agent invitation is no longer available",
              400,
            );

          if (agentInvitation.expiresAt <= new Date()) {
            await transaction
              .update(agentInvitations)
              .set({ status: "EXPIRED", updatedAt: new Date() })
              .where(eq(agentInvitations.id, agentInvitation.id));
            throw new AppError("This agent invitation has expired", 400);
          }

          const emailMatches =
            agentInvitation.email &&
            email &&
            agentInvitation.email.toLowerCase() === email;
          const phoneMatches =
            agentInvitation.phone && phone && agentInvitation.phone === phone;
          if (!emailMatches && !phoneMatches)
            throw new AppError(
              "Your email or phone does not match the invitation",
              403,
            );
        }
      }

      const [createdUser] = await transaction
        .insert(users)
        .values({
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email,
          phone,
          passwordHash,
          role: input.role,
          status: "PENDING",
        })
        .returning();

      if (!createdUser) throw new AppError("Failed to create user", 500);

      if (input.role === "LANDLORD") {
        const [landlord] = await transaction
          .insert(landlords)
          .values({ userId: createdUser.id })
          .returning();
        if (!landlord)
          throw new AppError("Failed to create landlord profile", 500);
      }

      let createdAgent = null;
      if (input.role === "AGENT") {
        const [agent] = await transaction
          .insert(agents)
          .values({ userId: createdUser.id })
          .returning();
        if (!agent) throw new AppError("Failed to create agent profile", 500);
        createdAgent = agent;
      }

      if (input.role === "TENANT") {
        const [tenant] = await transaction
          .insert(tenants)
          .values({ userId: createdUser.id })
          .returning();
        if (!tenant) throw new AppError("Failed to create tenant profile", 500);
      }

      if (input.role === "TECHNICIAN") {
        const [technician] = await transaction
          .insert(technicians)
          .values({ userId: createdUser.id })
          .returning();
        if (!technician)
          throw new AppError("Failed to create technician profile", 500);
      }

      //  For standard email registration, the invitation remains pending
      // until the user verifies their OTP. Once active, they can accept it.

      return createdUser;
    });

    const tokens = await authService.createSession(user);
    await authService.generateVerificationOtp(user.id);

    return {
      user: sanitizeUser(user),
      ...tokens,
    };
  },

  //==========================================
  // SOCIAL AUTHENTICATION (GOOGLE & APPLE)
  // ==========================================
  handleSocialAuth: async (input: {
    idToken: string;
    provider: "GOOGLE" | "APPLE";
    role?: "LANDLORD" | "AGENT" | "TENANT" | "TECHNICIAN";
    invitationToken?: string;
    firstName?: string;
    lastName?: string;
  }) => {
    //  NEW USER CREATION (SIGNUP FLOW)
    if (!input.role) {
      throw new AppError(
        "Account not found. Please sign up and select a role.",
        404,
      );
    }

    let email: string;
    let firstName = input.firstName?.trim() || "User";
    let lastName = input.lastName?.trim() || "";

    // VERIFY TOKEN
    if (input.provider === "GOOGLE") {
      const ticket = await googleClient.verifyIdToken({
        idToken: input.idToken,
        audience: process.env.GOOGLE_WEB_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email)
        throw new AppError("Invalid Google token", 401);

      email = payload.email.toLowerCase();
      firstName = payload.given_name || firstName;
      lastName = payload.family_name || lastName;
    } else {
      const payload = await appleSignin.verifyIdToken(input.idToken, {
        audience: process.env.APPLE_BUNDLE_ID,
        ignoreExpiration: false,
      });
      if (!payload || !payload.email)
        throw new AppError("Invalid Apple token", 401);

      email = payload.email.toLowerCase();
    }

    //  CHECK IF USER EXISTS (LOGIN FLOW)
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      if (existingUser.status === "SUSPENDED")
        throw new AppError("This account is suspended", 403);

      // Upgrade PENDING to ACTIVE because Social Providers verify emails
      if (existingUser.status === "PENDING") {
        await db
          .update(users)
          .set({ status: "ACTIVE", updatedAt: new Date() })
          .where(eq(users.id, existingUser.id));
        existingUser.status = "ACTIVE";
      }

      // Check if they have pending invitations waiting for them
      let hasPendingInvitation = false;
      let pendingInvitation = null;

      if (existingUser.role === "TENANT") {
        const invite = await db.query.tenantInvitations.findFirst({
          where: and(
            eq(tenantInvitations.email, existingUser.email!),
            eq(tenantInvitations.status, "PENDING"),
          ),
        });
        if (invite) {
          hasPendingInvitation = true;
          pendingInvitation = invite;
        }
      } else if (existingUser.role === "AGENT") {
        const invite = await db.query.agentInvitations.findFirst({
          where: and(
            eq(agentInvitations.email, existingUser.email!),
            eq(agentInvitations.status, "PENDING"),
          ),
        });
        if (invite) {
          hasPendingInvitation = true;
          pendingInvitation = invite;
        }
      }

      const tokens = await authService.createSession(existingUser);
      return {
        isNewUser: false,
        user: { ...sanitizeUser(existingUser), hasPendingInvitation },
        pendingInvitation,
        ...tokens,
      };
    }

    if (
      input.invitationToken &&
      input.role !== "TENANT" &&
      input.role !== "AGENT"
    ) {
      throw new AppError(
        "Invitation token can only be used when registering as a tenant or agent",
        400,
      );
    }

    const passwordHash = await hashPassword(
      crypto.randomBytes(32).toString("hex"),
    );

    let pendingInvitation: any = null;
    let hasPendingInvitation = false;

    const newUser = await db.transaction(async (transaction) => {
      let tenantInvitation = null;
      let agentInvitation = null;

      // Validate Explicit Invitation Token
      if (input.invitationToken) {
        const tokenHash = hashToken(input.invitationToken);

        if (input.role === "TENANT") {
          tenantInvitation =
            await transaction.query.tenantInvitations.findFirst({
              where: eq(tenantInvitations.tokenHash, tokenHash),
            });
          if (!tenantInvitation)
            throw new AppError("Invalid tenant invitation token", 400);
          if (tenantInvitation.status !== "PENDING")
            throw new AppError(
              "This tenant invitation is no longer available",
              400,
            );

          if (tenantInvitation.expiresAt <= new Date()) {
            await transaction
              .update(tenantInvitations)
              .set({ status: "EXPIRED", updatedAt: new Date() })
              .where(eq(tenantInvitations.id, tenantInvitation.id));
            throw new AppError("This tenant invitation has expired", 400);
          }
        }

        if (input.role === "AGENT") {
          agentInvitation = await transaction.query.agentInvitations.findFirst({
            where: eq(agentInvitations.tokenHash, tokenHash),
          });
          if (!agentInvitation)
            throw new AppError("Invalid agent invitation token", 400);
          if (agentInvitation.status !== "PENDING")
            throw new AppError(
              "This agent invitation is no longer available",
              400,
            );

          if (agentInvitation.expiresAt <= new Date()) {
            await transaction
              .update(agentInvitations)
              .set({ status: "EXPIRED", updatedAt: new Date() })
              .where(eq(agentInvitations.id, agentInvitation.id));
            throw new AppError("This agent invitation has expired", 400);
          }
        }
      }

      const [createdUser] = await transaction
        .insert(users)
        .values({
          firstName,
          lastName,
          email,
          phone: null,
          passwordHash,
          role: input.role as any,
          status: "ACTIVE", // Social accounts skip OTP step!
        })
        .returning();

      if (!createdUser) throw new AppError("Failed to create user", 500);

      // Create proper role profiles
      if (input.role === "LANDLORD")
        await transaction.insert(landlords).values({ userId: createdUser.id });

      if (input.role === "AGENT") {
        await transaction.insert(agents).values({ userId: createdUser.id });
      }

      if (input.role === "TENANT")
        await transaction.insert(tenants).values({ userId: createdUser.id });

      if (input.role === "TECHNICIAN")
        await transaction
          .insert(technicians)
          .values({ userId: createdUser.id });

      // Export the invitation to the outer scope so the mobile app receives it
      if (tenantInvitation) pendingInvitation = tenantInvitation;
      if (agentInvitation) pendingInvitation = agentInvitation;

      // Note: We leave the invitation status as "PENDING".
      // The user must explicitly accept it via the frontend flow to trigger tenancy creation.

      return createdUser;
    });

    // Check for implicitly pending invitations by email if they didn't pass a token
    if (!input.invitationToken) {
      if (newUser.role === "TENANT") {
        const invite = await db.query.tenantInvitations.findFirst({
          where: and(
            eq(tenantInvitations.email, newUser.email!),
            eq(tenantInvitations.status, "PENDING"),
          ),
        });
        if (invite) pendingInvitation = invite;
      } else if (newUser.role === "AGENT") {
        const invite = await db.query.agentInvitations.findFirst({
          where: and(
            eq(agentInvitations.email, newUser.email!),
            eq(agentInvitations.status, "PENDING"),
          ),
        });
        if (invite) pendingInvitation = invite;
      }
    }

    if (pendingInvitation) hasPendingInvitation = true;

    const tokens = await authService.createSession(newUser);
    return {
      isNewUser: true,
      user: { ...sanitizeUser(newUser), hasPendingInvitation },
      pendingInvitation,
      ...tokens,
    };
  },

  //==========================================
  // ACCOUNT LOGIN
  // ==========================================
  loginUser: async (input: LoginInput) => {
    const identifier = input.identifier.trim();

    const user = identifier.includes("@")
      ? await db.query.users.findFirst({
          where: eq(users.email, identifier.toLowerCase()),
        })
      : await db.query.users.findFirst({ where: eq(users.phone, identifier) });

    if (!user || !user.passwordHash)
      throw new AppError("Invalid credentials", 401);
    if (user.status !== "ACTIVE")
      throw new AppError("This account is not active", 403);

    const validPassword = await verifyPassword(
      user.passwordHash,
      input.password,
    );
    if (!validPassword) throw new AppError("Invalid credentials", 401);

    const tokens = await authService.createSession(user);

    return {
      user: sanitizeUser(user),
      ...tokens,
    };
  },

  //==========================================
  // SESSION REFRESH
  // ==========================================
  refreshSession: async (refreshToken: string) => {
    const payload = verifyRefreshToken(refreshToken);

    const session = await db.query.authSessions.findFirst({
      where: and(
        eq(authSessions.id, payload.sid),
        eq(authSessions.userId, payload.sub),
      ),
    });

    if (!session) throw new AppError("Session not found", 401);
    if (session.status !== "ACTIVE")
      throw new AppError("Session is no longer active", 401);
    if (session.expiresAt < new Date())
      throw new AppError("Refresh token expired", 401);

    if (hashToken(refreshToken) !== session.refreshTokenHash) {
      await db
        .update(authSessions)
        .set({ status: "REVOKED", revokedAt: new Date() })
        .where(eq(authSessions.id, session.id));
      throw new AppError("Invalid refresh token", 401);
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });
    if (!user || user.status !== "ACTIVE")
      throw new AppError("User is not active", 401);

    const newRefreshToken = signRefreshToken({ sub: user.id, sid: session.id });
    const newAccessToken = signAccessToken({
      sub: user.id,
      sid: session.id,
      role: user.role,
    });

    const [rotatedSession] = await db
      .update(authSessions)
      .set({
        refreshTokenHash: hashToken(newRefreshToken),
        lastUsedAt: new Date(),
      })
      .where(
        and(
          eq(authSessions.id, session.id),
          eq(authSessions.refreshTokenHash, session.refreshTokenHash),
          eq(authSessions.status, "ACTIVE"),
          gt(authSessions.expiresAt, new Date()),
        ),
      )
      .returning({ id: authSessions.id });

    if (!rotatedSession)
      throw new AppError("Refresh token has already been used", 401);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  },

  //==========================================
  // LOGOUT AND SESSION REVOCATION
  // ==========================================
  logoutSession: async (sessionId: string) => {
    await db
      .update(authSessions)
      .set({ status: "REVOKED", revokedAt: new Date() })
      .where(eq(authSessions.id, sessionId));
  },

  // ==========================================
  // PASSWORD MANAGEMENT
  // ==========================================
  forgotPassword: async (emailInput: string) => {
    const email = emailInput.trim().toLowerCase();
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user)
      throw new AppError(
        "If an account exists, a reset email has been sent.",
        404,
      );

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await db
      .update(otps)
      .set({ status: "EXPIRED" })
      .where(
        and(
          eq(otps.userId, user.id),
          eq(otps.type, "PASSWORD_RESET"),
          eq(otps.status, "PENDING"),
        ),
      );

    await db.insert(otps).values({
      userId: user.id,
      code,
      type: "PASSWORD_RESET",
      status: "PENDING",
      expiresAt,
    });

    if (user.email)
      await emailService.sendPasswordResetEmail(
        user.email,
        code,
        user.firstName,
      );

    return {
      message: "If an account exists, a password reset code has been sent.",
    };
  },

  resetPassword: async (
    emailInput: string,
    code: string,
    newPassword: string,
  ) => {
    const email = emailInput.trim().toLowerCase();
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!user) throw new AppError("Invalid reset request", 400);

    const otp = await db.query.otps.findFirst({
      where: and(
        eq(otps.userId, user.id),
        eq(otps.code, code.trim()),
        eq(otps.type, "PASSWORD_RESET"),
        eq(otps.status, "PENDING"),
      ),
    });

    if (!otp) throw new AppError("Invalid verification code", 400);
    if (otp.expiresAt < new Date()) {
      await db
        .update(otps)
        .set({ status: "EXPIRED" })
        .where(eq(otps.id, otp.id));
      throw new AppError("Verification code has expired", 400);
    }

    const passwordHash = await hashPassword(newPassword);

    await db.transaction(async (tx) => {
      await tx
        .update(otps)
        .set({ status: "USED", updatedAt: new Date() } as any)
        .where(eq(otps.id, otp.id));
      await tx
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    });

    return {
      success: true,
      message: "Password has been successfully reset. You can now log in.",
    };
  },

  changePassword: async (
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user || !user.passwordHash) throw new AppError("User not found", 404);

    const validPassword = await verifyPassword(
      user.passwordHash,
      currentPassword,
    );
    if (!validPassword)
      throw new AppError("The current password you entered is incorrect", 400);

    const newPasswordHash = await hashPassword(newPassword);
    await db
      .update(users)
      .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { success: true, message: "Password changed successfully" };
  },
};
