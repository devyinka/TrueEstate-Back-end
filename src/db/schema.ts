import { relations, sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  index,
} from "drizzle-orm/pg-core";

/* =========================================================
   ENUMS
========================================================= */

export const userRoleEnum = pgEnum("user_role", [
  "LANDLORD",
  "AGENT",
  "TENANT",
  "TECHNICIAN",
]);

export const userStatusEnum = pgEnum("user_status", [
  "ACTIVE",
  "INVITED",
  "SUSPENDED",
  "DEACTIVATED",
  "PENDING",
]);

export const unitTypeEnum = pgEnum("unit_type", [
  "FLAT",
  "APARTMENT",
  "DUPLEX",
  "ROOM",
  "SHOP",
  "OFFICE",
  "OTHER",
]);

export const rentFrequencyEnum = pgEnum("rent_frequency", [
  "MONTHLY",
  "QUARTERLY",
  "BI_ANNUAL",
  "ANNUAL",
  "CUSTOM",
]);

export const tenancyStatusEnum = pgEnum("tenancy_status", [
  "PENDING",
  "ACTIVE",
  "ENDED",
  "TERMINATED",
  "CANCELLED",
]);

export const authSessionStatusEnum = pgEnum("auth_session_status", [
  "ACTIVE",
  "REVOKED",
  "EXPIRED",
]);

export const tenantInvitationStatusEnum = pgEnum("tenant_invitation_status", [
  "PENDING",
  "ACCEPTED",
  "EXPIRED",
  "CANCELLED",
]);

export const otpTypeEnum = pgEnum("otp_type", [
  "ACCOUNT_VERIFICATION",
  "PASSWORD_RESET",
]);

export const otpStatusEnum = pgEnum("otp_status", [
  "PENDING",
  "USED",
  "EXPIRED",
]);

export const agentInvitationStatusEnum = pgEnum("agent_invitation_status", [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
]);

export const agentFeeTypeEnum = pgEnum("agent_fee_type", [
  "FIXED",
  "PERCENTAGE",
]);

export const agentCompensationTypeEnum = pgEnum("agent_compensation_type", [
  "FIXED",
  "PERCENTAGE",
]);

export const agentCompensationFrequencyEnum = pgEnum(
  "agent_compensation_frequency",
  ["ONE_TIME", "MONTHLY", "QUARTERLY", "BI_ANNUAL", "ANNUAL", "PER_COLLECTION"],
);

export const agentRelationshipStatusEnum = pgEnum("agent_relationship_status", [
  "ACTIVE",
  "REVOKED",
]);

export const agentPropertyStatusEnum = pgEnum("agent_property_status", [
  "ACTIVE",
  "REVOKED",
]);

export const agentPermissionEnum = pgEnum("agent_permission", [
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

export const workOrderStatusEnum = pgEnum("work_order_status", [
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

/* =========================================================
   USERS
========================================================= */

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    email: varchar("email", { length: 255 }),

    phone: varchar("phone", { length: 30 }),

    passwordHash: text("password_hash"),

    firstName: varchar("first_name", { length: 100 }).notNull(),

    lastName: varchar("last_name", { length: 100 }).notNull(),

    role: userRoleEnum("role").notNull(),

    status: userStatusEnum("status").notNull().default("ACTIVE"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    emailUnique: uniqueIndex("users_email_unique").on(table.email),

    phoneUnique: uniqueIndex("users_phone_unique").on(table.phone),

    emailOrPhoneRequired: check(
      "users_email_or_phone_required",
      sql`${table.email} IS NOT NULL OR ${table.phone} IS NOT NULL`,
    ),
  }),
);

/* =========================================================
   LANDLORDS
========================================================= */

export const landlords = pgTable(
  "landlords",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userUnique: uniqueIndex("landlords_user_unique").on(table.userId),
  }),
);

/* =========================================================
   AGENTS
========================================================= */

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userUnique: uniqueIndex("agents_user_unique").on(table.userId),
  }),
);

/* =========================================================
   TECHNICIANS
========================================================= */

export const technicians = pgTable(
  "technicians",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userUnique: uniqueIndex("technicians_user_unique").on(table.userId),
  }),
);

/* =========================================================
   LANDLORD AGENTS
========================================================= */

