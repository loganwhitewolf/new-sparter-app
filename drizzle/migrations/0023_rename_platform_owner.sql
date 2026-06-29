DROP INDEX "platform_visibility_reviewStatus_idx";--> statement-breakpoint
DROP INDEX "platform_ownerUserId_idx";--> statement-breakpoint
ALTER TABLE "platform" RENAME COLUMN "owner_user_id" TO "proposed_by_user_id";--> statement-breakpoint
ALTER TABLE "platform" DROP COLUMN "visibility";--> statement-breakpoint
ALTER TABLE "platform" DROP CONSTRAINT "platform_owner_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "platform" ADD CONSTRAINT "platform_proposed_by_user_id_user_id_fk" FOREIGN KEY ("proposed_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_proposedByUserId_idx" ON "platform" USING btree ("proposed_by_user_id");--> statement-breakpoint
CREATE INDEX "platform_reviewStatus_idx" ON "platform" USING btree ("review_status");
