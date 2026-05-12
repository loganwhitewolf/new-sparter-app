ALTER TABLE "file" ADD COLUMN "content_hash" varchar(64);--> statement-breakpoint
CREATE INDEX "file_userId_contentHash_idx" ON "file" USING btree ("user_id", "content_hash");
