CREATE TYPE "public"."amount_sign" AS ENUM('positive', 'negative', 'any');--> statement-breakpoint
CREATE TYPE "public"."amount_type" AS ENUM('single', 'separate');--> statement-breakpoint
CREATE TYPE "public"."classification_source" AS ENUM('system_pattern', 'user_pattern', 'manual', 'override', 'import_default');--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('pending_upload', 'uploaded', 'analyzing', 'analyzed', 'importing', 'imported', 'failed');--> statement-breakpoint
CREATE TABLE "categorization_pattern" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"pattern" text NOT NULL,
	"sub_category_id" integer NOT NULL,
	"amount_sign" "amount_sign" DEFAULT 'any' NOT NULL,
	"confidence" numeric(4, 2) DEFAULT '0.80' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categorization_pattern_unique" UNIQUE("pattern","sub_category_id","amount_sign")
);
--> statement-breakpoint
CREATE TABLE "expense_classification_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expense_id" text NOT NULL,
	"from_sub_category_id" integer,
	"to_sub_category_id" integer,
	"from_status" "expense_status",
	"to_status" "expense_status" NOT NULL,
	"source" "classification_source" NOT NULL,
	"pattern_id" integer,
	"confidence" numeric(4, 2),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"import_format_version_id" integer,
	"original_name" varchar(255) NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" varchar(120),
	"size_bytes" integer NOT NULL,
	"status" "file_status" DEFAULT 'pending_upload' NOT NULL,
	"uploaded_at" timestamp with time zone,
	"analyzed_at" timestamp with time zone,
	"import_started_at" timestamp with time zone,
	"imported_at" timestamp with time zone,
	"row_count" integer DEFAULT 0 NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_object_key_unique" UNIQUE("object_key")
);
--> statement-breakpoint
CREATE TABLE "import_format_version" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform_id" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"header_signature" text NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_format_version_platform_version_unique" UNIQUE("platform_id","version")
);
--> statement-breakpoint
CREATE TABLE "platform" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"country" varchar(2) NOT NULL,
	"delimiter" varchar(4) NOT NULL,
	"description_column" varchar(120) NOT NULL,
	"amount_type" "amount_type" NOT NULL,
	"amount_column" varchar(120),
	"positive_amount_column" varchar(120),
	"negative_amount_column" varchar(120),
	"timestamp_column" varchar(120) NOT NULL,
	"date_format" varchar(60),
	"date_replace" boolean DEFAULT false NOT NULL,
	"decimal_replace" boolean DEFAULT false NOT NULL,
	"multiply_by" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"file_id" text NOT NULL,
	"expense_id" text,
	"transaction_hash" varchar(64) NOT NULL,
	"description" text NOT NULL,
	"description_hash" varchar(64) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EUR' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"row_index" integer NOT NULL,
	"raw_row" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_userId_transactionHash_unique" UNIQUE("user_id","transaction_hash")
);
--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "amount" numeric(12, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "transaction_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "imported_from_file_id" text;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "first_transaction_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "last_transaction_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "categorization_pattern" ADD CONSTRAINT "categorization_pattern_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_pattern" ADD CONSTRAINT "categorization_pattern_sub_category_id_sub_category_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "public"."sub_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_classification_history" ADD CONSTRAINT "expense_classification_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_classification_history" ADD CONSTRAINT "expense_classification_history_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_classification_history" ADD CONSTRAINT "expense_classification_history_from_sub_category_id_sub_category_id_fk" FOREIGN KEY ("from_sub_category_id") REFERENCES "public"."sub_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_classification_history" ADD CONSTRAINT "expense_classification_history_to_sub_category_id_sub_category_id_fk" FOREIGN KEY ("to_sub_category_id") REFERENCES "public"."sub_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_classification_history" ADD CONSTRAINT "expense_classification_history_pattern_id_categorization_pattern_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."categorization_pattern"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_import_format_version_id_import_format_version_id_fk" FOREIGN KEY ("import_format_version_id") REFERENCES "public"."import_format_version"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_format_version" ADD CONSTRAINT "import_format_version_platform_id_platform_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platform"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categorization_pattern_userId_idx" ON "categorization_pattern" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "categorization_pattern_subCategoryId_idx" ON "categorization_pattern" USING btree ("sub_category_id");--> statement-breakpoint
CREATE INDEX "categorization_pattern_priority_idx" ON "categorization_pattern" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "expense_classification_history_userId_idx" ON "expense_classification_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "expense_classification_history_expenseId_idx" ON "expense_classification_history" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "expense_classification_history_patternId_idx" ON "expense_classification_history" USING btree ("pattern_id");--> statement-breakpoint
CREATE INDEX "file_userId_idx" ON "file" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "file_userId_status_idx" ON "file" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "file_importFormatVersionId_idx" ON "file" USING btree ("import_format_version_id");--> statement-breakpoint
CREATE INDEX "import_format_version_platformId_idx" ON "import_format_version" USING btree ("platform_id");--> statement-breakpoint
CREATE INDEX "platform_slug_idx" ON "platform" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "transaction_userId_idx" ON "transaction" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transaction_fileId_idx" ON "transaction" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "transaction_expenseId_idx" ON "transaction" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "transaction_userId_occurredAt_idx" ON "transaction" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "transaction_userId_descriptionHash_idx" ON "transaction" USING btree ("user_id","description_hash");--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_imported_from_file_id_file_id_fk" FOREIGN KEY ("imported_from_file_id") REFERENCES "public"."file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_importedFromFileId_idx" ON "expense" USING btree ("imported_from_file_id");--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_userId_descriptionHash_unique" UNIQUE("user_id","description_hash");