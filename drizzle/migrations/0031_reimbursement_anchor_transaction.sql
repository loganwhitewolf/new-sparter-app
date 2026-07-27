CREATE TABLE "reimbursement_anchor_transaction" (
	"id" serial PRIMARY KEY NOT NULL,
	"reimbursement_id" integer NOT NULL,
	"transaction_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reimbursement_anchor_transaction_reimbursement_transaction_unique" UNIQUE("reimbursement_id","transaction_id")
);
--> statement-breakpoint
ALTER TABLE "reimbursement_anchor_transaction" ADD CONSTRAINT "reimbursement_anchor_transaction_reimbursement_id_reimbursement_id_fk" FOREIGN KEY ("reimbursement_id") REFERENCES "public"."reimbursement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_anchor_transaction" ADD CONSTRAINT "reimbursement_anchor_transaction_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reimbursement_anchor_transaction_reimbursementId_idx" ON "reimbursement_anchor_transaction" USING btree ("reimbursement_id");--> statement-breakpoint
CREATE INDEX "reimbursement_anchor_transaction_transactionId_idx" ON "reimbursement_anchor_transaction" USING btree ("transaction_id");--> statement-breakpoint
-- Backfill (Phase 75, ADR 0018 D-08): snapshot the frozen anchored-transaction set for every
-- EXISTING Expense-anchored reimbursement, as of migration time. This covers every reimbursement
-- migrated (or created) before this migration ran — today's only anchor shape any reimbursement
-- row can have is Expense-anchored (Group-anchor creation is Plan 75-02 scope).
--
-- Group-anchored reimbursements (expense_id IS NULL, expense_group_id IS NOT NULL) are
-- DELIBERATELY never backfilled here — D-08 leaves the Group-anchor member-resolution path
-- (expense_group_membership) untouched; it is not vulnerable to the contamination this table
-- exists to close.
--
-- ON CONFLICT DO NOTHING makes this idempotent/rerun-safe (T-75-01): a reimbursement with
-- multiple transactions under the same anchor expense_id inserts one row per (reimbursement_id,
-- transaction_id) pair, and a rerun against an already-backfilled DB is a no-op.
INSERT INTO "reimbursement_anchor_transaction" ("reimbursement_id", "transaction_id")
SELECT r."id", t."id"
FROM "reimbursement" r
INNER JOIN "transaction" t ON t."expense_id" = r."expense_id"
WHERE r."expense_id" IS NOT NULL
ON CONFLICT DO NOTHING;