export const landlordAgents = pgTable(
  "landlord_agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    landlordId: uuid("landlord_id")
      .notNull()
      .references(() => landlords.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    status: agentRelationshipStatusEnum("status").notNull().default("ACTIVE"),

    acceptedAt: timestamp("accepted_at", {
      withTimezone: true,
    }),

    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    landlordAgentUnique: uniqueIndex(
      "landlord_agents_landlord_agent_unique",
    ).on(table.landlordId, table.agentId),

    landlordIndex: index("landlord_agents_landlord_id_idx").on(
      table.landlordId,
    ),

    agentIndex: index("landlord_agents_agent_id_idx").on(table.agentId),

    statusIndex: index("landlord_agents_status_idx").on(table.status),
  }),
);

/* =========================================================
   PROPERTIES
========================================================= */

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    landlordId: uuid("landlord_id")
      .notNull()
      .references(() => landlords.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    name: varchar("name", { length: 150 }).notNull(),

    address: text("address").notNull(),

    city: varchar("city", { length: 100 }).notNull(),

    state: varchar("state", { length: 100 }).notNull(),

    country: varchar("country", { length: 100 }).notNull().default("Nigeria"),

    description: text("description"),

    imageUrl: text("image_url"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    nameNotEmpty: check(
      "properties_name_not_empty",
      sql`length(trim(${table.name})) > 0`,
    ),
  }),
);

/* =========================================================
   AGENT PROPERTIES
========================================================= */

export const agentProperties = pgTable(
  "agent_properties",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    landlordAgentId: uuid("landlord_agent_id")
      .notNull()
      .references(() => landlordAgents.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    status: agentPropertyStatusEnum("status").notNull().default("ACTIVE"),

    /*
     * Default agent fee configuration for this
     * agent's assignment to this property.
     */
    lettingFeeType: agentFeeTypeEnum("letting_fee_type"),

    lettingFeeValue: numeric("letting_fee_value", {
      precision: 14,
      scale: 2,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    landlordAgentPropertyUnique: uniqueIndex(
      "agent_properties_landlord_agent_property_unique",
    )
      .on(table.landlordAgentId, table.propertyId)
      .where(sql`${table.status} = 'ACTIVE'`),

    landlordAgentIndex: index("agent_properties_landlord_agent_id_idx").on(
      table.landlordAgentId,
    ),

    propertyIndex: index("agent_properties_property_id_idx").on(
      table.propertyId,
    ),

    validLettingFee: check(
      "agent_properties_letting_fee_non_negative",
      sql`${table.lettingFeeValue} IS NULL OR ${table.lettingFeeValue} >= 0`,
    ),
  }),
);

/* =========================================================
   AGENT PROPERTIES PERMISSIONS
========================================================= */

export const agentPropertyPermissions = pgTable(
  "agent_property_permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    agentPropertyId: uuid("agent_property_id")
      .notNull()
      .references(() => agentProperties.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    permission: agentPermissionEnum("permission").notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    agentPropertyPermissionUnique: uniqueIndex(
      "agent_property_permissions_unique",
    ).on(table.agentPropertyId, table.permission),

    agentPropertyIndex: index(
      "agent_property_permissions_agent_property_id_idx",
    ).on(table.agentPropertyId),
  }),
);
/** =========================================================
   AGENT COMPENSATION
========================================================= */

export const agentCompensations = pgTable(
  "agent_compensations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    agentPropertyId: uuid("agent_property_id")
      .notNull()
      .references(() => agentProperties.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    type: agentCompensationTypeEnum("type").notNull(),

    value: numeric("value", {
      precision: 14,
      scale: 2,
    }).notNull(),

    frequency: agentCompensationFrequencyEnum("frequency")
      .notNull()
      .default("MONTHLY"),

    effectiveFrom: timestamp("effective_from", {
      withTimezone: true,
    }).notNull(),

    effectiveTo: timestamp("effective_to", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    agentPropertyIndex: index("agent_compensations_agent_property_id_idx").on(
      table.agentPropertyId,
    ),

    validValue: check(
      "agent_compensations_value_non_negative",
      sql`${table.value} >= 0`,
    ),

    validDates: check(
      "agent_compensations_valid_dates",
      sql`${table.effectiveTo} IS NULL OR ${table.effectiveTo} >= ${table.effectiveFrom}`,
    ),
  }),
);

/* =========================================================
   UNITS
========================================================= */

