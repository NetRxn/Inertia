CREATE TABLE "member_app"."org_passages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"location" text NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_app"."org_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"origin" text,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"summary" text,
	"added_by" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"hidden_reason" text,
	"hidden_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_sources_content_hash_unique" UNIQUE("content_hash")
);
--> statement-breakpoint
CREATE TABLE "member_app"."organization" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"description" text DEFAULT '' NOT NULL,
	"profile" jsonb,
	"profile_generated_at" timestamp,
	"governance_enabled" boolean DEFAULT false NOT NULL,
	"setup_completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_singleton" CHECK ("member_app"."organization"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "member_app"."work_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid,
	"task_id" text NOT NULL,
	"kind" text NOT NULL,
	"detail" text,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_app"."members" ADD COLUMN "role" text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "member_app"."members" ADD COLUMN "origin" text DEFAULT 'directory' NOT NULL;--> statement-breakpoint
ALTER TABLE "member_app"."members" ADD COLUMN "work_user_id" text;--> statement-breakpoint
ALTER TABLE "member_app"."org_passages" ADD CONSTRAINT "org_passages_source_id_org_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "member_app"."org_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_app"."org_sources" ADD CONSTRAINT "org_sources_added_by_members_id_fk" FOREIGN KEY ("added_by") REFERENCES "member_app"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_app"."org_sources" ADD CONSTRAINT "org_sources_hidden_by_members_id_fk" FOREIGN KEY ("hidden_by") REFERENCES "member_app"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_app"."work_events" ADD CONSTRAINT "work_events_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "member_app"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_passages_search" ON "member_app"."org_passages" USING gin (to_tsvector('english', "text"));