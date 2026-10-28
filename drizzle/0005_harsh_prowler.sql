ALTER TABLE "tenant_invitations" ADD COLUMN "unit_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD COLUMN "start_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD COLUMN "end_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD COLUMN "rent_amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD COLUMN "rent_frequency" "rent_frequency";--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD COLUMN "deposit_amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD COLUMN "service_charge" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE cascade;