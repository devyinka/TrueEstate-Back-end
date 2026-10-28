import { Router } from "express";
import { z } from "zod";

import { requireRole } from "../auth/auth.MiddleWare.js";
import { landlordController } from "../controllers/landlord.controller.js";

const uuidSchema = z.string().uuid("Must be a valid UUID");

export const assignPropertySchema = z
  .object({ landlordAgentId: uuidSchema, propertyId: uuidSchema })
  .strict();

export const permissionListSchema = z.array(
  z.enum([
    "VIEW_PROPERTY",
    "MANAGE_PROPERTY",
    "VIEW_UNITS",
    "MANAGE_UNITS",
    "VIEW_TENANTS",
    "MANAGE_TENANTS",
    "VIEW_FINANCIALS",
    "COLLECT_RENT",
    "MANAGE_MAINTENANCE",
    "MANAGE_DOCUMENTS",
    "SEND_REMINDERS",
    "VIEW_REPORTS",
  ]),
);

export const permissionSchema = permissionListSchema.element;

export const permissionParamSchema = z.enum([
  "VIEW_PROPERTY",
  "MANAGE_PROPERTY",
  "VIEW_UNITS",
  "MANAGE_UNITS",
  "VIEW_TENANTS",
  "MANAGE_TENANTS",
  "VIEW_FINANCIALS",
  "COLLECT_RENT",
  "MANAGE_MAINTENANCE",
  "MANAGE_DOCUMENTS",
  "SEND_REMINDERS",
  "VIEW_REPORTS",
]);

export const agentIdParamSchema = z.string().uuid("Must be a valid agent ID");

const router = Router();

router.get(
  "/landlords/agents",
  requireRole("LANDLORD"),
  landlordController.getAgents,
);

router.get(
  "/landlords/agents/:agentId",
  requireRole("LANDLORD"),
  landlordController.getAgent,
);

// ASSIGN PROPERTY TO AGENT
router.post(
  "/assignproperties",
  requireRole("LANDLORD"),
  landlordController.assignProperty,
);

// GET AGENT PROPERTIES
router.get(
  "/:landlordAgentId/properties",
  requireRole("LANDLORD"),
  landlordController.getAgentProperties,
);

// REMOVE PROPERTY FROM AGENT
router.delete(
  "/properties/:agentPropertyId",
  requireRole("LANDLORD"),
  landlordController.removeProperty,
);

router.get(
  "/:agentPropertyId",
  requireRole("LANDLORD"),
  landlordController.getPermissions,
);

// SET ALL PERMISSIONS
router.put(
  "/:agentPropertyId",
  requireRole("LANDLORD"),
  landlordController.setPermissions,
);

// GRANT PERMISSION
router.post(
  "/:agentPropertyId",
  requireRole("LANDLORD"),
  landlordController.grantPermission,
);

// REVOKE PERMISSION
router.delete(
  "/:agentPropertyId/:permission",
  requireRole("LANDLORD"),
  landlordController.revokePermission,
);

export default router;
