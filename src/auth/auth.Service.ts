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

  generateVerificationOtp: async (userId: string) => {
    //  Generate a random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    //  Set expiration to 15 minutes from now
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    //  Invalidate any existing pending OTPs for this user
    await db
      .update(otps)
      .set({ status: "EXPIRED" })
      .where(and(eq(otps.userId, userId), eq(otps.status, "PENDING")));

    //  Save the new OTP
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

  //  Verify the user's account using the OTP
  verifyAccountOtp: async (userId: string, code: string) => {
    //  Find the OTP
    const otp = await db.query.otps.findFirst({
      where: and(
        eq(otps.userId, userId),
        eq(otps.code, code),
        eq(otps.type, "ACCOUNT_VERIFICATION"),
        eq(otps.status, "PENDING"),
      ),
    });

    if (!otp) {
      throw new AppError("Invalid verification code", 400);
    }

    if (otp.expiresAt < new Date()) {
      await db
        .update(otps)
        .set({ status: "EXPIRED" })
        .where(eq(otps.id, otp.id));
      throw new AppError("Verification code has expired", 400);
    }

    //  Mark OTP as used and User as ACTIVE in a transaction
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
          where: eq(tenantInvitations.email, verifiedUser.email),
        });
        hasPendingInvitation = !!invite;
      } else if (verifiedUser.role === "AGENT") {
        const invite = await db.query.agentInvitations.findFirst({
          where: eq(agentInvitations.email, verifiedUser.email),
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

  registerUser: async (input: RegisterInput) => {
    const email = input.email?.trim().toLowerCase() ?? null;
    const phone = input.phone?.trim() ?? null;

    if (email) {
      const existingEmail = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (existingEmail) {
        throw new AppError("An account with this email already exists", 409);
      }
    }

    if (phone) {
      const existingPhone = await db.query.users.findFirst({
        where: eq(users.phone, phone),
      });

      if (existingPhone) {
        throw new AppError("An account with this phone already exists", 409);
      }
    }

    // INVITATION TOKEN VALIDATION
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

      // TENANT OR AGENT INVITATION VALIDATION
      if (input.invitationToken) {
        const tokenHash = hashToken(input.invitationToken);

        // TENANT INVITATION
        if (input.role === "TENANT") {
          tenantInvitation =
            await transaction.query.tenantInvitations.findFirst({
              where: eq(tenantInvitations.tokenHash, tokenHash),
            });

          if (!tenantInvitation) {
            throw new AppError("Invalid tenant invitation token", 400);
          }

          if (tenantInvitation.status !== "PENDING") {
            throw new AppError(
              "This tenant invitation is no longer available",
              400,
            );
          }

          if (tenantInvitation.expiresAt <= new Date()) {
            await transaction
              .update(tenantInvitations)
              .set({
                status: "EXPIRED",
                updatedAt: new Date(),
              })
              .where(eq(tenantInvitations.id, tenantInvitation.id));

            throw new AppError("This tenant invitation has expired", 400);
          }

          const emailMatches =
            tenantInvitation.email &&
            email &&
            tenantInvitation.email.toLowerCase() === email;

          const phoneMatches =
            tenantInvitation.phone && phone && tenantInvitation.phone === phone;

          if (!emailMatches && !phoneMatches) {
            throw new AppError(
              "Your email or phone does not match the invitation",
              403,
            );
          }
        }

        // AGENT INVITATION
        if (input.role === "AGENT") {
          agentInvitation = await transaction.query.agentInvitations.findFirst({
            where: eq(agentInvitations.tokenHash, tokenHash),
          });

          if (!agentInvitation) {
            throw new AppError("Invalid agent invitation token", 400);
          }

          if (agentInvitation.status !== "PENDING") {
            throw new AppError(
              "This agent invitation is no longer available",
              400,
            );
          }

          if (agentInvitation.expiresAt <= new Date()) {
            await transaction
              .update(agentInvitations)
              .set({
                status: "EXPIRED",
                updatedAt: new Date(),
              })
              .where(eq(agentInvitations.id, agentInvitation.id));

            throw new AppError("This agent invitation has expired", 400);
          }

          const emailMatches =
            agentInvitation.email &&
            email &&
            agentInvitation.email.toLowerCase() === email;

          const phoneMatches =
            agentInvitation.phone && phone && agentInvitation.phone === phone;

          if (!emailMatches && !phoneMatches) {
            throw new AppError(
              "Your email or phone does not match the invitation",
              403,
            );
          }
        }
      }

      // CREATE USER
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

      if (!createdUser) {
        throw new AppError("Failed to create user", 500);
      }

      // LANDLORD PROFILE
      if (input.role === "LANDLORD") {
        const [landlord] = await transaction
          .insert(landlords)
          .values({
            userId: createdUser.id,
          })
          .returning();

        if (!landlord) {
          throw new AppError("Failed to create landlord profile", 500);
        }
      }

      // AGENT PROFILE
      let createdAgent = null;

      if (input.role === "AGENT") {
        const [agent] = await transaction
          .insert(agents)
          .values({
            userId: createdUser.id,
          })
          .returning();

        if (!agent) {
          throw new AppError("Failed to create agent profile", 500);
        }

        createdAgent = agent;
      }

      // TENANT PROFILE
      if (input.role === "TENANT") {
        const [tenant] = await transaction
          .insert(tenants)
          .values({
            userId: createdUser.id,
          })
          .returning();

        if (!tenant) {
          throw new AppError("Failed to create tenant profile", 500);
        }
      }

      // TECHNICIAN PROFILE
      if (input.role === "TECHNICIAN") {
        const [technician] = await transaction
          .insert(technicians)
          .values({
            userId: createdUser.id,
          })
          .returning();

        if (!technician) {
          throw new AppError("Failed to create technician profile", 500);
        }
      }

      // ACCEPT TENANT INVITATION
      if (tenantInvitation) {
        const [acceptedInvitation] = await transaction
          .update(tenantInvitations)
          .set({
            status: "ACCEPTED",
            acceptedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(tenantInvitations.id, tenantInvitation.id),
              eq(tenantInvitations.status, "PENDING"),
            ),
          )
          .returning();

        if (!acceptedInvitation) {
          throw new AppError("Tenant invitation is no longer available", 409);
        }
      }

      // ACCEPT AGENT INVITATION
      if (agentInvitation) {
        if (!createdAgent) {
          throw new AppError("Agent profile was not created", 500);
        }

        // CREATE THE ACTUAL LANDLORD-AGENT RELATIONSHIP
        const [relationship] = await transaction
          .insert(landlordAgents)
          .values({
            landlordId: agentInvitation.landlordId,
            agentId: createdAgent.id,
            status: "ACTIVE",
            acceptedAt: new Date(),
          })
          .returning();

        if (!relationship) {
          throw new AppError(
            "Failed to create landlord-agent relationship",
            500,
          );
        }

        // MARK THE INVITATION AS ACCEPTED
        const [acceptedInvitation] = await transaction
          .update(agentInvitations)
          .set({
            status: "ACCEPTED",
            acceptedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(agentInvitations.id, agentInvitation.id),
              eq(agentInvitations.status, "PENDING"),
            ),
          )
          .returning();

        if (!acceptedInvitation) {
          throw new AppError("Agent invitation is no longer available", 409);
        }
      }

      return createdUser;
    });

    // CREATE AUTH SESSION
    const tokens = await authService.createSession(user);

    // GENERATE OTP FOR ACCOUNT VERIFICATION
    const otp = await authService.generateVerificationOtp(user.id);

    return {
      user: sanitizeUser(user),
      ...tokens,

      // i will delete this in production
      devOtpCode: otp.code,
    };
  },

  loginUser: async (input: LoginInput) => {
    const identifier = input.identifier.trim();

    const user = identifier.includes("@")
      ? await db.query.users.findFirst({
          where: eq(users.email, identifier.toLowerCase()),
        })
      : await db.query.users.findFirst({
          where: eq(users.phone, identifier),
        });

    if (!user || !user.passwordHash) {
      throw new AppError("Invalid credentials", 401);
    }

    if (user.status !== "ACTIVE") {
      throw new AppError("This account is not active", 403);
    }

    const validPassword = await verifyPassword(
      user.passwordHash,
      input.password,
    );

    if (!validPassword) {
      throw new AppError("Invalid credentials", 401);
    }

    const tokens = await authService.createSession(user);

    return {
      user: sanitizeUser(user),
      ...tokens,
    };
  },

  refreshSession: async (refreshToken: string) => {
    const payload = verifyRefreshToken(refreshToken);

    const session = await db.query.authSessions.findFirst({
      where: and(
        eq(authSessions.id, payload.sid),
        eq(authSessions.userId, payload.sub),
      ),
    });

    if (!session) {
      throw new AppError("Session not found", 401);
    }

    if (session.status !== "ACTIVE") {
      throw new AppError("Session is no longer active", 401);
    }

    if (session.expiresAt < new Date()) {
      throw new AppError("Refresh token expired", 401);
    }

    if (hashToken(refreshToken) !== session.refreshTokenHash) {
      // A mismatched refresh hash indicates token reuse, so revoke the session to contain replay.
      await db
        .update(authSessions)
        .set({
          status: "REVOKED",
          revokedAt: new Date(),
        })
        .where(eq(authSessions.id, session.id));

      throw new AppError("Invalid refresh token", 401);
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });

    if (!user || user.status !== "ACTIVE") {
      throw new AppError("User is not active", 401);
    }

    const newRefreshToken = signRefreshToken({
      sub: user.id,
      sid: session.id,
    });

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
      // The old hash makes refresh-token rotation a one-winner operation.
      .where(
        and(
          eq(authSessions.id, session.id),
          eq(authSessions.refreshTokenHash, session.refreshTokenHash),
          eq(authSessions.status, "ACTIVE"),
          gt(authSessions.expiresAt, new Date()),
        ),
      )
      .returning({ id: authSessions.id });

    if (!rotatedSession) {
      throw new AppError("Refresh token has already been used", 401);
    }

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  },

  logoutSession: async (sessionId: string) => {
    await db
      .update(authSessions)
      .set({
        status: "REVOKED",
        revokedAt: new Date(),
      })
      .where(eq(authSessions.id, sessionId));
  },
};
