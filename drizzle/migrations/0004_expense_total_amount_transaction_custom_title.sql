ALTER TABLE "expense" RENAME COLUMN "amount" TO "total_amount";--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "custom_title" varchar(255);
