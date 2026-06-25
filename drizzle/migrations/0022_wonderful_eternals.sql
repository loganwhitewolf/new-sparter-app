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