import { and, eq, or } from "drizzle-orm";

import { db } from "../db/index.js";
import {
  agentInvitations,
  agents,
  landlordAgents,
  landlords,
  users,
} from "../db/schema.js";

import { AppError } from "../errors/appError.js";

import type { CreateAgentInvitationInput } from "../types/agent.type.js";

import { emailService } from "../thirdparty_services/emailService.js";

import { generateToken, hashToken } from "../lib/crypo.js";

export const agentInvitationService = {
  // CREATE AGENT INVITATION
  createInvitation: async (
    userId: string,
    input: CreateAgentInvitationInput,
  ) => {
    const email = input.email?.trim().toLowerCase() ?? null;
    const phone = input.phone?.trim() ?? null;

    if (!email && !phone) {
      throw new AppError("Either email or phone is required", 400);
    }

    // FIND LANDLORD PROFILE
    const landlord = await db.query.landlords.findFirst({
      where: eq(landlords.userId, userId),
    });

    if (!landlord) {
      throw new AppError("Landlord profile not found", 404);
    }

    // FIND EXISTING USER
    let existingUser = null;

    if (email) {
      existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
    }

    if (!existingUser && phone) {
      existingUser = await db.query.users.findFirst({
        where: eq(users.phone, phone),
      });
    }

    // CHECK EXISTING AGENT RELATIONSHIP
    if (existingUser) {
      const agent = await db.query.agents.findFirst({
        where: eq(agents.userId, existingUser.id),
      });

      if (agent) {
        const relationship = await db.query.landlordAgents.findFirst({
          where: and(
            eq(landlordAgents.landlordId, landlord.id),
            eq(landlordAgents.agentId, agent.id),
          ),
        });

        if (relationship?.status === "ACTIVE") {
          throw new AppError(
            "This agent is already connected to your account",
            409,
          );
        }
      }
    }

    // CHECK PENDING INVITATION
    const existingInvitation = await db.query.agentInvitations.findFirst({
      where: and(
        eq(agentInvitations.landlordId, landlord.id),
        eq(agentInvitations.status, "PENDING"),
        or(
          email ? eq(agentInvitations.email, email) : undefined,
          phone ? eq(agentInvitations.phone, phone) : undefined,
        ),
      ),
    });

    if (existingInvitation) {
      throw new AppError(
        "A pending invitation already exists for this agent",
        409,
      );
    }

    // GENERATE INVITATION TOKEN
    const token = generateToken();
    const tokenHash = hashToken(token);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // CREATE INVITATION
    const [invitation] = await db
      .insert(agentInvitations)
      .values({
        landlordId: landlord.id,
        email,
        phone,
        tokenHash,
        status: "PENDING",
        expiresAt,
      })
      .returning();

    if (!invitation) {
      throw new AppError("Failed to create agent invitation", 500);
    }

    if (email) {
      // Fetch the landlord's user details for the email personalization
      const landlordUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { firstName: true, lastName: true },
      });

      const landlordName = landlordUser
        ? `${landlordUser.firstName} ${landlordUser.lastName}`
        : "A TrueEstate Landlord";

      // send the agent invitation email using the emailService
      await emailService.sendAgentInvitation(email, landlordName, token);
    }
    return {
      invitation,
      token,
    };
  },

  // GET INVITATION BY TOKEN
  getInvitationByToken: async (token: string) => {
    const tokenHash = hashToken(token);

    const invitation = await db.query.agentInvitations.findFirst({
      where: eq(agentInvitations.tokenHash, tokenHash),
      with: {
        landlord: {
          with: {
            user: {
              columns: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!invitation) {
      throw new AppError("Invalid agent invitation token", 400);
    }

    if (invitation.status !== "PENDING") {
      throw new AppError("This agent invitation is no longer available", 400);
    }

    if (invitation.expiresAt <= new Date()) {
      await db
        .update(agentInvitations)
        .set({
          status: "EXPIRED",
          updatedAt: new Date(),
        })
        .where(eq(agentInvitations.id, invitation.id));

      throw new AppError("This agent invitation has expired", 400);
    }

    return invitation;
  },

  // GET MY INVITATIONS
  getMyInvitations: async (userId: string) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.role !== "AGENT") {
      throw new AppError("Only agents can view agent invitations", 403);
    }

    const conditions = [];

    if (user.email) {
      conditions.push(eq(agentInvitations.email, user.email));
    }

    if (user.phone) {
      conditions.push(eq(agentInvitations.phone, user.phone));
    }

    if (conditions.length === 0) {
      return [];
    }

    const invitations = await db.query.agentInvitations.findMany({
      where: or(...conditions),
      with: {
        landlord: {
          with: {
            user: {
              columns: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: (agentInvitations, { desc }) => desc(agentInvitations.createdAt),
    });

    return invitations;
  },

  // ACCEPT AGENT INVITATION
  acceptInvitation: async (userId: string, invitationId: string) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.role !== "AGENT") {
      throw new AppError("Only agents can accept agent invitations", 403);
    }

    const agent = await db.query.agents.findFirst({
      where: eq(agents.userId, userId),
    });

    if (!agent) {
      throw new AppError("Agent profile not found", 404);
    }

    const invitation = await db.query.agentInvitations.findFirst({
      where: eq(agentInvitations.id, invitationId),
    });

    if (!invitation) {
      throw new AppError("Agent invitation not found", 404);
    }

    if (invitation.status !== "PENDING") {
      throw new AppError("This agent invitation is no longer available", 400);
    }

    if (invitation.expiresAt <= new Date()) {
      await db
        .update(agentInvitations)
        .set({
          status: "EXPIRED",
          updatedAt: new Date(),
        })
        .where(eq(agentInvitations.id, invitation.id));

      throw new AppError("This agent invitation has expired", 400);
    }

    // VERIFY INVITATION RECIPIENT
    const emailMatches =
      invitation.email &&
      user.email &&
      invitation.email.toLowerCase() === user.email.toLowerCase();

    const phoneMatches =
      invitation.phone && user.phone && invitation.phone === user.phone;

    if (!emailMatches && !phoneMatches) {
      throw new AppError(
        "This invitation does not belong to your account",
        403,
      );
    }

    // ACCEPT INVITATION AND CREATE RELATIONSHIP
    await db.transaction(async (transaction) => {
      const [acceptedInvitation] = await transaction
        .update(agentInvitations)
        .set({
          status: "ACCEPTED",
          acceptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(agentInvitations.id, invitation.id),
            eq(agentInvitations.status, "PENDING"),
          ),
        )
        .returning();

      if (!acceptedInvitation) {
        throw new AppError("Agent invitation is no longer available", 409);
      }

      const existingRelationship =
        await transaction.query.landlordAgents.findFirst({
          where: and(
            eq(landlordAgents.landlordId, invitation.landlordId),
            eq(landlordAgents.agentId, agent.id),
          ),
        });

      if (existingRelationship) {
        if (existingRelationship.status === "ACTIVE") {
          throw new AppError(
            "A landlord-agent relationship already exists",
            409,
          );
        }

        // Keep the unique relationship row so its assignment and audit history survive reactivation.
        const [reactivatedRelationship] = await transaction
          .update(landlordAgents)
          .set({
            status: "ACTIVE",
            acceptedAt: new Date(),
            revokedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(landlordAgents.id, existingRelationship.id))
          .returning();

        if (!reactivatedRelationship) {
          throw new AppError(
            "Failed to reactivate landlord-agent relationship",
            500,
          );
        }

        return;
      }

      const [relationship] = await transaction
        .insert(landlordAgents)
        .values({
          landlordId: invitation.landlordId,
          agentId: agent.id,
          status: "ACTIVE",
          acceptedAt: new Date(),
        })
        .returning();

      if (!relationship) {
        throw new AppError("Failed to create landlord-agent relationship", 500);
      }
    });

    return {
      message: "Agent invitation accepted successfully",
    };
  },

  // DECLINE AGENT INVITATION
  declineInvitation: async (userId: string, invitationId: string) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.role !== "AGENT") {
      throw new AppError("Only agents can decline agent invitations", 403);
    }

    const invitation = await db.query.agentInvitations.findFirst({
      where: eq(agentInvitations.id, invitationId),
    });

    if (!invitation) {
      throw new AppError("Agent invitation not found", 404);
    }

    if (invitation.status !== "PENDING") {
      throw new AppError("This agent invitation is no longer available", 400);
    }

    // VERIFY INVITATION RECIPIENT
    const emailMatches =
      invitation.email &&
      user.email &&
      invitation.email.toLowerCase() === user.email.toLowerCase();

    const phoneMatches =
      invitation.phone && user.phone && invitation.phone === user.phone;

    if (!emailMatches && !phoneMatches) {
      throw new AppError(
        "This invitation does not belong to your account",
        403,
      );
    }

    // DECLINE INVITATION
    const [declinedInvitation] = await db
      .update(agentInvitations)
      .set({
        status: "DECLINED",
        declinedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agentInvitations.id, invitation.id),
          eq(agentInvitations.status, "PENDING"),
        ),
      )
      .returning();

    if (!declinedInvitation) {
      throw new AppError("Agent invitation is no longer available", 409);
    }

    return {
      message: "Agent invitation declined successfully",
    };
  },

  // CANCEL AGENT INVITATION
  cancelInvitation: async (userId: string, invitationId: string) => {
    const landlord = await db.query.landlords.findFirst({
      where: eq(landlords.userId, userId),
    });

    if (!landlord) {
      throw new AppError("Landlord profile not found", 404);
    }

    const invitation = await db.query.agentInvitations.findFirst({
      where: eq(agentInvitations.id, invitationId),
    });

    if (!invitation) {
      throw new AppError("Agent invitation not found", 404);
    }

    if (invitation.landlordId !== landlord.id) {
      throw new AppError(
        "You are not authorized to cancel this invitation",
        403,
      );
    }

    if (invitation.status !== "PENDING") {
      throw new AppError("This agent invitation is no longer available", 400);
    }

    // CANCEL INVITATION
    const [cancelledInvitation] = await db
      .update(agentInvitations)
      .set({
        status: "CANCELLED",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agentInvitations.id, invitation.id),
          eq(agentInvitations.status, "PENDING"),
        ),
      )
      .returning();

    if (!cancelledInvitation) {
      throw new AppError("Agent invitation is no longer available", 409);
    }

    return {
      message: "Agent invitation cancelled successfully",
    };
  },
};
