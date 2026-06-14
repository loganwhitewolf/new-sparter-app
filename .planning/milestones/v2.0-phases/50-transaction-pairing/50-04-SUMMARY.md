---
phase: 50-transaction-pairing
plan: "04"
subsystem: dal
tags: [transaction-pairing, netting, dashboard, overview, dal, aggregation]
dependency_graph:
  requires: ["50-01", "50-02"]
  provides: ["50-05"]
  affects: ["lib/dal/dashboard.ts", "lib/dal/overview.ts", "lib/dal/transactions.ts"]
tech_stack:
  added: []
  patterns:
    - "Shared SQL fragment reuse: isNotSecondary() + effectiveAmount() imported from transaction-pairs-sql.ts"
    - "Correlated subqueries in SELECT (no LEFT JOIN) for paired transaction fields"
key_files:
  modified:
    - lib/dal/dashboard.ts
    - lib/dal/overview.ts
    - lib/dal/transactions.ts
decisions:
  - "PAIR-03: Applied isNotSecondary() + effectiveAmount() together at all 8 aggregation sites — never one without the other (Pitfall 1/2 guard)"
  - "getOverview (overview.ts) left untouched — it delegates to getOverviewAmountTotals which is already netted; editing it would double-count"
  - "transactionListSelect uses correlated subqueries, not a LEFT JOIN, to preserve buildTransactionOrderBy fan-out safety"
  - "pairedNetAmount returns (transaction.amount::numeric + t2.amount::numeric)::text — same signed net on both legs per Open Question 1"
metrics:
  duration: "~25min"
  completed: "2026-06-14T07:07:04Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 50 Plan 04: DAL Netting Integration Summary

**One-liner:** Dashboard and overview aggregations netted via shared `isNotSecondary()`/`effectiveAmount()` fragments at all 8 sites; transaction list exposes 4 paired fields via correlated subqueries.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Apply netting helpers to 6 dashboard.ts aggregation sites | bf84fcf | lib/dal/dashboard.ts |
| 2 | Netting in overview.ts (2 sites) + paired fields on transactionListSelect | 93e6b9b | lib/dal/overview.ts, lib/dal/transactions.ts |

## What Was Built

### Task 1 — dashboard.ts (6 sites)

Added `import { isNotSecondary, effectiveAmount } from '@/lib/dal/transaction-pairs-sql'`.

Applied both helpers together at all 6 aggregation functions:

1. **`getOverviewAmountTotals`** — `effectiveAmount()` in all three SUM CASE branches (in/out/allocation) + `isNotSecondary()` in WHERE
2. **`getCategoriesBreakdown`** — `effectiveAmount()` in `abs(sum(...))` + `isNotSecondary()` in WHERE
3. **`getCategoryRanking`** — `effectiveAmount()` in amount + ORDER BY expression + `isNotSecondary()` in WHERE
4. **`getCategoryDeviations`** — both helpers on the reference-period sub-query AND the baseline-period sub-query (two sub-queries, both netted)
5. **`getCategoryDetail`** — all three sub-queries (trend, subcategories, topTransactions) netted; topTransactions uses `isNotSecondary()` so paired secondaries never appear in top-5
6. **`getMonthlyTrendByNature`** — `effectiveAmount()` in `sum(...)` + `isNotSecondary()` in WHERE (leftJoin context — `${transactionTable.id}` resolves correctly regardless)

Zero inline `transaction_pair` logic in `dashboard.ts` — all netting comes exclusively from the shared helpers.

### Task 2 — overview.ts (2 sites) + transactions.ts

**overview.ts:**
- `getOverviewChart`: `effectiveAmount()` in `sum(...)` + `isNotSecondary()` in WHERE
- `getMonthOverMonthCategoryChanges`: both helpers on both sub-queries (curr + prev) for both the allocation grain (grouped by nature) and the in/out grain (grouped by category)
- `getOverview`: intentionally left untouched — it delegates to `getOverviewAmountTotals` which is already netted; adding helpers here would double-count

**transactions.ts:**
- Extended `transactionListSelect` with 4 correlated subquery fields:
  - `pairedWithId` — counterpart transaction id (CASE on which FK matches the outer `transaction.id`)
  - `pairedNetAmount` — `(transaction.amount::numeric + t2.amount::numeric)::text` — signed net
  - `pairedDescription` — counterpart description for badge popover
  - `pairedOccurredAt` — counterpart `occurred_at`
- Used correlated subqueries (not a LEFT JOIN) to preserve `buildTransactionOrderBy` fan-out safety
- Added all 4 as nullable fields to `TransactionListRow` type

## Test Results

All 76 tests GREEN (up from 71 passing before — 5 RED tests in `transactions-dal.test.ts` now pass):

- `tests/dashboard-dal.test.ts`: 39/39 passed
- `tests/transactions-dal.test.ts`: 37/37 passed (includes 5 new PAIR-02 select-shape tests)

Pairing netting tests (PAIR-03) that were RED in Plan 01 are now GREEN:
- `isNotSecondary()` contract tests
- `effectiveAmount()` contract tests
- Netting scenario: primary -100 + secondary +50 → totalOut 50.00
- Secondary excluded from totalIn
- ADR 0004 regression guard: unpaired transactions unaffected

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all 4 paired fields are wired via real correlated subqueries referencing `transaction_pair`.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. The correlated subqueries in `transactionListSelect` operate on the user-scoped outer query (`getTransactions` filters by session userId); cross-user pair rows are structurally impossible (Plan 03 blocks cross-user pair creation).

## Self-Check: PASSED

- lib/dal/dashboard.ts: modified (bf84fcf) ✓
- lib/dal/overview.ts: modified (93e6b9b) ✓
- lib/dal/transactions.ts: modified (93e6b9b) ✓
- `yarn test tests/dashboard-dal.test.ts tests/transactions-dal.test.ts` → 76/76 GREEN ✓
- `yarn lint lib/dal/dashboard.ts lib/dal/overview.ts lib/dal/transactions.ts` → clean ✓
- No inline `transaction_pair` re-derivation in dashboard.ts → 0 matches ✓
- `getOverview` untouched (no helpers added) ✓
