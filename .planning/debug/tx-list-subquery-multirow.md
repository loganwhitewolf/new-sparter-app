---
status: awaiting_human_verify
trigger: |
  Production-only Postgres error 21000 on /transactions page:
  "more than one row returned by a subquery used as an expression"
  when listing transactions filtered by platform=trade-republic for user
  7QxNyDhovnxXKl5fuobrqB9GF3uO6mg3. Does not reproduce on staging.
  Failed query is the transaction list SELECT with reimbursement CASE
  subqueries and amortization_plan scalar subqueries (no LIMIT on ap.id/ap.status).
created: 2026-08-04
updated: 2026-08-04T14:34:00+02:00
---

# Debug: tx-list-subquery-multirow

## Symptoms

**Expected behavior:** `/transactions` page loads the filtered list (platform `trade-republic`, directions `in`/`out`/`allocation`, limit 50) for the authenticated user.

**Actual behavior:** Page crashes with Postgres error code `21000`: more than one row returned by a subquery used as an expression. Only in production, not staging.

**Error messages:**
- `Error: Failed query: select "transaction"."id", ...` (full list query with reimbursement + amortization scalar subqueries)
- `cause: error: more than one row returned by a subquery used as an expression` (`nodeSubplan.c` / `ExecScanSubPlan`)
- params: `userId=7Qx…`, `platformSlug=trade-republic`, directions `in,out,allocation`, `limit=50`
- digest: `252613548`
- stack: `app/(app)/transactions/page.js` → DAL list query

**Timeline:** Observed in production; staging does not hit the same data shape.

**Reproduction:** Open `/transactions` as that user with platform filter `trade-republic` (and default direction filter). Crash on the list query.

## Current Focus

hypothesis: CONFIRMED — pairedNetAmount multi-row scalar subquery × prod multi-anchor data
test: completed — revert reproduced PG 21000; fix makes multi-anchor list green
expecting: human confirms /transactions works in production (or preview) for the affected user/filter
next_action: await human verification on prod/preview deploy
bug_class: Bohrbug
reasoning_checkpoint: |
  hypothesis: "pairedNetAmount joins reimbursement_anchor_transaction without aggregate/LIMIT; prod multi-anchor rows (migration 0031) make the scalar subquery return N>1 → PG 21000"
  confirming_evidence:
    - "pairedNetAmount SQL joined rat without SUM/LIMIT"
    - "migration 0031 backfills all expense txs into rat"
    - "revert-and-reconfirm: multi-anchor getTransactions throws code 21000; reapply passes"
  falsification_test: "Would be wrong if multi-anchor test failed for a different subquery (e.g. amortization) after only changing pairedNetAmount — observed failure was pairedNetAmount path"
  fix_rationale: "SUM(anchor amounts)+SUM(refunds) from reimbursement PK → always ≤1 row; matches FULL reimbursement net intent"
  blind_spots: "No live prod query yet; footer may double-count full net when multiple frozen-anchor rows appear in the same page (pre-existing backfill semantic)"
  candidate_causes:
    - "code: pairedNetAmount multiplies by rat join without aggregate"
    - "data: prod multi-anchor from 0031 backfill"
  and_gate: "yes — both required"

## Evidence

- timestamp: 2026-08-04
  source: production error log (user paste)
  finding: List query fails with PG 21000; SQL includes reimbursement + amortization scalar subqueries.
  significance: Scalar subquery multi-row failure mode.

- timestamp: 2026-08-04T14:35
  checked: lib/dal/transactions.ts pairedNetAmount
  found: Joined rat without aggregate → one row per frozen anchor.
  implication: Primary 21000 source for multi-anchor reimbursements.

- timestamp: 2026-08-04T14:36
  checked: migration 0031 backfill
  found: INSERT all transactions under expense_id into rat.
  implication: Production multi-anchor data is expected, not corruption.

- timestamp: 2026-08-04T14:37
  checked: amortization_plan UNIQUE(transaction_id) in schema + 0033
  found: Constraint present.
  implication: amortization subqueries not primary cause; LIMIT 1 added as defense.

- timestamp: 2026-08-04T14:38
  checked: pairedCounterpartIdExpr / pairedReimbursementIdExpr
  found: Already LIMIT 1.
  implication: Eliminated as 21000 sources.

- timestamp: 2026-08-04T14:33
  checked: vitest multi-anchor regression after fix
  found: PASS — getTransactions returns net -120.00 for anchors -100/-50 + refund +30.
  implication: Fix is cardinality-safe and computes correct SUM.

- timestamp: 2026-08-04T14:33
  checked: revert-and-reconfirm (signal 5)
  found: With old pairedNetAmount SQL, same test fails with Postgres code 21000 (ExecScanSubPlan). Restoring fix → PASS.
  implication: This change is what fixes the bug; root cause confirmed.

## Eliminated

- hypothesis: amortizationPlanId/Status without LIMIT is the primary/sole cause of prod 21000
  evidence: UNIQUE(transaction_id) on amortization_plan since 0033; revert of only pairedNetAmount reproduced 21000 while amortization LIMIT 1 was still present.
  timestamp: 2026-08-04T14:33

- hypothesis: pairedCounterpartIdExpr / pairedReimbursementIdExpr lack LIMIT and fire 21000
  evidence: Both already LIMIT 1.
  timestamp: 2026-08-04T14:40

- hypothesis: Code path divergence between staging and production
  evidence: Same transactionListSelect; production-only matches data cardinality.
  timestamp: 2026-08-04T14:40

## Resolution

root_cause: |
  AND-gate: (1) code — pairedNetAmount scalar subquery joined all reimbursement_anchor_transaction
  rows without aggregation/LIMIT (N>1 → PG 21000); (2) data — migration 0031 / D-08 multi-anchor
  frozen sets exist in production (staging may lack that shape). Amortization UNIQUE makes ap.*
  unlikely primary; LIMIT 1 added defensively.
fix: |
  Rewrite pairedNetAmount as SUM(frozen anchor amounts) + SUM(refund amounts) from reimbursement
  alone. Harden amortizationPlanId/Status with ORDER BY + LIMIT 1. SQL-shape tests + multi-anchor
  getTransactions regression.
verification: |
  target_test: { result: pass, name: "multi-anchor frozen set must not raise PG 21000" }
  mutation_check: { result: skipped, reason_if_skipped: "Stryker not configured in repo" }
  no_op_deletion: { result: pass, deletion_justified_by_rca: false, note: "rewrite aggregate SQL, not deletion" }
  adjacent_tests: { result: pass, suites_run: ["pairing badge multi-transaction Expense", "transactions-dal paired shape"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true, error_on_revert: "21000" }
  guardrail_verdict: accepted
files_changed:
  - lib/dal/transactions.ts
  - tests/transactions-dal.test.ts
  - tests/reimbursement-regression.test.ts
  - .planning/debug/tx-list-subquery-multirow.md

### Prod probe (optional confirmation)
```sql
-- Multi-anchor reimbursements for the affected user (expect count > 0 if H confirmed)
SELECT r.id, COUNT(*) AS anchor_txs
FROM reimbursement r
JOIN reimbursement_anchor_transaction rat ON rat.reimbursement_id = r.id
WHERE r.user_id = '7QxNyDhovnxXKl5fuobrqB9GF3uO6mg3'
GROUP BY r.id
HAVING COUNT(*) > 1
ORDER BY anchor_txs DESC;
```
