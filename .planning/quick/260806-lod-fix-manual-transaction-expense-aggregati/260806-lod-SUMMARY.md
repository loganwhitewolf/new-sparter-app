---
phase: 260806-lod
plan: 01
subsystem: database
tags: [drizzle, decimal.js, postgres, dal]

# Dependency graph
requires:
  - phase: SEED-005 (telegram capture bot, decision D14)
    provides: locked decision that insertManualTransactionTx must mirror import.ts's
      get-or-create + accumulate Expense semantics
provides:
  - insertManualTransactionTx get-or-create + accumulate Expense by (userId, descriptionHash)
  - manual-lock preservation of an already-set subCategoryId
  - real-Postgres regression coverage for repeated-description manual entries
affects: [manual-entry, expense-aggregation, telegram-capture-bot]

# Actuals (#2632)
actuals:
  tokens: 2283
  tasks: 1
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "get-or-create + accumulate Expense upsert (mirrors lib/services/import.ts's
      'Upsert expense by (userId, descriptionHash)' block) now shared conceptually
      between the import path and the manual-entry path"

key-files:
  created:
    - tests/manual-transaction-expense-aggregation.test.ts
  modified:
    - lib/dal/transactions.ts

key-decisions:
  - "insertManualTransactionTx now SELECTs the Expense by (userId, descriptionHash) before
    deciding insert-vs-update, instead of unconditionally inserting — closes the PG 23505
    unique violation on a repeated manual description"
  - "Manual lock: shouldApplySubCategory = existing.subCategoryId == null && data.subCategoryId
    != null — an already-categorized expense is never re-categorized by a later manual entry"
  - "firstTransactionAt/lastTransactionAt widen via plain Date comparison against the existing
    values (not always-forward), so a backdated manual entry still sets the min/max correctly"

patterns-established:
  - "Any future manual-entry write path touching Expense aggregates should reuse this
    get-or-create branch shape rather than re-deriving it from import.ts independently"

requirements-completed: [MANUALTX-01, MANUALTX-02, MANUALTX-03]

coverage:
  - id: D1
    description: "Two manual transactions with the same description accumulate into ONE
      expense (no PG 23505), correct totalAmount/transactionCount, and
      firstTransactionAt/lastTransactionAt widen correctly regardless of insertion order"
    requirement: "MANUALTX-01"
    verification:
      - kind: unit
        ref: "tests/manual-transaction-expense-aggregation.test.ts#two manual transactions with the same description resolve into ONE expense with correct aggregates, regardless of insertion order"
        status: pass
    human_judgment: false
  - id: D2
    description: "An already-categorized expense's subCategoryId is never overwritten by a
      later manual entry supplying a different one (manual lock)"
    requirement: "MANUALTX-02"
    verification:
      - kind: unit
        ref: "tests/manual-transaction-expense-aggregation.test.ts#never overwrites an already-set subCategoryId when a later manual entry supplies a different one (manual lock)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A caller-supplied subCategoryId is applied (status becomes '3') only when the
      existing expense has none yet"
    requirement: "MANUALTX-02"
    verification:
      - kind: unit
        ref: "tests/manual-transaction-expense-aggregation.test.ts#applies the caller-supplied subCategoryId (and sets status 3) when the existing expense has none yet"
        status: pass
    human_judgment: false
  - id: D4
    description: "A single call with a brand-new description still creates exactly one new
      expense with transactionCount 1 (no regression on the pre-existing insert-only path)"
    requirement: "MANUALTX-03"
    verification:
      - kind: unit
        ref: "tests/manual-transaction-expense-aggregation.test.ts#a single call with a brand-new description still creates exactly one new expense with transactionCount 1 (no regression)"
        status: pass
    human_judgment: false
  - id: D5
    description: "insertManualTransactionTx's signature and { transactionId, expenseId } return
      shape stay byte-identical; the pre-existing create+amortize composition regression suite
      passes unmodified"
    requirement: "MANUALTX-03"
    verification:
      - kind: unit
        ref: "tests/amortization-manual-entry.test.ts (all 4 tests)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-06
status: complete
---

# Quick Task 260806-lod: Manual-Entry Expense Aggregation Fix Summary

**Fixed PG 23505 on repeated manual-transaction descriptions by aligning `insertManualTransactionTx` to import.ts's get-or-create + accumulate Expense semantics (SEED-005 D14).**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-06T15:35:00+02:00 (approx)
- **Completed:** 2026-08-06T15:47:34+02:00
- **Tasks:** 1
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- `insertManualTransactionTx` now SELECTs the Expense by `(userId, descriptionHash)` before
  deciding whether to insert a new one or update the existing one — eliminates the PG 23505
  unique violation a second manual entry with a repeated description used to hit.
- Aggregates (`totalAmount` via Decimal.js, `transactionCount`, `firstTransactionAt`/
  `lastTransactionAt`) accumulate/widen correctly regardless of chronological insertion order.
- Manual lock: an already-categorized expense's `subCategoryId` is never silently overwritten
  by a later manual entry; an uncategorized expense can still be categorized by a later entry.
- New real-Postgres regression suite (`tests/manual-transaction-expense-aggregation.test.ts`,
  4 tests) proves all of the above directly against `insertManualTransactionTx`.
- `tests/amortization-manual-entry.test.ts` (the pre-existing create+amortize composition
  regression, 4 tests) passes unmodified — `insertManualTransactionTx`'s signature and return
  shape are byte-identical.

## Task Commits

Each task was committed atomically:

1. **Task 1: Get-or-create + accumulate Expense in insertManualTransactionTx (D14)** - `d819fed6` (fix)

**Plan metadata:** commit deferred to orchestrator's docs commit step.

## Files Created/Modified
- `lib/dal/transactions.ts` - `insertManualTransactionTx` rewritten to get-or-create the
  Expense by `(userId, descriptionHash)` and accumulate aggregates instead of unconditionally
  inserting a new Expense row.
- `tests/manual-transaction-expense-aggregation.test.ts` - new real-Postgres regression test
  (dedup-accumulate, manual-lock preservation, apply-when-none, no-regression-on-new-description).

## Decisions Made
- Followed the plan's `<action>` block literally: SELECT-then-branch shape, manual-lock
  predicate, Date-based min/max widening, and the exact `updatePayload` type shape mirroring
  `lib/services/import.ts`'s own `updatePayload` object. No deviation from the locked plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The manual-entry write path (`insertManualTransactionTx`) now matches the import path's
  Expense upsert semantics — future SEED-005 work (Telegram capture bot) can compose on top of
  this without re-deriving the get-or-create logic.
- Out of scope by design (per the locked plan): no `lib/services/manual-entry.ts` extraction
  (SEED-005 D18, gated on a second write channel existing), no schema migration, no change to
  `createTransaction`'s generic error-catch copy.

---
*Phase: 260806-lod*
*Completed: 2026-08-06*

## Self-Check: PASSED

- FOUND: lib/dal/transactions.ts
- FOUND: tests/manual-transaction-expense-aggregation.test.ts
- FOUND: .planning/quick/260806-lod-fix-manual-transaction-expense-aggregati/260806-lod-SUMMARY.md
- FOUND: d819fed6 (task commit)
