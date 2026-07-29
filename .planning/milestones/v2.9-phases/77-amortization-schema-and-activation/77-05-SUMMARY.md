---
phase: 77-amortization-schema-and-activation
plan: 05
subsystem: database
tags: [drizzle, postgres, decimal.js, pgview, vitest]

# Dependency graph
requires:
  - phase: 77-amortization-schema-and-activation (Plan 01)
    provides: ledger_entry_cash pgView, generalized dateScopedTransactions(source, userId, from, to), getOverviewAmountTotals reference migration, LENS-03 byte-identical regression scaffold
  - phase: 77-amortization-schema-and-activation (Plan 04)
    provides: getCategoryDetail's raw-vs-netted top-transactions dual-join pattern (id-to-id join, SELECT stays raw, ORDER BY/aggregate switches to netted), 5-function dashboard.ts migration precedent
provides:
  - getMonthOverMonthCategoryChanges (all 4 sub-queries) and getOverviewChart migrated to ledger_entry_cash (D-11)
  - getTagTotals migrated via the inverted-LEFT-JOIN pattern (zero-transaction tag preserved, exclusion FILTER uniform across count/minDate/maxDate/total)
  - getTagDetail migrated via the dual-join pattern (raw description/occurredAt from transaction, netted amount from ledger_entry_cash)
  - Full 10-function LENS-03 byte-identical regression coverage (dashboard.ts x6 + overview.ts x2 + tags.ts x2) plus a cross-feature (reimbursement + amortization) non-interaction proof
