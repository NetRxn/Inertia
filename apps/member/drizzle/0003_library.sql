CREATE TABLE "member_app"."library_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"file_id" uuid,
	"link_url" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"added_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "library_documents_file_or_link" CHECK (("member_app"."library_documents"."file_id" is null) <> ("member_app"."library_documents"."link_url" is null))
);
--> statement-breakpoint
ALTER TABLE "member_app"."organization" ADD COLUMN "library_editors" text DEFAULT 'admins' NOT NULL;--> statement-breakpoint
ALTER TABLE "member_app"."library_documents" ADD CONSTRAINT "library_documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "member_app"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_app"."library_documents" ADD CONSTRAINT "library_documents_added_by_members_id_fk" FOREIGN KEY ("added_by") REFERENCES "member_app"."members"("id") ON DELETE no action ON UPDATE no action;