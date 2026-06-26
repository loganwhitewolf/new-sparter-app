-- Backfill format config from platform into existing import_format_version rows
-- before making the columns NOT NULL. Rows created before 0021 added these
-- columns will have NULL; this copies the canonical values from the parent platform.
UPDATE "import_format_version" ifv
SET
  "delimiter"                = p."delimiter",
  "description_column"       = p."description_column",
  "amount_type"              = p."amount_type",
  "amount_column"            = p."amount_column",
  "positive_amount_column"   = p."positive_amount_column",
  "negative_amount_column"   = p."negative_amount_column",
  "timestamp_column"         = p."timestamp_column",
  "date_format"              = p."date_format",
  "date_replace"             = COALESCE(p."date_replace", false),
  "decimal_replace"          = COALESCE(p."decimal_replace", false),
  "multiply_by"              = COALESCE(p."multiply_by", 1),
  "description_strip_pattern"= p."description_strip_pattern"
FROM "platform" p
WHERE ifv."platform_id" = p."id";
--> statement-breakpoint
ALTER TABLE "import_format_version" ALTER COLUMN "delimiter" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "import_format_version" ALTER COLUMN "description_column" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "import_format_version" ALTER COLUMN "amount_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "import_format_version" ALTER COLUMN "timestamp_column" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "import_format_version" ALTER COLUMN "date_replace" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "import_format_version" ALTER COLUMN "date_replace" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "import_format_version" ALTER COLUMN "decimal_replace" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "import_format_version" ALTER COLUMN "decimal_replace" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "import_format_version" ALTER COLUMN "multiply_by" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "import_format_version" ALTER COLUMN "multiply_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "platform" DROP COLUMN "delimiter";--> statement-breakpoint
ALTER TABLE "platform" DROP COLUMN "description_column";--> statement-breakpoint
ALTER TABLE "platform" DROP COLUMN "amount_type";--> statement-breakpoint
ALTER TABLE "platform" DROP COLUMN "amount_column";--> statement-breakpoint
ALTER TABLE "platform" DROP COLUMN "positive_amount_column";--> statement-breakpoint
ALTER TABLE "platform" DROP COLUMN "negative_amount_column";--> statement-breakpoint
ALTER TABLE "platform" DROP COLUMN "timestamp_column";--> statement-breakpoint
ALTER TABLE "platform" DROP COLUMN "date_format";--> statement-breakpoint
ALTER TABLE "platform" DROP COLUMN "date_replace";--> statement-breakpoint
ALTER TABLE "platform" DROP COLUMN "decimal_replace";--> statement-breakpoint
ALTER TABLE "platform" DROP COLUMN "multiply_by";--> statement-breakpoint
ALTER TABLE "platform" DROP COLUMN "description_strip_pattern";