CREATE TYPE "public"."flow_nature" AS ENUM('essential', 'discretionary', 'operational', 'financial', 'debt', 'extraordinary');--> statement-breakpoint
ALTER TABLE "user_subcategory_override" ALTER COLUMN "custom_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sub_category" ADD COLUMN "nature" "flow_nature";--> statement-breakpoint
ALTER TABLE "user_subcategory_override" ADD COLUMN "nature" "flow_nature";