export const units = pgTable(
  "units",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    unitNumber: varchar("unit_number", { length: 50 }).notNull(),

    unitType: unitTypeEnum("unit_type").notNull(),

    floor: integer("floor"),

    bedrooms: smallint("bedrooms").notNull().default(0),

    bathrooms: smallint("bathrooms").notNull().default(0),

    rentAmount: numeric("rent_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),

    rentFrequency: rentFrequencyEnum("rent_frequency").notNull(),

    serviceCharge: numeric("service_charge", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),

    depositAmount: numeric("deposit_amount", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),

    notes: text("notes"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    propertyUnitUnique: uniqueIndex("units_property_unit_unique").on(
      table.propertyId,
      table.unitNumber,
    ),

    unitNumberNotEmpty: check(
      "units_unit_number_not_empty",
      sql`length(trim(${table.unitNumber})) > 0`,
    ),

    validBedrooms: check(
      "units_bedrooms_non_negative",
      sql`${table.bedrooms} >= 0`,
    ),

    validBathrooms: check(
      "units_bathrooms_non_negative",
      sql`${table.bathrooms} >= 0`,
    ),

    validAmounts: check(
      "units_amounts_non_negative",
      sql`
        ${table.rentAmount} >= 0
        AND ${table.serviceCharge} >= 0
        AND ${table.depositAmount} >= 0
      `,
    ),
  }),
);

/* =========================================================
   TENANTS
========================================================= */

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userUnique: uniqueIndex("tenants_user_unique").on(table.userId),
  }),
);

/* =========================================================
   TENANTS INVITATIONS
========================================================= */

export const tenantInvitations = pgTable(
  "tenant_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    landlordId: uuid("landlord_id")
      .notNull()
      .references(() => landlords.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    email: varchar("email", { length: 255 }),

    phone: varchar("phone", { length: 30 }),

    unitId: uuid("unit_id").references(() => units.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),

    startDate: timestamp("start_date", {
      withTimezone: true,
    }),

    endDate: timestamp("end_date", {
      withTimezone: true,
    }),

    rentAmount: numeric("rent_amount", {
      precision: 14,
      scale: 2,
    }),

    rentFrequency: rentFrequencyEnum("rent_frequency"),

    depositAmount: numeric("deposit_amount", {
      precision: 14,
      scale: 2,
    }),

    serviceCharge: numeric("service_charge", {
      precision: 14,
      scale: 2,
    }),

    tokenHash: text("token_hash").notNull(),

    status: tenantInvitationStatusEnum("status").notNull().default("PENDING"),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    acceptedAt: timestamp("accepted_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("tenant_invitations_token_hash_unique").on(
      table.tokenHash,
    ),

    landlordIndex: index("tenant_invitations_landlord_id_idx").on(
      table.landlordId,
    ),

    statusIndex: index("tenant_invitations_status_idx").on(table.status),

    validRecipient: check(
      "tenant_invitations_email_or_phone_required",
      sql`
        ${table.email} IS NOT NULL
        OR ${table.phone} IS NOT NULL
      `,
    ),
  }),
);

/* =========================================================
AGENT INVITATION
========================================================= */

export const agentInvitations = pgTable(
  "agent_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    landlordId: uuid("landlord_id")
      .notNull()
      .references(() => landlords.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    email: varchar("email", { length: 255 }),

    phone: varchar("phone", { length: 30 }),

    tokenHash: text("token_hash").notNull(),

    status: agentInvitationStatusEnum("status").notNull().default("PENDING"),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    acceptedAt: timestamp("accepted_at", {
      withTimezone: true,
    }),

    declinedAt: timestamp("declined_at", {
      withTimezone: true,
    }),

    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("agent_invitations_token_hash_unique").on(
      table.tokenHash,
    ),

    landlordIndex: index("agent_invitations_landlord_id_idx").on(
      table.landlordId,
    ),

    statusIndex: index("agent_invitations_status_idx").on(table.status),

    emailIndex: index("agent_invitations_email_idx").on(table.email),

    phoneIndex: index("agent_invitations_phone_idx").on(table.phone),

    validRecipient: check(
      "agent_invitations_email_or_phone_required",
      sql`
        ${table.email} IS NOT NULL
        OR ${table.phone} IS NOT NULL
      `,
    ),
  }),
);

/* =========================================================
   TENANCIES
========================================================= */

