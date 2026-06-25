ALTER TABLE "import_format_version" ADD COLUMN "delimiter" varchar(4);--> statement-breakpoint
ALTER TABLE "import_format_version" ADD COLUMN "description_column" varchar(120);--> statement-breakpoint
ALTER TABLE "import_format_version" ADD COLUMN "amount_type" "amount_type";--> statement-breakpoint
ALTER TABLE "import_format_version" ADD COLUMN "amount_column" varchar(120);--> statement-breakpoint
ALTER TABLE "import_format_version" ADD COLUMN "positive_amount_column" varchar(120);--> statement-breakpoint
ALTER TABLE "import_format_version" ADD COLUMN "negative_amount_column" varchar(120);--> statement-breakpoint
ALTER TABLE "import_format_version" ADD COLUMN "timestamp_column" varchar(120);--> statement-breakpoint
ALTER TABLE "import_format_version" ADD COLUMN "date_format" varchar(60);--> statement-breakpoint
ALTER TABLE "import_format_version" ADD COLUMN "date_replace" boolean;--> statement-breakpoint
ALTER TABLE "import_format_version" ADD COLUMN "decimal_replace" boolean;--> statement-breakpoint
ALTER TABLE "import_format_version" ADD COLUMN "multiply_by" integer;--> statement-breakpoint
ALTER TABLE "import_format_version" ADD COLUMN "description_strip_pattern" text;