affects: [78-plan-lifecycle-and-reconciliation, 79-amortizations-registry, 80-dashboard-accrual-lens]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ledger_entry_cash row-source swap applied to the remaining category/nature-grouped aggregations: .from(transactionTable) -> .from(ledgerEntryCash), every expenseId join re-anchored on ledgerEntryCash.expenseId, effectiveAmount() -> ledgerEntryCash.amount, isNotSecondary() dropped — completes 8 of 10 call sites now on the direct row-source swap (Plan 77-01 + 77-04 + this plan's overview.ts half)"
    - "Inverted-LEFT-JOIN special case (getTagTotals): when a query is rooted FROM the dimension table (tag) with LEFT JOINs down to transactions so a zero-match row still surfaces, add ONE more id-to-id leftJoin(ledgerEntryCash, eq(ledgerEntryCash.id, transactionTable.id)) after the existing transaction join, then fold `ledgerEntryCash.id IS NOT NULL` into the SAME FILTER predicate already applied uniformly across every aggregate (count/minDate/maxDate/total) — a refund transaction's absent ledger_entry_cash row nulls it out identically to the old isNotSecondary() NOT EXISTS check, without disturbing the LEFT JOIN chain's zero-row-surfacing property"
    - "Dual-join pattern (getTagDetail), same technique as 77-04's getCategoryDetail top-transactions: keep .from(transactionTable) for columns ledger_entry_cash cannot supply (description has no column in the view), add an id-to-id innerJoin(ledgerEntryCash), and let that INNER JOIN itself structurally replace the dropped isNotSecondary() WHERE clause"

key-files:
  created: []
  modified:
    - lib/dal/overview.ts
    - lib/dal/tags.ts
    - tests/tags-dal.test.ts
    - tests/reimbursement-regression.test.ts

key-decisions:
  - "Tagged the existing amortization-scenario probe transaction (previously untagged) so the new getTagTotals/getTagDetail assertions exercise a real row through the dual-join, not the zero-transaction-tag path — a stronger proof of the amount seam than a trivially-zero comparison."
  - "The closing cross-feature non-interaction test isolates its amortization fixture on TWO independent axes (a second category via seedSecondEssentialCategory, and a month 3 calendar months before the N=1 scenario's month) — this protects every one of the 10 functions regardless of whether they group by category id (breakdown/ranking/deviations/MoM/detail) or by month+nature (trend/chart), including getCategoryDeviations' 3-month-prior baseline window which a same-category same-month choice would have silently polluted."

patterns-established: []

requirements-completed: [LENS-03]

coverage:
  - id: D1
    description: "getMonthOverMonthCategoryChanges (allocation-grain and category-grain sub-queries, current and previous month each — 4 sub-queries total) and getOverviewChart migrated to read amount from ledger_entry_cash.amount, no direct effectiveAmount()/isNotSecondary() calls remain in overview.ts"
    requirement: "LENS-03"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts#amortization cash-lens byte-identical (Phase 77, ADR 0019 D-12) — getMonthOverMonthCategoryChanges/getOverviewChart before/after assertions (inherited from Plan 77-04's block, unaffected by this plan's additions)"
        status: pass
    human_judgment: false
  - id: D2
    description: "getTagTotals migrated via the inverted-LEFT-JOIN special case: the FROM-tag LEFT JOIN chain stays unchanged (zero-transaction tag still surfaces), one more id-to-id leftJoin(ledgerEntryCash) added, tagTotalExclusion's isNotSecondary() term replaced with ledgerEntryCash.id IS NOT NULL inside the same FILTER used by count/minDate/maxDate/total"
    requirement: "LENS-03"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts#amortization cash-lens byte-identical — getTagTotals before/after assertion (net -1000.00, dual-join proof)"
        status: pass
      - kind: unit
        ref: "tests/tags-dal.test.ts#getTagTotals (TAG-05 per-tag aggregate) — all 5 tests, including 'never uses innerJoin' zero-safe join-count assertion"
        status: pass
    human_judgment: false
  - id: D3
    description: "getTagDetail migrated via the dual-join pattern: keeps .from(transactionTable) for raw description/occurredAt (ledger_entry_cash has no description column), adds an id-to-id innerJoin(ledgerEntryCash) that structurally replaces the dropped isNotSecondary() WHERE clause, amount column reads ledgerEntryCash.amount"
    requirement: "LENS-03"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts#amortization cash-lens byte-identical — getTagDetail before/after assertion (net -1000.00, raw description 'Amortization probe purchase' preserved)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full 10-function LENS-03 byte-identical coverage reached (dashboard.ts x6 from Plan 77-01/77-04 + overview.ts x2 + tags.ts x2 from this plan) plus a closing cross-feature assertion replaying the file's original N=1 reimbursement scenario against a snapshot that also has amortization data present, proving the two features do not interact"
    requirement: "LENS-03"
    verification:
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts (23/23 tests pass, full file) — new closing 'reimbursement netting and amortization spread do not interact' test"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-07-28
status: complete
---

# Phase 77 Plan 05: DAL Migration Wave 2 (overview.ts + tags.ts) Summary

**Migrated the last 4 gated dashboard aggregation functions (`getMonthOverMonthCategoryChanges`, `getOverviewChart` in `overview.ts`; `getTagTotals`, `getTagDetail` in `tags.ts`) off `effectiveAmount()`/`isNotSecondary()` onto `ledger_entry_cash`, closing full 10-function LENS-03 coverage and proving reimbursement/amortization non-interaction**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-28
- **Tasks:** 2/2 (both plan tasks, executed as 3 atomic commits — one per DAL file plus one test-extension commit, per the work-pacing guidance)
- **Files modified:** 4

## Accomplishments

- All 4 sub-queries in `getMonthOverMonthCategoryChanges` (allocation-grain curr/prev, category-grain curr/prev) and `getOverviewChart`'s single query now `.from(ledgerEntryCash)`, join on `ledgerEntryCash.expenseId`, and read amount from `ledgerEntryCash.amount`; `getOverviewChart`'s `monthSql` buckets by `ledgerEntryCash.occurredAt`.
- `getTagTotals` migrated via the **inverted-LEFT-JOIN special case**: its `FROM tag` root and full LEFT JOIN chain down through `transactionTag → transaction → expense → ... → direction` stayed completely unchanged (a zero-transaction tag still surfaces a row); one additional id-to-id `leftJoin(ledgerEntryCash, eq(ledgerEntryCash.id, transactionTable.id))` was added, and the `tagTotalExclusion` FILTER's `isNotSecondary()` term became `ledgerEntryCash.id IS NOT NULL` — applied inside the exact same FILTER expression used by `count`/`minDate`/`maxDate`/`total`, so a refund transaction is excluded from all four consistently.
- `getTagDetail` migrated via the **dual-join pattern** (same technique 77-04 established for `getCategoryDetail`'s top-transactions query): kept `.from(transactionTable)` because `ledger_entry_cash` has no `description` column, added an id-to-id `innerJoin(ledgerEntryCash)` that structurally replaces the dropped `isNotSecondary()` WHERE clause (a refund transaction has no matching `ledger_entry_cash` row), and switched the `amount` SELECT expression to `ledgerEntryCash.amount`.
- Extended the existing "amortization cash-lens byte-identical" regression block: tagged the previously-untagged probe transaction so the new `getTagTotals`/`getTagDetail` before/after assertions exercise a real dual-joined row (net `-1000.00`, raw description preserved) rather than the trivial zero-transaction-tag case.
- Added the closing **cross-feature non-interaction test**: replays every one of the original N=1 reimbursement regression block's 10 assertions against a snapshot that also has amortization data present elsewhere in the same fixture set (isolated on both category and month axes so it cannot leak into any of the 10 functions' groupings, including `getCategoryDeviations`' 3-month baseline window), proving reimbursement netting and amortization spread coexist without cross-contamination. This is the last of the plan's tasks and closes full 10-function LENS-03 coverage.

## Task Commits

Committed incrementally, one function-group per file plus a separate test commit:

1. **Migrate getMonthOverMonthCategoryChanges/getOverviewChart to ledger_entry_cash (overview.ts)** - `1667c07` (feat)
2. **Migrate getTagTotals/getTagDetail to ledger_entry_cash via dual-join (tags.ts)** - `fb77a8b` (feat, includes the Rule 3 test-mock fix below)
3. **Extend LENS-03 byte-identical proof to full 10-function coverage (reimbursement-regression.test.ts)** - `4c2f9e5` (test)

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## Files Created/Modified

- `lib/dal/overview.ts` - `getMonthOverMonthCategoryChanges`, `getOverviewChart` migrated to `ledgerEntryCash`; unused `transaction` import removed; `effectiveAmount`/`isNotSecondary` import dropped
- `lib/dal/tags.ts` - `getTagTotals` (inverted-LEFT-JOIN + FILTER), `getTagDetail` (dual-join) migrated to `ledgerEntryCash`; two doc comments reworded to avoid the grep acceptance-gate false positive; `effectiveAmount`/`isNotSecondary` import dropped
- `tests/tags-dal.test.ts` - Added `ledgerEntryCash` to the `@/lib/db/schema` mock (Rule 3 fix, see Deviations); reworded a stale comment referencing the removed `transaction-pairs-sql.ts` import
- `tests/reimbursement-regression.test.ts` - Extended the amortization byte-identical block with `getTagTotals`/`getTagDetail` assertions (tagged the probe transaction); added the closing cross-feature non-interaction test

## Decisions Made

- **Tagged the previously-untagged amortization probe transaction.** The existing 77-01/77-04 amortization test created an "Amortization probe" tag but never attached it to the probe transaction, so `getTagTotals`/`getTagDetail` for that tag would only ever exercise the trivial zero-transaction-tag path. Attaching the tag makes the new before/after assertions prove the dual-join actually reads a real netted row (`-1000.00`), a materially stronger proof than a zero-vs-zero comparison.
- **Two-axis isolation for the closing cross-feature test's amortization fixture.** Placing the amortization scenario under the SAME category as the N=1 reimbursement scenario, even in a different month, would have silently landed inside `getCategoryDeviations`' 3-calendar-month baseline window (`month-4` to `month-1` relative to "now") and corrupted the `isNew: true` / `deviation: null` assertion. Using `seedSecondEssentialCategory` (a distinct category id) protects every category-keyed function regardless of date; choosing a different month protects the two nature-keyed functions (`getMonthlyTrendByNature`, `getOverviewChart`) that group by month, not category.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing `ledgerEntryCash` export to `tests/tags-dal.test.ts`'s schema mock**
- **Found during:** Task 2 (Migrate getTagTotals/getTagDetail), running the broader test suite after the DAL migration
- **Issue:** `tests/tags-dal.test.ts` mocks `@/lib/db/schema` with a hand-written object (no `importOriginal`). Adding `ledgerEntryCash` joins to `getTagTotals`/`getTagDetail` made 5 of that file's `getTagTotals` unit tests fail with `No "ledgerEntryCash" export is defined on the "@/lib/db/schema" mock` — a blocking issue directly caused by this plan's own DAL changes, not a pre-existing failure.
- **Fix:** Added `ledgerEntryCash: { id: 'ledgerEntryCash.id', amount: 'ledgerEntryCash.amount' }` to the mock object; reworded a stale comment referencing the removed `transaction-pairs-sql.ts` import (`effectiveAmount()`/`isNotSecondary()`) to describe the current `ledgerEntryCash.amount` read path instead.
- **Files modified:** `tests/tags-dal.test.ts`
- **Verification:** `node_modules/.bin/vitest run tests/tags-dal.test.ts` — 26/26 tests pass (including the pre-existing `leftJoinArgs.length).toBeGreaterThanOrEqual(7)` assertion, which still holds with the new 8th leftJoin).
- **Committed in:** `fb77a8b` (part of the tags.ts migration commit)

---

**Total deviations:** 1 auto-fixed (blocking test-mock fix, directly caused by this plan's own migration)
**Impact on plan:** No scope creep, no behavior change to production code. The fix only extends a test mock's schema surface to match the new query shape.

## Issues Encountered

None beyond the test-mock deviation above. One documentation-only inconsistency noted for awareness, not fixed (out of this plan's file scope): the plan's phase-level `<verification>` block states the final grep should show "zero hits outside `getUncategorizedCount`" across `dashboard.ts`/`overview.ts`/`tags.ts`, but one pre-existing comment in `dashboard.ts`'s `getOverviewAmountTotals` (added in Plan 77-01, explicitly reviewed and kept in Plan 77-04's own deviation log) still mentions `isNotSecondary()` by name at line 487 — outside `getUncategorizedCount`, but also outside this plan's file scope (`overview.ts`/`tags.ts` only). `overview.ts` and `tags.ts` are both independently grep-clean per this plan's own task-level acceptance criteria.

## User Setup Required

None - no external service configuration required. No schema/migration changes in this plan (pure DAL read-path migration against the already-migrated `ledger_entry_cash` view from Plan 77-01).

## Next Phase Readiness

- All 10 of Phase 77's gated aggregation call sites (`dashboard.ts` x6 from Plans 77-01/77-04, `overview.ts` x2 and `tags.ts` x2 from this plan) are now migrated off `effectiveAmount()`/`isNotSecondary()` onto `ledger_entry_cash` — LENS-03's full coverage requirement is met.
- Full test suite green (153 files, 1866 passed, 1 pre-existing todo); `yarn check:language` passes; `tsc --noEmit` clean.
- Phase 78 (plan-lifecycle-and-reconciliation) can now build the write-path lifecycle (closure, realization, reimbursement re-spread, edit guard) against a stable, fully-migrated read seam.
- No blockers identified for the next phase.

---
*Phase: 77-amortization-schema-and-activation*
*Completed: 2026-07-28*

## Self-Check: PASSED

`lib/dal/overview.ts`, `lib/dal/tags.ts`, `tests/tags-dal.test.ts`, and `tests/reimbursement-regression.test.ts` confirmed present on disk with the expected changes (`grep -n "effectiveAmount\|isNotSecondary"` returns zero hits in both `overview.ts` and `tags.ts`). All 3 commit hashes (1667c07, fb77a8b, 4c2f9e5) confirmed present in `git log --oneline`. Full suite (153 files, 1866 tests) and `yarn check:language` both pass as of the final commit.