export const tenancies = pgTable(
  "tenancies",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    startDate: timestamp("start_date", {
      withTimezone: true,
    }).notNull(),

    endDate: timestamp("end_date", {
      withTimezone: true,
    }),

    status: tenancyStatusEnum("status").notNull().default("PENDING"),

    rentAmount: numeric("rent_amount", {
      precision: 14,
      scale: 2,
    }).notNull(),

    rentFrequency: rentFrequencyEnum("rent_frequency").notNull(),

    depositAmount: numeric("deposit_amount", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),

    serviceCharge: numeric("service_charge", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),
    lettingFeeType: agentFeeTypeEnum("letting_fee_type"),

    lettingFeeAmount: numeric("letting_fee_amount", {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default("0"),

    moveOutReason: text("move_out_reason"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    /*
     * One unit can have only one ACTIVE tenancy.
     */
    oneActiveTenancyPerUnit: uniqueIndex("tenancies_one_active_per_unit")
      .on(table.unitId)
      .where(sql`${table.status} = 'ACTIVE'`),

    validDates: check(
      "tenancies_valid_dates",
      sql`
        ${table.endDate} IS NULL
        OR ${table.endDate} >= ${table.startDate}
      `,
    ),

    validAmounts: check(
      "tenancies_amounts_non_negative",
      sql`
    ${table.rentAmount} >= 0
    AND ${table.depositAmount} >= 0
    AND ${table.serviceCharge} >= 0
    AND ${table.lettingFeeAmount} >= 0
  `,
    ),
  }),
);

/* =========================================================
   WORK ORDERS
========================================================= */

export const workOrders = pgTable(
  "work_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    unitId: uuid("unit_id").references(() => units.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),

    technicianId: uuid("technician_id").references(() => technicians.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),

    title: varchar("title", { length: 150 }).notNull(),

    description: text("description"),

    status: workOrderStatusEnum("status").notNull().default("OPEN"),

    assignedAt: timestamp("assigned_at", {
      withTimezone: true,
    }),

    completedAt: timestamp("completed_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    propertyIndex: index("work_orders_property_id_idx").on(table.propertyId),

    technicianIndex: index("work_orders_technician_id_idx").on(
      table.technicianId,
    ),

    statusIndex: index("work_orders_status_idx").on(table.status),

    titleNotEmpty: check(
      "work_orders_title_not_empty",
      sql`length(trim(${table.title})) > 0`,
    ),
  }),
);

/* =========================================================
   OTPS (Verification Codes)
========================================================= */

export const otps = pgTable(
  "otps",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade", // If user is deleted, delete their OTPs
        onUpdate: "cascade",
      }),

    code: varchar("code", { length: 6 }).notNull(),

    type: otpTypeEnum("type").notNull().default("ACCOUNT_VERIFICATION"),

    status: otpStatusEnum("status").notNull().default("PENDING"),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIndex: index("otps_user_id_idx").on(table.userId),
    codeIndex: index("otps_code_idx").on(table.code),
  }),
);

/* =========================================================
   AUTH SESSIONS
========================================================= */

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    refreshTokenHash: text("refresh_token_hash").notNull(),

    status: authSessionStatusEnum("status").notNull().default("ACTIVE"),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    lastUsedAt: timestamp("last_used_at", {
      withTimezone: true,
    }),

    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIndex: index("auth_sessions_user_id_idx").on(table.userId),

    refreshTokenHashUnique: uniqueIndex(
      "auth_sessions_refresh_token_hash_unique",
    ).on(table.refreshTokenHash),
  }),
);

/* =========================================================
   AUDIT LOGS
========================================================= */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),

    action: varchar("action", { length: 100 }).notNull(),
    entity: varchar("entity", { length: 100 }).notNull(),
    entityId: uuid("entity_id"),
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values"),
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    actorIndex: index("audit_logs_actor_user_id_idx").on(table.actorUserId),
    entityIndex: index("audit_logs_entity_idx").on(
      table.entity,
      table.entityId,
    ),
    createdAtIndex: index("audit_logs_created_at_idx").on(table.createdAt),
  }),
);

/* =========================================================
   RELATIONS
========================================================= */

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, {
    fields: [authSessions.userId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  landlord: one(landlords),
  tenant: one(tenants),
  agent: one(agents),
  technician: one(technicians),
  authSessions: many(authSessions),
}));

export const landlordsRelations = relations(landlords, ({ one, many }) => ({
  user: one(users, {
    fields: [landlords.userId],
    references: [users.id],
  }),
  agentInvitations: many(agentInvitations),

  properties: many(properties),

  tenantInvitations: many(tenantInvitations),

  landlordAgents: many(landlordAgents),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  user: one(users, {
    fields: [agents.userId],
    references: [users.id],
  }),

  landlordAgents: many(landlordAgents),
}));

export const techniciansRelations = relations(technicians, ({ one, many }) => ({
  user: one(users, {
    fields: [technicians.userId],
    references: [users.id],
  }),

  workOrders: many(workOrders),
}));

