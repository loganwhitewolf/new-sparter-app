CREATE TABLE "reimbursement" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"expense_id" text,
	"expense_group_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reimbursement_anchor_xor" CHECK (("reimbursement"."expense_id" IS NOT NULL) <> ("reimbursement"."expense_group_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "reimbursement_refund" (
	"id" serial PRIMARY KEY NOT NULL,
	"reimbursement_id" integer NOT NULL,
	"transaction_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reimbursement_refund_transactionId_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
ALTER TABLE "reimbursement" ADD CONSTRAINT "reimbursement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement" ADD CONSTRAINT "reimbursement_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement" ADD CONSTRAINT "reimbursement_expense_group_id_expense_group_id_fk" FOREIGN KEY ("expense_group_id") REFERENCES "public"."expense_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_refund" ADD CONSTRAINT "reimbursement_refund_reimbursement_id_reimbursement_id_fk" FOREIGN KEY ("reimbursement_id") REFERENCES "public"."reimbursement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_refund" ADD CONSTRAINT "reimbursement_refund_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reimbursement_userId_idx" ON "reimbursement" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reimbursement_expenseId_idx" ON "reimbursement" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "reimbursement_expenseGroupId_idx" ON "reimbursement" USING btree ("expense_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reimbursement_expenseId_unique" ON "reimbursement" USING btree ("expense_id") WHERE "reimbursement"."expense_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reimbursement_expenseGroupId_unique" ON "reimbursement" USING btree ("expense_group_id") WHERE "reimbursement"."expense_group_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "reimbursement_refund_reimbursementId_idx" ON "reimbursement_refund" USING btree ("reimbursement_id");--> statement-breakpoint
CREATE INDEX "reimbursement_refund_transactionId_idx" ON "reimbursement_refund" USING btree ("transaction_id");