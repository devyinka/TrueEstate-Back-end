export type CreateTenantInvitationInput = {
  email?: string;
  phone?: string;
  unitId?: string;
  startDate?: string;
  endDate?: string;
  rentAmount?: string;
  rentFrequency?: "MONTHLY" | "QUARTERLY" | "BI_ANNUAL" | "ANNUAL" | "CUSTOM";
  depositAmount?: string;
  serviceCharge?: string;
};

export type AcceptTenantInvitationInput = {
  token: string;
};
