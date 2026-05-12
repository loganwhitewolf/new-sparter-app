CREATE TABLE "user_subcategory_override" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"sub_category_id" integer NOT NULL,
	"custom_name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_subcategory_override_user_subcategory_unique" UNIQUE("user_id","sub_category_id")
);
--> statement-breakpoint
ALTER TABLE "category" DROP CONSTRAINT "category_slug_unique";--> statement-breakpoint
ALTER TABLE "sub_category" DROP CONSTRAINT "sub_category_category_slug_unique";--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "sub_category" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "user_subcategory_override" ADD CONSTRAINT "user_subcategory_override_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subcategory_override" ADD CONSTRAINT "user_subcategory_override_sub_category_id_sub_category_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "public"."sub_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_category" ADD CONSTRAINT "sub_category_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_subcategory_override_userId_idx" ON "user_subcategory_override" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_subcategory_override_subCategoryId_idx" ON "user_subcategory_override" USING btree ("sub_category_id");--> statement-breakpoint
CREATE INDEX "category_userId_idx" ON "category" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "category_system_slug_unique" ON "category" USING btree ("slug") WHERE "category"."user_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "category_user_slug_unique" ON "category" USING btree ("user_id","slug") WHERE "category"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "sub_category_userId_idx" ON "sub_category" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sub_category_system_category_slug_unique" ON "sub_category" USING btree ("category_id","slug") WHERE "sub_category"."user_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sub_category_user_category_slug_unique" ON "sub_category" USING btree ("user_id","category_id","slug") WHERE "sub_category"."user_id" IS NOT NULL;