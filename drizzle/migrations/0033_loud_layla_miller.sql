CREATE TABLE "amortization_instalment" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"instalment_number" integer NOT NULL,
	"expense_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "amortization_instalment_planId_instalmentNumber_unique" UNIQUE("plan_id","instalment_number"),
	CONSTRAINT "amortization_instalment_instalmentNumber_check" CHECK ("amortization_instalment"."instalment_number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "amortization_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"months" integer NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "amortization_plan_transactionId_unique" UNIQUE("transaction_id"),
	CONSTRAINT "amortization_plan_months_check" CHECK ("amortization_plan"."months" >= 2)
);
--> statement-breakpoint
ALTER TABLE "amortization_instalment" ADD CONSTRAINT "amortization_instalment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amortization_instalment" ADD CONSTRAINT "amortization_instalment_plan_id_amortization_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."amortization_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amortization_instalment" ADD CONSTRAINT "amortization_instalment_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amortization_plan" ADD CONSTRAINT "amortization_plan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amortization_plan" ADD CONSTRAINT "amortization_plan_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "amortization_instalment_userId_idx" ON "amortization_instalment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "amortization_instalment_planId_idx" ON "amortization_instalment" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "amortization_instalment_expenseId_idx" ON "amortization_instalment" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "amortization_instalment_userId_occurredAt_idx" ON "amortization_instalment" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "amortization_plan_userId_idx" ON "amortization_plan" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "amortization_plan_userId_status_idx" ON "amortization_plan" USING btree ("user_id","status");--> statement-breakpoint
CREATE VIEW "public"."ledger_entry_accrual" AS (
  SELECT
    "transaction"."id" AS id,
    "transaction"."user_id" AS user_id,
    "transaction"."occurred_at" AS occurred_at,
    "transaction"."expense_id" AS expense_id,
    (
    "transaction"."amount"::numeric + COALESCE((
      WITH anchor AS (
        SELECT r.id AS reimbursement_id, r.expense_id, r.expense_group_id
        FROM reimbursement r
        WHERE r.expense_id = "transaction"."expense_id"
           OR r.expense_group_id = (
             SELECT egm.group_id FROM expense_group_membership egm
             WHERE egm.expense_id = "transaction"."expense_id"
           )
        LIMIT 1
      ),
      member_expense_ids AS (
        SELECT egm2.expense_id AS expense_id
        FROM anchor a
        INNER JOIN expense_group_membership egm2 ON egm2.group_id = a.expense_group_id
        WHERE a.expense_group_id IS NOT NULL
      ),
      member_transactions AS (
        SELECT m.id, m.amount::numeric AS amount, m.occurred_at
        FROM transaction m
        INNER JOIN reimbursement_anchor_transaction rat ON rat.transaction_id = m.id
        INNER JOIN anchor a ON a.reimbursement_id = rat.reimbursement_id
        WHERE a.expense_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM reimbursement_refund rr2 WHERE rr2.transaction_id = m.id
          )
        UNION ALL
        SELECT m.id, m.amount::numeric AS amount, m.occurred_at
        FROM transaction m
        WHERE m.expense_id IN (SELECT expense_id FROM member_expense_ids)
          AND NOT EXISTS (
            SELECT 1 FROM reimbursement_refund rr2 WHERE rr2.transaction_id = m.id
          )
      ),
      refund_total AS (
        SELECT COALESCE(SUM(rt.amount::numeric), 0) AS total
        FROM reimbursement_refund rr
        INNER JOIN transaction rt ON rt.id = rr.transaction_id, anchor a
        WHERE rr.reimbursement_id = a.reimbursement_id
      ),
      raw_shares AS (
        SELECT
          mt.id,
          ROUND(
            (SELECT total FROM refund_total) * mt.amount
              / NULLIF((SELECT SUM(amount) FROM member_transactions), 0),
            2
          ) AS raw_share,
          ROW_NUMBER() OVER (
            ORDER BY ABS(mt.amount) DESC, mt.occurred_at ASC, mt.id ASC
          ) AS rn
        FROM member_transactions mt
      ),
      member_shares AS (
        SELECT
          id,
          COALESCE(raw_share, 0) + CASE
            WHEN rn = 1 THEN (SELECT total FROM refund_total) - SUM(raw_share) OVER ()
            ELSE 0
          END AS final_share
        FROM raw_shares
      )
      SELECT final_share FROM member_shares WHERE id = "transaction"."id"
    ), 0)
  ) AS amount
  FROM "transaction"
  WHERE NOT EXISTS (
    SELECT 1 FROM reimbursement_refund rr
    WHERE rr.transaction_id = "transaction"."id"
  )
    AND NOT EXISTS (
      SELECT 1 FROM amortization_plan ap WHERE ap.transaction_id = "transaction"."id"
    )

  UNION ALL

  SELECT
    "amortization_instalment"."id" AS id,
    "amortization_instalment"."user_id" AS user_id,
    "amortization_instalment"."occurred_at" AS occurred_at,
    "amortization_instalment"."expense_id" AS expense_id,
    "amortization_instalment"."amount"::numeric AS amount
  FROM "amortization_instalment"
);--> statement-breakpoint
CREATE VIEW "public"."ledger_entry_cash" AS (
  SELECT
    "transaction"."id" AS id,
    "transaction"."user_id" AS user_id,
    "transaction"."occurred_at" AS occurred_at,
    "transaction"."expense_id" AS expense_id,
    (
    "transaction"."amount"::numeric + COALESCE((
      WITH anchor AS (
        SELECT r.id AS reimbursement_id, r.expense_id, r.expense_group_id
        FROM reimbursement r
        WHERE r.expense_id = "transaction"."expense_id"
           OR r.expense_group_id = (
             SELECT egm.group_id FROM expense_group_membership egm
             WHERE egm.expense_id = "transaction"."expense_id"
           )
        LIMIT 1
      ),
      member_expense_ids AS (
        SELECT egm2.expense_id AS expense_id
        FROM anchor a
        INNER JOIN expense_group_membership egm2 ON egm2.group_id = a.expense_group_id
        WHERE a.expense_group_id IS NOT NULL
      ),
      member_transactions AS (
        SELECT m.id, m.amount::numeric AS amount, m.occurred_at
        FROM transaction m
        INNER JOIN reimbursement_anchor_transaction rat ON rat.transaction_id = m.id
        INNER JOIN anchor a ON a.reimbursement_id = rat.reimbursement_id
        WHERE a.expense_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM reimbursement_refund rr2 WHERE rr2.transaction_id = m.id
          )
        UNION ALL
        SELECT m.id, m.amount::numeric AS amount, m.occurred_at
        FROM transaction m
        WHERE m.expense_id IN (SELECT expense_id FROM member_expense_ids)
          AND NOT EXISTS (
            SELECT 1 FROM reimbursement_refund rr2 WHERE rr2.transaction_id = m.id
          )
      ),
      refund_total AS (
        SELECT COALESCE(SUM(rt.amount::numeric), 0) AS total
        FROM reimbursement_refund rr
        INNER JOIN transaction rt ON rt.id = rr.transaction_id, anchor a
        WHERE rr.reimbursement_id = a.reimbursement_id
      ),
      raw_shares AS (
        SELECT
          mt.id,
          ROUND(
            (SELECT total FROM refund_total) * mt.amount
              / NULLIF((SELECT SUM(amount) FROM member_transactions), 0),
            2
          ) AS raw_share,
          ROW_NUMBER() OVER (
            ORDER BY ABS(mt.amount) DESC, mt.occurred_at ASC, mt.id ASC
          ) AS rn
        FROM member_transactions mt
      ),
      member_shares AS (
        SELECT
          id,
          COALESCE(raw_share, 0) + CASE
            WHEN rn = 1 THEN (SELECT total FROM refund_total) - SUM(raw_share) OVER ()
            ELSE 0
          END AS final_share
        FROM raw_shares
      )
      SELECT final_share FROM member_shares WHERE id = "transaction"."id"
    ), 0)
  ) AS amount
  FROM "transaction"
  WHERE NOT EXISTS (
    SELECT 1 FROM reimbursement_refund rr
    WHERE rr.transaction_id = "transaction"."id"
  )
);