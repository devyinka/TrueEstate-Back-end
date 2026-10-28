import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";

import { db } from "../db/index.js";
import {
  landlords,
  properties,
  tenantInvitations,
  users,
  tenants,
  tenancies,
  units,
} from "../db/schema.js";
import { AppError } from "../errors/appError.js";
import type {
  AcceptTenantInvitationInput,
  CreateTenantInvitationInput,
} from "../types/tenantInvitation.type.js";
import { generateToken, hashToken } from "../lib/crypo.js";

function calculateInvitationExpiry(): Date {
  const expiresAt = new Date();

  expiresAt.setDate(expiresAt.getDate() + 7);

  return expiresAt;
}

export const tenantInvitationService = {
  createInvitation: async (
    userId: string,
    input: CreateTenantInvitationInput,
  ) => {
    const email = input.email?.trim().toLowerCase() ?? null;
    const phone = input.phone?.trim() ?? null;

    if (!email && !phone) {
      throw new AppError("Email or phone is required", 400);
    }

    if (
      input.unitId &&
      (!input.startDate || !input.rentAmount || !input.rentFrequency)
    ) {
      throw new AppError(
        "Unit, start date, rent amount, and rent frequency are required together",
        400,
      );
    }

    const landlord = await db.query.landlords.findFirst({
      where: eq(landlords.userId, userId),
    });

    if (!landlord) {
      throw new AppError("Landlord profile not found", 404);
    }

    if (input.unitId) {
      const unit = await db
        .select({ id: units.id })
        .from(units)
        .innerJoin(properties, eq(units.propertyId, properties.id))
        .where(
          and(eq(units.id, input.unitId), eq(properties.landlordId, landlord.id)),
        )
        .limit(1);

      if (!unit[0]) {
        throw new AppError("Unit not found or not owned by this landlord", 404);
      }
    }

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

    if (existingUser && existingUser.role !== "TENANT") {
      throw new AppError("This account cannot be invited as a tenant", 409);
    }

    const existingInvitation = await db.query.tenantInvitations.findFirst({
      where: and(
        eq(tenantInvitations.landlordId, landlord.id),
        email
          ? eq(tenantInvitations.email, email)
          : eq(tenantInvitations.phone, phone!),
        eq(tenantInvitations.status, "PENDING"),
      ),
    });

    if (existingInvitation) {
      if (existingInvitation.expiresAt > new Date()) {
        throw new AppError(
          "A pending invitation already exists for this tenant",
          409,
        );
      }

      await db
        .update(tenantInvitations)
        .set({
          status: "EXPIRED",
          updatedAt: new Date(),
        })
        .where(eq(tenantInvitations.id, existingInvitation.id));
    }

    const token = generateToken();
    const tokenHash = hashToken(token as string);

    const [invitation] = await db
      .insert(tenantInvitations)
      .values({
        landlordId: landlord.id,
        email,
        phone,
        unitId: input.unitId ?? null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        rentAmount: input.rentAmount ?? null,
        rentFrequency: input.rentFrequency ?? null,
        depositAmount: input.depositAmount ?? null,
        serviceCharge: input.serviceCharge ?? null,
        tokenHash,
        status: "PENDING",
        expiresAt: calculateInvitationExpiry(),
      })
      .returning();

    if (!invitation) {
      throw new AppError("Failed to create tenant invitation", 500);
    }

    return {
      invitation,
      token,
    };
  },

  getInvitationByToken: async (token: string) => {
    const tokenHash = hashToken(token);

    const invitation = await db.query.tenantInvitations.findFirst({
      where: eq(tenantInvitations.tokenHash, tokenHash),
    });

    if (!invitation) {
      throw new AppError("Invalid tenant invitation", 404);
    }

    if (invitation.status === "CANCELLED") {
      throw new AppError("This invitation has been cancelled", 400);
    }

    if (invitation.status === "ACCEPTED") {
      throw new AppError("This invitation has already been accepted", 400);
    }

    if (invitation.expiresAt <= new Date()) {
      await db
        .update(tenantInvitations)
        .set({
          status: "EXPIRED",
          updatedAt: new Date(),
        })
        .where(eq(tenantInvitations.id, invitation.id));

      throw new AppError("This invitation has expired", 400);
    }

    return invitation;
  },

  acceptInvitation: async (
    userId: string,
    input: AcceptTenantInvitationInput,
  ) => {
    const invitation = await tenantInvitationService.getInvitationByToken(
      input.token,
    );

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (user.role !== "TENANT") {
      throw new AppError(
        "Only tenant accounts can accept tenant invitations",
        403,
      );
    }

    if (invitation.email && user.email !== invitation.email) {
      throw new AppError("This invitation was not sent to this account", 403);
    }

    if (invitation.phone && user.phone !== invitation.phone) {
      throw new AppError("This invitation was not sent to this account", 403);
    }

    // Profile creation and invitation consumption must succeed or fail together.
    const result = await db.transaction(async (transaction) => {
      let tenant = await transaction.query.tenants.findFirst({
        where: eq(tenants.userId, user.id),
      });

      if (!tenant) {
        const [createdTenant] = await transaction
          .insert(tenants)
          .values({
            userId: user.id,
          })
          .returning();

        if (!createdTenant) {
          throw new AppError("Failed to create tenant profile", 500);
        }

        tenant = createdTenant;
      }

      const [acceptedInvitation] = await transaction
        .update(tenantInvitations)
        .set({
          status: "ACCEPTED",
          acceptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          // The status predicate makes invitation acceptance single-use under concurrency.
          and(
            eq(tenantInvitations.id, invitation.id),
            eq(tenantInvitations.status, "PENDING"),
          ),
        )
        .returning();

      if (!acceptedInvitation) {
        throw new AppError("Invitation is no longer available", 409);
      }

      if (
        acceptedInvitation.unitId &&
        acceptedInvitation.startDate &&
        acceptedInvitation.rentAmount &&
        acceptedInvitation.rentFrequency
      ) {
        const [createdTenancy] = await transaction
          .insert(tenancies)
          .values({
            tenantId: tenant.id,
            unitId: acceptedInvitation.unitId,
            startDate: acceptedInvitation.startDate,
            endDate: acceptedInvitation.endDate,
            status: "PENDING",
            rentAmount: acceptedInvitation.rentAmount,
            rentFrequency: acceptedInvitation.rentFrequency,
            depositAmount: acceptedInvitation.depositAmount ?? "0",
            serviceCharge: acceptedInvitation.serviceCharge ?? "0",
          })
          .returning();

        if (!createdTenancy) {
          throw new AppError("Failed to create tenancy", 500);
        }
      }

      return {
        tenant,
        invitation: acceptedInvitation,
      };
    });

    return result;
  },

  cancelInvitation: async (userId: string, invitationId: string) => {
    const landlord = await db.query.landlords.findFirst({
      where: eq(landlords.userId, userId),
    });

    if (!landlord) {
      throw new AppError("Landlord profile not found", 404);
    }

    const [invitation] = await db
      .update(tenantInvitations)
      .set({
        status: "CANCELLED",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tenantInvitations.id, invitationId),
          eq(tenantInvitations.landlordId, landlord.id),
          eq(tenantInvitations.status, "PENDING"),
        ),
      )
      .returning();

    if (!invitation) {
      throw new AppError("Pending tenant invitation not found", 404);
    }

    return invitation;
  },

  getMyInvitations: async (userId: string) => {
    const landlord = await db.query.landlords.findFirst({
      where: eq(landlords.userId, userId),
    });

    if (!landlord) {
      throw new AppError("Landlord profile not found", 404);
    }

    return db.query.tenantInvitations.findMany({
      where: eq(tenantInvitations.landlordId, landlord.id),
      orderBy: (tenantInvitations, { desc }) => [
        desc(tenantInvitations.createdAt),
      ],
    });
  },
};
