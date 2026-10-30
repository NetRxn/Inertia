CREATE TABLE "member_app"."integration_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"config" jsonb NOT NULL,
	"secret" text,
	"updated_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_app"."integration_settings" ADD CONSTRAINT "integration_settings_updated_by_members_id_fk" FOREIGN KEY ("updated_by") REFERENCES "member_app"."members"("id") ON DELETE no action ON UPDATE no action;