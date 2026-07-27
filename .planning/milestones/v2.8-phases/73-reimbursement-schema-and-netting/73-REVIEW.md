---
phase: 73-reimbursement-schema-and-netting
reviewed: 2026-07-23T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - drizzle/migrations/0028_daffy_exodus.sql
  - drizzle/migrations/0029_reimbursement_backfill.sql
  - drizzle/migrations/0030_drop_transaction_pair.sql
  - lib/dal/transaction-pairs-sql.ts
  - lib/dal/transaction-pairs.ts
  - lib/dal/transactions.ts
  - lib/db/schema.ts
  - lib/services/reimbursement-invariant.ts
  - lib/services/transaction-edit.ts
  - lib/services/transaction-pairs.ts
  - tests/dashboard-dal.test.ts
  - tests/fixtures/reimbursement-seed.ts
  - tests/helpers/reimbursement-test-db.ts
  - tests/reimbursement-invariant.test.ts
  - tests/reimbursement-regression.test.ts
  - tests/transaction-edit.test.ts
  - tests/transaction-pairs-dal.test.ts
  - tests/transaction-pairs-service.test.ts
  - tests/transactions-dal.test.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
  critical_resolved: 1
status: warnings_open
resolution: >
  CR-01 (critical, silent backfill data loss) fixed in commit fab20ec — a preflight
  DO-block RAISE EXCEPTION now aborts migration 0029 (blocking 0030's irreversible DROP)
  if any transaction_pair resolves to a null outflow-anchor expense_id. Full suite green
  after a fresh re-migrate. WR-01/WR-02/WR-03 (warnings) and IN-01/IN-02 (info) were
  reviewed and consciously deferred by the developer, not applied this phase.
---

# Phase 73: Code Review Report

**Reviewed:** 2026-07-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Reviewed the 1:1 `transaction_pair` → 1:N `reimbursement`/`reimbursement_refund` migration: the three SQL migrations, the netting SQL fragments (`effectiveAmount`/`isNotSecondary`), the D-02 invariant module, the repointed `createPair`/`deletePairByTransactionId` service, the amount-edit pair guard, the transactions DAL pairing display fields, and the accompanying test suite.

The write paths (`createPair`, `updateTransaction`) correctly enforce sign-based anchor/refund resolution, use Decimal.js exclusively for TS-side arithmetic, run ownership checks and the read-then-write atomically inside `db.transaction`, and no consumer of the dropped `transaction_pair` table remains (verified by repo-wide grep). The documented `expense_group_id` netting gap is real but intentionally deferred to Phase 74 and is not silently mishandled by any write path (XOR CHECK + no code path currently creates a group-anchored row).

One correctness/data-loss issue was found in the one-way backfill migration (0029) combined with the irreversible drop (0030): rows whose anchor transaction had already lost its `expense_id` (via a prior expense deletion — an acknowledged, pre-existing possibility per `transaction.expenseId`'s `ON DELETE SET NULL` FK) are silently excluded from the backfill with no error, count, or warning, and become permanently unrecoverable once 0030 runs. Three further warnings and two info items are noted below.

## Critical Issues

### CR-01: Backfill migration silently drops transaction_pair rows whose anchor transaction has a null expense_id, and 0030 makes the loss permanent

**File:** `drizzle/migrations/0029_reimbursement_backfill.sql:24-43` (Step 1), `drizzle/migrations/0030_drop_transaction_pair.sql:9`
**Issue:**
`transaction.expenseId` is a nullable FK with `ON DELETE SET NULL` (`lib/db/schema.ts:425`), and the codebase itself documents that an "orphaned transaction (expenseId set null via a prior expense deletion...)" is a known, reachable state (see the comment in `lib/services/transaction-pairs.ts:166-169`). Migration 0029's `resolved_pairs`/`anchors` CTEs resolve the outflow anchor's `expense_id` by sign (`tx_a."amount"::numeric < 0 ? tx_a.expense_id : tx_b.expense_id`), then filter with:

```sql
anchors AS (
  SELECT rp.outflow_expense_id, MIN(rp.pair_created_at) AS earliest_created_at
  FROM resolved_pairs rp
  WHERE rp.outflow_expense_id IS NOT NULL
  GROUP BY rp.outflow_expense_id
)
```

If the outflow-side transaction of a legacy `transaction_pair` row had its `expense_id` nulled out before this migration ran, `outflow_expense_id` is `NULL` and the entire pair (both the reimbursement anchor and its refund link) is dropped from the `INSERT` with no error, no row count check, and no logged warning. Step 2's `INSERT INTO reimbursement_refund` has the identical `WHERE rp.outflow_expense_id IS NOT NULL` filter, so the refund side is lost too.

Migration 0030 then unconditionally `DROP TABLE "transaction_pair"` — a one-way operation. Combined, any legacy pair whose anchor transaction lost its expense link is **permanently and silently destroyed**, contradicting 0029's own header comment ("Backfill **every** existing transaction_pair row into reimbursement + reimbursement_refund").

**Fix:** Before dropping the table (or as part of 0029), add a verification step that fails the migration (or at minimum raises a NOTICE/WARNING visible in deploy logs) when any `transaction_pair` row cannot be resolved to a non-null anchor `expense_id`:

```sql
DO $$
DECLARE unresolved_count integer;
BEGIN
  SELECT COUNT(*) INTO unresolved_count
  FROM "transaction_pair" tp
  INNER JOIN "transaction" tx_a ON tx_a."id" = tp."transaction_a_id"
  INNER JOIN "transaction" tx_b ON tx_b."id" = tp."transaction_b_id"
  WHERE (CASE WHEN tx_a."amount"::numeric < 0 THEN tx_a."expense_id" ELSE tx_b."expense_id" END) IS NULL;

  IF unresolved_count > 0 THEN
    RAISE EXCEPTION 'reimbursement backfill: % transaction_pair row(s) have an anchor with no expense_id and would be silently dropped', unresolved_count;
  END IF;
END $$;
```
Run this against production data before merging 0030, or add a pre-deploy data audit query per `project_migration_deploy_order.md`'s existing pre-deploy-check convention.

## Warnings

### WR-01: `otherSum === 0` in the refund-side amount-edit guard permanently blocks a legitimate edit

**File:** `lib/services/transaction-edit.ts:145-154`
**Issue:** When editing a refund's amount, the guard computes `otherSum = anchorAmount + otherRefundsSum` (excluding the refund being edited) and requires `newAmount`/`otherSum` to have opposite signs:

```ts
const oppositeSign =
  (newAmount.gt(0) && otherSum.lt(0)) || (newAmount.lt(0) && otherSum.gt(0))
if (!oppositeSign) {
  throw new Error('Scollega prima il rimborso')
}
```

If `otherSum` is exactly `0` (e.g. the anchor is already exactly offset by the *other* linked refunds before this edit is applied — a reachable state, e.g. anchor -100, refund A +100, and the refund being edited is a 3rd, purely additional, refund), both branches of `oppositeSign` evaluate false for *any* `newAmount`, including values that would otherwise be perfectly valid. The user is unconditionally forced to unlink first even though nothing about their specific edit is unsound. The anchor-side branch (lines 159-182) has the same shape but is naturally less likely to hit `otherSum === 0` since 0 there just means "no refunds" (explicitly treated as "no guard" via the `refundsSumRaw != null` check) — the refund-side branch has no equivalent carve-out.
**Fix:** Decide the intended semantics explicitly (e.g. treat `otherSum.eq(0)` as "already fully reconciled without this refund — any nonzero amount is fine as long as it doesn't flip to breaking the *combined* invariant differently") and adjust the condition, or add an explicit code comment if this blocking behavior is intentional so it isn't mistaken for a defect in a future change.

### WR-02: `getEligibleCounterparts` offers counterparts that createPair will later reject, with no filtering for the reference transaction's own already-paired state

**File:** `lib/dal/transaction-pairs.ts:63-69`, `lib/dal/transaction-pairs.ts:36-91`
**Issue:** `notAlreadyPaired` excludes a *counterpart* candidate that is already linked, but:
1. It does not check whether `params.referenceId` (the transaction initiating the pair) is itself already linked as a refund or anchor. The UI can present a counterpart picker for an already-paired transaction; the resulting `createPair` call will only fail at the DB layer (translated to "Una delle transazioni è già collegata a un'altra."), which is a worse UX than filtering it out up front (the picker should arguably never open for an already-paired reference).
2. A candidate whose own `expenseId` is `null` (unlinked to any expense) is not excluded either, even though it can never legally become an anchor (SQL `NOT EXISTS (... WHERE r.expense_id = NULL)` is vacuously true) — if it is later chosen as the anchor side by sign, `createPair` throws "La transazione da rimborsare non è associata a nessuna spesa." after a DB round trip rather than being excluded from the picker's result set.

Neither is a security issue (ownership and structural invariants are still correctly enforced downstream), but both degrade the picker's UX by surfacing candidates that are guaranteed to fail.
**Fix:** Consider adding an early guard in the calling Server Action (before invoking `getEligibleCounterparts`) that rejects when the reference transaction is already paired, and/or exclude counterparts with a null `expenseId` from eligibility when they could only ever serve as an anchor.

### WR-03: `assertReimbursementAmounts` is exported but never called from production code

**File:** `lib/services/reimbursement-invariant.ts:36-44`
**Issue:** `assertReimbursementAmounts` bundles the anchor + N-refund validation into one call and is documented as the intended entry point ("Validates a full reimbursement input shape in one call"), but a repo-wide search shows it is only referenced from its own test (`tests/reimbursement-invariant.test.ts`). The actual write path (`lib/services/transaction-pairs.ts:138-139`) calls the two granular functions (`assertOutflowAnchorAmount` / `assertInflowRefundAmount`) directly instead. This isn't wrong today (N is always 1 in the current 1:1 `createPair` flow), but it means the "one call" API this module advertises is dead code with respect to production usage — a maintenance trap if a future N>1 creation path is added without noticing this helper already exists.
**Fix:** Either wire `createPair`/a future multi-refund creation path through `assertReimbursementAmounts`, or drop it and inline the two calls with a comment, to avoid two parallel, silently-diverging entry points into the same invariant.

## Info

### IN-01: `pairedAmount`/`pairedDescription`/`pairedOccurredAt` in `transactionListSelect` each re-run `pairedCounterpartIdExpr()` as an independent correlated subquery

**File:** `lib/dal/transactions.ts:211-239`
**Issue:** `pairedWithId`, `pairedAmount`, `pairedDescription`, and `pairedOccurredAt` each embed a fresh copy of `pairedCounterpartIdExpr()` (itself a multi-branch `CASE` with nested subqueries) rather than being derived once and reused. This is out of scope as a performance concern per this review's charter, but it is a correctness-adjacent readability/maintainability risk: if the tie-break rule inside `pairedCounterpartIdExpr()` is ever changed, four independent call sites (five counting `pairedReimbursementIdExpr()`'s own duplication of the same `EXISTS`/anchor-tie-break logic) must all be updated consistently, and nothing enforces that.
**Fix:** No action required for this phase; flagging for awareness given the number of near-identical hand-maintained SQL fragments introduced by this generalization.

### IN-02: `resolved_pairs` in migration 0029 has no explicit tie-break for a zero/same-sign pair

**File:** `drizzle/migrations/0029_reimbursement_backfill.sql:24-31`
**Issue:** `CASE WHEN tx_a."amount"::numeric < 0 THEN tx_a."expense_id" ELSE tx_b."expense_id" END` assumes exactly one of the two transactions in every legacy pair is negative (matching the old service's opposite-sign creation invariant, which should hold for all real historical data). If any legacy row ever violated that invariant (e.g. both non-negative, due to a bug predating this phase, or a manually-inserted test row), this silently treats `tx_b` as the "outflow" anchor even though it isn't actually negative — an anchor that would fail `assertOutflowAnchorAmount` if it were being created via the current service, but the migration performs a raw `INSERT` with no equivalent check.
**Fix:** Low practical risk given the pre-existing sign invariant on `transaction_pair` creation, but consider adding a `WHERE tx_a."amount"::numeric < 0 OR tx_b."amount"::numeric < 0` sanity filter (or the same audit query suggested in CR-01) to make the assumption explicit and catch any latent bad data before it becomes an incorrectly-anchored `reimbursement` row.

---

_Reviewed: 2026-07-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
