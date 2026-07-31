ALTER TABLE "category" ADD COLUMN "direction_id" integer;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_direction_id_direction_id_fk" FOREIGN KEY ("direction_id") REFERENCES "public"."direction"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "category_directionId_idx" ON "category" USING btree ("direction_id");