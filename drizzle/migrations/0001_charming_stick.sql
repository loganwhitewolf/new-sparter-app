CREATE TYPE "public"."category_type" AS ENUM('in', 'out', 'system');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('1', '2', '3', '4');--> statement-breakpoint
CREATE TABLE "category" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"type" "category_type" NOT NULL,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" varchar(120) NOT NULL,
	"description_hash" varchar(64),
	"sub_category_id" integer,
	"status" "expense_status" DEFAULT '1' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sub_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "sub_category_category_slug_unique" UNIQUE("category_id","slug")
);
--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_sub_category_id_sub_category_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "public"."sub_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_category" ADD CONSTRAINT "sub_category_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "category_slug_idx" ON "category" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "category_type_idx" ON "category" USING btree ("type");--> statement-breakpoint
CREATE INDEX "expense_userId_idx" ON "expense" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "expense_userId_status_idx" ON "expense" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "expense_userId_createdAt_idx" ON "expense" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "expense_subCategoryId_idx" ON "expense" USING btree ("sub_category_id");--> statement-breakpoint
CREATE INDEX "sub_category_categoryId_idx" ON "sub_category" USING btree ("category_id");