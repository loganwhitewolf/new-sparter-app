-- Backfill every existing transaction_pair row into reimbursement + reimbursement_refund
-- (Phase 73, ADR 0018 D-06). transaction_pair is NOT dropped or altered here — Task 1's
-- checkpoint locked option-b (drop transaction_pair once every remaining consumer is
-- repointed, at the end of Plan 73-04, Task 3); this migration only backfills.
--
-- Anchor resolution is by SIGN (amount < 0 = outflow), not by which leg the legacy
-- transaction_pair service labeled "primary" (that service resolves primary by |amount|,
-- see lib/services/transaction-pairs.ts). Trusting transaction_a_id directly would risk
-- migrating an inflow-anchored reimbursement if a historical pair's refund happened to have
-- a larger absolute amount than its spend (e.g. a refund plus goodwill credit) — which would
-- violate D-02 (the anchor must always be an outflow) and this plan's locked prohibition
-- ("a reimbursement must never be creatable or persisted with a non-negative anchor amount").
-- Sign-based resolution guarantees the invariant unconditionally and is a no-op for the
-- common case where transaction_a_id already happens to be the outflow leg.
--
-- Grouping by anchor expense_id (rather than one reimbursement per transaction_pair row)
-- is required for correctness: reimbursement.expense_id has an at-most-one-per-anchor
-- partial unique index (D-03), so two transaction_pair rows that happen to share the same
-- anchor expense (e.g. an expense with two transactions, each individually paired with a
-- different refund) must land as ONE reimbursement with two reimbursement_refund rows, not
-- two conflicting reimbursement rows.

-- Step 1: one reimbursement per distinct outflow-anchor expense across all migrated pairs.
WITH resolved_pairs AS (
  SELECT
    tp."created_at" AS pair_created_at,
    CASE WHEN tx_a."amount"::numeric < 0 THEN tx_a."expense_id" ELSE tx_b."expense_id" END AS outflow_expense_id
  FROM "transaction_pair" tp
  INNER JOIN "transaction" tx_a ON tx_a."id" = tp."transaction_a_id"
  INNER JOIN "transaction" tx_b ON tx_b."id" = tp."transaction_b_id"
),
anchors AS (
  SELECT
    rp.outflow_expense_id,
    MIN(rp.pair_created_at) AS earliest_created_at
  FROM resolved_pairs rp
  WHERE rp.outflow_expense_id IS NOT NULL
  GROUP BY rp.outflow_expense_id
)
INSERT INTO "reimbursement" ("user_id", "title", "expense_id", "created_at")
SELECT e."user_id", e."title", e."id", a."earliest_created_at"
FROM anchors a
INNER JOIN "expense" e ON e."id" = a.outflow_expense_id;
--> statement-breakpoint

-- Step 2: one reimbursement_refund per transaction_pair row, linking the inflow transaction
-- to the reimbursement whose expense_id matches the pair's resolved outflow anchor.
WITH resolved_pairs AS (
  SELECT
    tp."created_at" AS pair_created_at,
    CASE WHEN tx_a."amount"::numeric < 0 THEN tx_a."expense_id" ELSE tx_b."expense_id" END AS outflow_expense_id,
    CASE WHEN tx_a."amount"::numeric < 0 THEN tx_b."id" ELSE tx_a."id" END AS inflow_transaction_id
  FROM "transaction_pair" tp
  INNER JOIN "transaction" tx_a ON tx_a."id" = tp."transaction_a_id"
  INNER JOIN "transaction" tx_b ON tx_b."id" = tp."transaction_b_id"
)
INSERT INTO "reimbursement_refund" ("reimbursement_id", "transaction_id", "created_at")
SELECT r."id", rp.inflow_transaction_id, rp.pair_created_at
FROM resolved_pairs rp
INNER JOIN "reimbursement" r ON r."expense_id" = rp.outflow_expense_id
WHERE rp.outflow_expense_id IS NOT NULL;
