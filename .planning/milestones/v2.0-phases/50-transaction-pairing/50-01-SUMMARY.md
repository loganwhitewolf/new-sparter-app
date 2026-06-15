---
phase: 50-transaction-pairing
plan: "01"
subsystem: testing
tags: [transaction-pairing, tdd, red-phase, netting, dal, services]
dependency_graph:
  requires: []
  provides:
    - Wave 0 RED test scaffolds for Plans 02–05
    - PAIR-01/PAIR-02/PAIR-03 behavioral contract encoded in tests
  affects:
    - tests/transaction-pairs-service.test.ts
    - tests/transaction-pairs-dal.test.ts
    - tests/dashboard-dal.test.ts
    - tests/transactions-dal.test.ts
tech_stack:
  added: []
  patterns:
    - Vitest dynamic-import RED test pattern (defer module-not-found to test body, not file load)
    - Hoisted vi.hoisted() mocks for ESM module resolution
    - Controllable db.select/insert/delete chain injection (expense-actions.test.ts pattern)
key_files:
  created:
    - tests/transaction-pairs-service.test.ts
    - tests/transaction-pairs-dal.test.ts
  modified:
    - tests/dashboard-dal.test.ts
    - tests/transactions-dal.test.ts
decisions:
  - "Used dynamic `await import(...)` inside test bodies for RED cases referencing absent modules — avoids file-level crash that would break pre-existing GREEN tests"
  - "dashboard-dal.test.ts netting scenario tests use buildOverviewData directly with pre-netted fixtures — pure builder contract, not DAL query contract (query contract tested via RED isNotSecondary/effectiveAmount imports)"
metrics:
  duration: ~20m
  completed: "2026-06-14"
  tasks: 2
  files_created: 2
  files_modified: 2
---

# Phase 50 Plan 01: RED Test Scaffolds Summary

Wave 0 RED test scaffolds for transaction pairing: four test files (two new, two extended) encoding the PAIR-01/PAIR-02/PAIR-03 behavioral contract before any production code exists.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED service + counterpart-picker DAL test scaffolds | 0811d76 | tests/transaction-pairs-service.test.ts, tests/transaction-pairs-dal.test.ts |
| 2 | Extend dashboard-dal + transactions-dal with netting + select-shape contract | a94acd2 | tests/dashboard-dal.test.ts, tests/transactions-dal.test.ts |

## What Was Built

**tests/transaction-pairs-service.test.ts** — RED unit tests for `createPair` and `deletePairByTransactionId` from `@/lib/services/transaction-pairs` (module absent until Plan 03):
- Ownership rejection (IDOR / T-50-01): throws "Non sei autorizzato" when either transaction's userId !== session userId; error message does not expose internal IDs
- Primary resolution (D-10): larger `|amount|` becomes `transactionAId`; silent swap when user initiates from smaller-amount side
- Tie-break by `occurredAt`: earlier date wins when |amounts| are equal
- Double-link guard (T-50-02): surfaces DB unique-constraint violation as thrown Error
- Unlink or-predicate (PAIR-03): `deletePairByTransactionId` issues DELETE with `or(eq(a_id), eq(b_id))` predicate covering both FK sides

**tests/transaction-pairs-dal.test.ts** — RED unit tests for `getEligibleCounterparts` from `@/lib/dal/transaction-pairs` (module absent until Plan 03):
- Session call (verifySession scopes query to userId)
- Self-exclusion via `ne(transaction.id, referenceId)` (D-13)
- Date range `gte(dateFrom)` and `lte(dateTo)` predicates (D-13)
- Opposite-sign filter: gt(amount, 0) for negative referenceAmount, lt(amount, 0) for positive (D-13)
- NOT EXISTS already-paired exclusion referencing `transaction_pair` (D-14)