export const landlordAgentsRelations = relations(
  landlordAgents,
  ({ one, many }) => ({
    landlord: one(landlords, {
      fields: [landlordAgents.landlordId],
      references: [landlords.id],
    }),

    agent: one(agents, {
      fields: [landlordAgents.agentId],
      references: [agents.id],
    }),

    properties: many(agentProperties),
  }),
);

export const agentInvitationRelations = relations(
  agentInvitations,
  ({ one }) => ({
    landlord: one(landlords, {
      fields: [agentInvitations.landlordId],
      references: [landlords.id],
    }),
  }),
);

export const agentPropertiesRelations = relations(
  agentProperties,
  ({ one, many }) => ({
    landlordAgent: one(landlordAgents, {
      fields: [agentProperties.landlordAgentId],
      references: [landlordAgents.id],
    }),

    property: one(properties, {
      fields: [agentProperties.propertyId],
      references: [properties.id],
    }),

    permissions: many(agentPropertyPermissions),

    compensations: many(agentCompensations),
  }),
);

export const agentPropertyPermissionsRelations = relations(
  agentPropertyPermissions,
  ({ one }) => ({
    agentProperty: one(agentProperties, {
      fields: [agentPropertyPermissions.agentPropertyId],
      references: [agentProperties.id],
    }),
  }),
);

export const agentCompensationsRelations = relations(
  agentCompensations,
  ({ one }) => ({
    agentProperty: one(agentProperties, {
      fields: [agentCompensations.agentPropertyId],
      references: [agentProperties.id],
    }),
  }),
);

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  landlord: one(landlords, {
    fields: [properties.landlordId],
    references: [landlords.id],
  }),

  units: many(units),

  agentProperties: many(agentProperties),

  workOrders: many(workOrders),
}));

export const unitsRelations = relations(units, ({ one, many }) => ({
  property: one(properties, {
    fields: [units.propertyId],
    references: [properties.id],
  }),

  tenancies: many(tenancies),

  workOrders: many(workOrders),
}));

export const workOrdersRelations = relations(workOrders, ({ one }) => ({
  property: one(properties, {
    fields: [workOrders.propertyId],
    references: [properties.id],
  }),

  unit: one(units, {
    fields: [workOrders.unitId],
    references: [units.id],
  }),

  technician: one(technicians, {
    fields: [workOrders.technicianId],
    references: [technicians.id],
  }),
}));

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  user: one(users, {
    fields: [tenants.userId],
    references: [users.id],
  }),

  tenancies: many(tenancies),
}));

export const tenanciesRelations = relations(tenancies, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenancies.tenantId],
    references: [tenants.id],
  }),

  unit: one(units, {
    fields: [tenancies.unitId],
    references: [units.id],
  }),
}));

export const tenantInvitationsRelations = relations(
  tenantInvitations,
  ({ one }) => ({
    landlord: one(landlords, {
      fields: [tenantInvitations.landlordId],
      references: [landlords.id],
    }),
  }),
);

/* =========================================================
   TYPES
========================================================= */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Landlord = typeof landlords.$inferSelect;
export type NewLandlord = typeof landlords.$inferInsert;

export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;

export type Unit = typeof units.$inferSelect;
export type NewUnit = typeof units.$inferInsert;

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type Tenancy = typeof tenancies.$inferSelect;
export type NewTenancy = typeof tenancies.$inferInsert;

export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type TenantInvitation = typeof tenantInvitations.$inferSelect;
export type NewTenantInvitation = typeof tenantInvitations.$inferInsert;

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

export type LandlordAgent = typeof landlordAgents.$inferSelect;
export type NewLandlordAgent = typeof landlordAgents.$inferInsert;

export type AgentProperty = typeof agentProperties.$inferSelect;
export type NewAgentProperty = typeof agentProperties.$inferInsert;

export type AgentPropertyPermission =
  typeof agentPropertyPermissions.$inferSelect;
export type NewAgentPropertyPermission =
  typeof agentPropertyPermissions.$inferInsert;

export type AgentCompensation = typeof agentCompensations.$inferSelect;
export type NewAgentCompensation = typeof agentCompensations.$inferInsert;

export type AgentInvitation = typeof agentInvitations.$inferSelect;
export type NewAgentInvitation = typeof agentInvitations.$inferInsert;

export type Technician = typeof technicians.$inferSelect;
export type NewTechnician = typeof technicians.$inferInsert;

export type WorkOrder = typeof workOrders.$inferSelect;
export type NewWorkOrder = typeof workOrders.$inferInsert;

export type Otp = typeof otps.$inferSelect;
export type NewOtp = typeof otps.$inferInsert;
