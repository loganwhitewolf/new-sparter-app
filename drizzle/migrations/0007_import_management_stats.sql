ALTER TABLE "file" ADD COLUMN "display_name" varchar(255);--> statement-breakpoint
ALTER TABLE "file" ADD COLUMN "imported_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "file" ADD COLUMN "positive_total" numeric(12, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "file" ADD COLUMN "negative_total" numeric(12, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "file" ADD COLUMN "reference_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "file" ADD COLUMN "reference_ended_at" timestamp with time zone;--> statement-breakpoint
WITH import_stats AS (
  SELECT
    "file_id",
    count(*)::integer AS "imported_count",
    COALESCE(sum(CASE WHEN "amount" > 0 THEN "amount" ELSE 0 END), 0)::numeric(12, 2) AS "positive_total",
    COALESCE(sum(CASE WHEN "amount" < 0 THEN "amount" ELSE 0 END), 0)::numeric(12, 2) AS "negative_total",
    min("occurred_at") AS "reference_started_at",
    max("occurred_at") AS "reference_ended_at"
  FROM "transaction"
  WHERE "file_id" IS NOT NULL
  GROUP BY "file_id"
)
UPDATE "file"
SET
  "imported_count" = import_stats."imported_count",
  "positive_total" = import_stats."positive_total",
  "negative_total" = import_stats."negative_total",
  "reference_started_at" = import_stats."reference_started_at",
  "reference_ended_at" = import_stats."reference_ended_at"
FROM import_stats
WHERE "file"."id" = import_stats."file_id";--> statement-breakpoint
CREATE INDEX "file_userId_uploadedAt_idx" ON "file" USING btree ("user_id", "uploaded_at");--> statement-breakpoint
CREATE INDEX "file_userId_importedAt_idx" ON "file" USING btree ("user_id", "imported_at");--> statement-breakpoint
CREATE INDEX "file_userId_reference_range_idx" ON "file" USING btree ("user_id", "reference_started_at", "reference_ended_at");
