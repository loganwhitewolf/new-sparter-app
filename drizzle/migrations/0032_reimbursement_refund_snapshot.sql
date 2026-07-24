CREATE TABLE "reimbursement_refund_snapshot" (
	"id" serial PRIMARY KEY NOT NULL,
	"reimbursement_refund_id" integer NOT NULL,
	"expense_id" text,
	"expense_title" text,
	"expense_description_hash" varchar(64),
	"expense_sub_category_id" integer,
	"expense_status" "expense_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reimbursement_refund_snapshot_reimbursementRefundId_unique" UNIQUE("reimbursement_refund_id")
);
--> statement-breakpoint
ALTER TABLE "reimbursement_refund_snapshot" ADD CONSTRAINT "reimbursement_refund_snapshot_reimbursement_refund_id_reimbursement_refund_id_fk" FOREIGN KEY ("reimbursement_refund_id") REFERENCES "public"."reimbursement_refund"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_refund_snapshot" ADD CONSTRAINT "reimbursement_refund_snapshot_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reimbursement_refund_snapshot" ADD CONSTRAINT "reimbursement_refund_snapshot_expense_sub_category_id_sub_category_id_fk" FOREIGN KEY ("expense_sub_category_id") REFERENCES "public"."sub_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reimbursement_refund_snapshot_reimbursementRefundId_idx" ON "reimbursement_refund_snapshot" USING btree ("reimbursement_refund_id");--> statement-breakpoint
CREATE INDEX "reimbursement_refund_snapshot_expenseId_idx" ON "reimbursement_refund_snapshot" USING btree ("expense_id");