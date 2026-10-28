CREATE TYPE "public"."otp_status" AS ENUM('PENDING', 'USED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."otp_type" AS ENUM('ACCOUNT_VERIFICATION', 'PASSWORD_RESET');--> statement-breakpoint
CREATE TABLE "otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" varchar(6) NOT NULL,
	"type" "otp_type" DEFAULT 'ACCOUNT_VERIFICATION' NOT NULL,
	"status" "otp_status" DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "otps" ADD CONSTRAINT "otps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "otps_user_id_idx" ON "otps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "otps_code_idx" ON "otps" USING btree ("code");