**tests/dashboard-dal.test.ts** (extended with new `describe('transaction pairing netting')` block):
- `isNotSecondary()` fragment assertions: sql text references `transaction_pair` / `transaction_b_id` (RED — module absent)
- `effectiveAmount()` fragment assertions: CASE WHEN EXISTS + `::numeric` addition (RED — module absent)
- Netting scenario pin: `buildOverviewData` with pre-netted `totalOut=50.00` (primary -100 + secondary +50) returns exactly 50.00 — not 100.00 nor 150.00
- Secondary exclusion: `totalIn=0.00` when secondary (+50) is excluded from IN totals
- ADR 0004 regression guard: `buildOverviewData` with unpaired fixtures produces identical results to pre-pairing baseline

**tests/transactions-dal.test.ts** (extended with new `describe('transaction pairing select-shape contract')` block):
- `pairedWithId` present on `transactionListSelect` as a sql fragment (RED — Plan 04)
- `pairedNetAmount` present as sql fragment with `::numeric` addition cast (RED — Plan 04)
- `pairedDescription` present as sql fragment (RED — Plan 04)
- `pairedOccurredAt` present as sql fragment (RED — Plan 04)
- All four keys accessible via `Object.keys(transactionListSelect)`

## Test State

| File | Pre-existing | New cases | RED state |
|------|-------------|-----------|-----------|
| tests/transaction-pairs-service.test.ts | — (new file) | 14 tests | Cannot find module (RED) |
| tests/transaction-pairs-dal.test.ts | — (new file) | 7 tests | Cannot find module (RED) |
| tests/dashboard-dal.test.ts | 35 GREEN | 4 RED + 4 GREEN | 4 RED (isNotSecondary/effectiveAmount) |
| tests/transactions-dal.test.ts | 32 GREEN | 5 RED | 5 RED (PAIR-02 select-shape) |

## Deviations from Plan

**1. [Rule 1 - Bug] Replaced static import with dynamic import for transaction-pairs-sql in dashboard-dal.test.ts**

- **Found during:** Task 2 — writing dashboard netting tests
- **Issue:** A static `import { isNotSecondary, effectiveAmount } from '@/lib/dal/transaction-pairs-sql'` at module level causes a file-level "Cannot find package" error that crashes the entire test file before any test runs, making all 32 pre-existing tests FAIL. This violates the acceptance criteria "pre-existing baseline cases stay GREEN."
- **Fix:** Moved the import inside each test body as `await import('@/lib/dal/transaction-pairs-sql')`. The error is now scoped to those 4 test bodies, leaving the other 35 tests unaffected.
- **Files modified:** tests/dashboard-dal.test.ts
- **Commit:** a94acd2

## Known Stubs

None — this plan creates test files only, no production code.

## Threat Flags

None — this plan adds no runtime surface (test-only plan per threat model).

## Self-Check: PASSED

Files exist:
- `tests/transaction-pairs-service.test.ts` FOUND
- `tests/transaction-pairs-dal.test.ts` FOUND
- `tests/dashboard-dal.test.ts` FOUND (modified)
- `tests/transactions-dal.test.ts` FOUND (modified)

Commits exist:
- 0811d76 FOUND (Task 1 — service + DAL RED scaffolds)
- a94acd2 FOUND (Task 2 — dashboard + transactions-dal extensions)

Source assertions from acceptance criteria:
- `tests/transaction-pairs-service.test.ts` contains `from '@/lib/services/transaction-pairs'` — PASS
- `tests/transaction-pairs-service.test.ts` references `createPair` and `deletePairByTransactionId` — PASS
- `tests/transaction-pairs-dal.test.ts` contains `from '@/lib/dal/transaction-pairs'` — PASS
- `tests/transaction-pairs-dal.test.ts` references `getEligibleCounterparts` — PASS
- `tests/dashboard-dal.test.ts` contains `isNotSecondary` and `effectiveAmount` — PASS
- `tests/transactions-dal.test.ts` references `pairedWithId`, `pairedNetAmount`, `pairedDescription`, `pairedOccurredAt` — PASS
