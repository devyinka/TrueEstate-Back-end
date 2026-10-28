import { Router } from "express";
import { z } from "zod";

import { agentInvitationController } from "../controllers/agentInvitation.controller.js";

import { requireRole } from "../auth/auth.MiddleWare.js";
const agentInvitationRoute = Router();

export const agentInvitationSchema = z
  .object({
    email: z.string().trim().email().toLowerCase().optional(),
    phone: z.string().trim().optional(),
  })
  .strict()
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Email or phone is required",
  });

// CREATE AGENT INVITATION
agentInvitationRoute.post(
  "/CreateAgentInvitation",
  requireRole("LANDLORD"),
  agentInvitationController.createInvitation,
);

// GET MY INVITATIONS
agentInvitationRoute.get(
  "/getMyInvitations",
  requireRole("AGENT"),
  agentInvitationController.getMyInvitations,
);

// GET INVITATION BY TOKEN
agentInvitationRoute.get(
  "/getInvitationByToken/:token",
  agentInvitationController.getInvitationByToken,
);

// ACCEPT AGENT INVITATION
agentInvitationRoute.post(
  "/agentAcceptInvitation/:invitationId",
  requireRole("AGENT"),
  agentInvitationController.acceptInvitation,
);

// DECLINE AGENT INVITATION
agentInvitationRoute.post(
  "/agentDeclineInvitation/:invitationId",
  requireRole("AGENT"),
  agentInvitationController.declineInvitation,
);

// CANCEL AGENT INVITATION
agentInvitationRoute.post(
  "/landlordCancelInvitation/:invitationId/cancel",
  requireRole("LANDLORD"),
  agentInvitationController.cancelInvitation,
);

export default agentInvitationRoute;
