-- Phase 48: v2.0 direction/nature schema migration
-- Bridges snapshot 0017 (dual-axis model) to the locked v2.0 nature→direction model.
-- Manually reviewed/patched per D-07 for dependency-safe drop ordering and MIG-03 collision guard.
-- NO INSERT statements for direction/nature rows: lookup data is seed-owned (D-05).
-- NO down-migration: column/enum drops are destructive; rollback = pg_dump restore (D-13).

-- 1. Create direction lookup table (4 rows inserted by yarn db:seed, not here)
CREATE TABLE "direction" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(24) NOT NULL,
	"label_it" varchar(100) NOT NULL,
	"net_worth_effect" varchar(16) NOT NULL,
	"included_in_totals" boolean DEFAULT false NOT NULL,
	"shown_separately" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"color" varchar(16),
	CONSTRAINT "direction_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE INDEX "direction_code_idx" ON "direction" USING btree ("code");
--> statement-breakpoint

-- 2. Create nature lookup table (8 rows inserted by yarn db:seed, not here)
-- direction_id NOT NULL FK with onDelete restrict (D-01: direction is mandatory for nature)
CREATE TABLE "nature" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"direction_id" integer NOT NULL,
	"label_it" varchar(100) NOT NULL,
	"color" varchar(16),
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "nature_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE INDEX "nature_directionId_idx" ON "nature" USING btree ("direction_id");
--> statement-breakpoint
ALTER TABLE "nature" ADD CONSTRAINT "nature_direction_id_direction_id_fk" FOREIGN KEY ("direction_id") REFERENCES "public"."direction"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint

-- 3. Add nature_id FK columns on sub_category and user_subcategory_override
-- Both nullable (SET NULL on delete); system subcategories populated by yarn db:seed-extras v2-backfill-nature-id
ALTER TABLE "sub_category" ADD COLUMN "nature_id" integer;
--> statement-breakpoint
CREATE INDEX "sub_category_natureId_idx" ON "sub_category" USING btree ("nature_id");
--> statement-breakpoint
ALTER TABLE "sub_category" ADD CONSTRAINT "sub_category_nature_id_nature_id_fk" FOREIGN KEY ("nature_id") REFERENCES "public"."nature"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_subcategory_override" ADD COLUMN "nature_id" integer;
--> statement-breakpoint
CREATE INDEX "user_subcategory_override_natureId_idx" ON "user_subcategory_override" USING btree ("nature_id");
--> statement-breakpoint
ALTER TABLE "user_subcategory_override" ADD CONSTRAINT "user_subcategory_override_nature_id_nature_id_fk" FOREIGN KEY ("nature_id") REFERENCES "public"."nature"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- 4. Drop deprecated columns and indexes — MUST precede DROP TYPE statements
-- 4a. Drop category_type_idx before dropping category.type column
DROP INDEX "public"."category_type_idx";
--> statement-breakpoint

-- 4b. Drop category.type column (backed by category_type enum)
ALTER TABLE "category" DROP COLUMN "type";
--> statement-breakpoint

-- 4c. Drop sub_category.nature column (backed by flow_nature enum)
ALTER TABLE "sub_category" DROP COLUMN "nature";
--> statement-breakpoint

-- 4d. Drop user_subcategory_override.nature column (backed by flow_nature enum)
ALTER TABLE "user_subcategory_override" DROP COLUMN "nature";
--> statement-breakpoint

-- 4e. Drop categorization_pattern.amount_sign column and swap the unique constraint
-- First: drop the old 3-column unique constraint (pattern, sub_category_id, amount_sign)
ALTER TABLE "categorization_pattern" DROP CONSTRAINT "categorization_pattern_unique";
--> statement-breakpoint

-- MIG-03 / D-07: collision-safe pre-dedup before re-adding the 2-column unique constraint.
-- Dropping amount_sign can produce duplicate (pattern, sub_category_id) pairs that previously
-- differed only by sign. Delete duplicates keeping the lowest id per (pattern, sub_category_id)
-- so the ADD CONSTRAINT below cannot fail on pre-existing sign-only duplicate rows.
DELETE FROM "categorization_pattern"
WHERE "id" NOT IN (
  SELECT MIN("id")
  FROM "categorization_pattern"
  GROUP BY "pattern", "sub_category_id"
);
--> statement-breakpoint

-- Now safe to drop the amount_sign column
ALTER TABLE "categorization_pattern" DROP COLUMN "amount_sign";
--> statement-breakpoint

-- Re-add the unique constraint as sign-agnostic (pattern, sub_category_id) only
ALTER TABLE "categorization_pattern" ADD CONSTRAINT "categorization_pattern_unique" UNIQUE("pattern","sub_category_id");
--> statement-breakpoint

-- 5. Drop deprecated enum types — MUST follow column drops above
-- Columns backed by these types have been dropped in step 4; safe to drop now.
DROP TYPE "public"."flow_nature";
--> statement-breakpoint
DROP TYPE "public"."category_type";
--> statement-breakpoint
DROP TYPE "public"."amount_sign";
