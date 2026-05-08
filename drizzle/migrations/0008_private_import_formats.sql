CREATE SEQUENCE IF NOT EXISTS "platform_id_seq" OWNED BY "platform"."id";--> statement-breakpoint
SELECT setval('"platform_id_seq"', COALESCE((SELECT MAX("id") FROM "platform"), 0) + 1, false);--> statement-breakpoint
ALTER TABLE "platform" ALTER COLUMN "id" SET DEFAULT nextval('"platform_id_seq"');--> statement-breakpoint
ALTER TABLE "platform" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "platform" ADD COLUMN "visibility" varchar(24) DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform" ADD COLUMN "review_status" varchar(24) DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "import_format_version" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "import_format_version" ADD COLUMN "visibility" varchar(24) DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE "import_format_version" ADD COLUMN "review_status" varchar(24) DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform" ADD CONSTRAINT "platform_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_format_version" ADD CONSTRAINT "import_format_version_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_ownerUserId_idx" ON "platform" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "platform_visibility_reviewStatus_idx" ON "platform" USING btree ("visibility", "review_status");--> statement-breakpoint
CREATE INDEX "import_format_version_ownerUserId_idx" ON "import_format_version" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "import_format_version_visibility_reviewStatus_idx" ON "import_format_version" USING btree ("visibility", "review_status");
