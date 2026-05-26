ALTER TYPE "public"."flow_nature" ADD VALUE 'income' BEFORE 'debt';--> statement-breakpoint
ALTER TABLE "platform" ALTER COLUMN "id" SET DATA TYPE serial;