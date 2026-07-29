---
phase: 80-dashboard-accrual-lens
plan: 02
subsystem: dashboard
tags: [nextjs, drizzle, postgres, decimal.js, dashboard-lens]

# Dependency graph
requires:
  - phase: 80-dashboard-accrual-lens
    provides: "LedgerRowSource type + resolveLedgerRowSource(lens) (lib/dal/dashboard-filters.ts) — the swappable row-source seam this plan reuses unmodified across five more aggregation sites"
provides:
  - "getCategoriesBreakdown, getCategoryRanking, getMonthlyTrendByNature, getCategoryDeviations, getCategoryDetail (lib/dal/dashboard.ts) all gain an optional trailing ledgerRowSource parameter defaulting to ledgerEntryCash"
  - "getCategoryDetail's topTransactionRows sub-query redesigned: FROM ledgerRowSource with a LEFT JOIN back to transaction (display-only), so an amortization instalment row (no matching transaction row) surfaces in the Top 5 movimenti widget under competenza"
  - "tests/amortization-lens-regression.test.ts extended with a real-Postgres assertion covering all five functions under both lenses"
affects: [80-03, 80-04, 80-05, 80-06, 80-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "topTransactionRows display-only join: when a sub-query must DISPLAY raw source fields (description/title) but FILTER/RANK by the resolved ledger amount, the row source itself becomes the FROM target and the display-only table (transaction) is LEFT JOINed back in, with COALESCE providing the graceful-degradation fallback (expense.title / ledger-resolved amount) for rows that have no display-table counterpart"

key-files:
  created: []
  modified:
    - lib/dal/dashboard.ts
    - tests/amortization-lens-regression.test.ts

key-decisions:
  - "getCategoryDetail's topTransactionRows amount COALESCEs the raw transaction.amount FIRST, the ledger row's own amount SECOND — never re-resolves via the ledger source for a real transaction row, preserving the existing byte-identical cash display contract (77-06 regression comment) verbatim"
  - "New regression test uses -30.00/3 months (-10.00 per instalment, no rounding remainder) instead of 80-01's -1000.00/3 — chosen deliberately so the accrual reference amount (10.00) falls BELOW DEVIATION_NOISE_THRESHOLD (15.00) while the cash reference amount (30.00) stays above it, giving getCategoryDeviations an observable cash/accrual difference despite DeviationData carrying no raw amount field"
  - "requirements.mark-complete NOT run for LENS-02 — this plan completes five of the ten aggregation sites (all six dashboard.ts functions are now lens-selectable including 80-01's getOverviewAmountTotals), but LENS-02 requires every dashboard widget, including the tags surfaces and the UI wiring across all four sub-routes (Plans 80-03..80-07)"

patterns-established:
  - "Display-only LEFT JOIN back to the pre-seam table: the technique this plan establishes for any sub-query that must show raw per-row fields (title, description) alongside a ledger-resolved amount, reusable by any future ledger_entry-seam consumer with the same shape"

requirements-completed: []

# Coverage metadata
coverage:
  - id: D1
    description: "getCategoriesBreakdown, getCategoryRanking, getMonthlyTrendByNature each accept a final ledgerRowSource parameter defaulting to ledgerEntryCash; cash output byte-identical, accrual output sums only in-range instalments"
    requirement: "LENS-02"
    verification:
      - kind: integration
        ref: "tests/amortization-lens-regression.test.ts#dashboard accrual lens — remaining category-facing aggregations (Phase 80, Plan 80-02) (real Postgres)"
        status: pass
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts (full 26-test suite, unmodified, run against the new ledgerRowSource parameter)"
        status: pass
    human_judgment: false
  - id: D2
    description: "getCategoryDeviations accepts a second ledgerRowSource parameter; both reference and baseline query blocks read from it; movers/deviations apply no special-case logic to instalment rows (D-07)"
    requirement: "LENS-02"
    verification:
      - kind: integration
        ref: "tests/amortization-lens-regression.test.ts#dashboard accrual lens — remaining category-facing aggregations (Phase 80, Plan 80-02) (belowNoiseThreshold/isNew flip assertion, real Postgres)"
        status: pass
    human_judgment: false
  - id: D3
    description: "getCategoryDetail accepts a third ledgerRowSource parameter; topTransactionRows redesigned to read FROM ledgerRowSource with a LEFT JOIN back to transaction, surfacing an instalment row (title falls back to the Standalone Expense's title) under competenza while staying byte-identical under cassa"
    requirement: "LENS-02"
    verification:
      - kind: integration
        ref: "tests/amortization-lens-regression.test.ts#dashboard accrual lens — remaining category-facing aggregations (Phase 80, Plan 80-02) (topTransactions[0].id === instalmentId assertion, real Postgres)"
        status: pass
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts#amortization cash-lens byte-identical (Phase 77, ADR 0019 D-12) — topTransactions RAW amount unchanged, run unmodified against the redesigned sub-query"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-07-29
status: complete
---

# Phase 80 Plan 02: dashboard-accrual-lens category aggregations Summary

**Migrated the remaining five `lib/dal/dashboard.ts` aggregation functions (getCategoriesBreakdown, getCategoryRanking, getCategoryDeviations, getCategoryDetail, getMonthlyTrendByNature) to the Plan 80-01 `ledgerRowSource` seam, redesigning getCategoryDetail's Top 5 movimenti sub-query with a display-only LEFT JOIN so an amortization instalment row surfaces under competenza.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-29T09:14:35Z
- **Tasks:** 3/3
- **Files modified:** 2

## Accomplishments

- `getCategoriesBreakdown`, `getCategoryRanking`, `getMonthlyTrendByNature` each gain a final optional `ledgerRowSource` parameter (default `ledgerEntryCash`) — mechanical FROM/join/`dateScopedTransactions`/amount-sql swap, zero behavior change for every existing caller
- `getCategoryDeviations` gains a second optional `ledgerRowSource` parameter — both parallel queries (reference + baseline) swapped; `buildDeviationDataset` untouched (operates on already-shaped rows, agnostic to row source)
- `getCategoryDetail` gains a third optional `ledgerRowSource` parameter; its trend and subcategory sub-queries get the same mechanical swap
- `getCategoryDetail`'s **topTransactionRows** sub-query redesigned (not mechanical): now `FROM ledgerRowSource` with a `LEFT JOIN` (not `INNER`) back to `transaction` — an amortization instalment row has no matching `transaction` row and must still surface. `description` coalesces `transaction.description` with `expense.title` (the Standalone Expense's title, the only display source a virtual instalment row has); `amount` coalesces the raw `transaction.amount` first (preserving the byte-identical cash display contract per the 77-06 regression comment) with the ledger row's own already-resolved amount as fallback. `buildCategoryDetailData` required zero code changes — the new fallback values satisfy its existing `customTitle ?? groupTitle ?? description` precedence.
- All six `dashboard.ts` aggregation functions (five here + `getOverviewAmountTotals` from Plan 80-01) are now lens-selectable
- New real-Postgres regression in `tests/amortization-lens-regression.test.ts` proving, for a seeded amortized transaction: (a) cash lens stays byte-identical to the full purchase amount across all five functions; (b) competenza reflects only in-range instalments, with `getCategoryDeviations`' `belowNoiseThreshold`/`isNew` flipping as an emergent consequence of the smaller instalment magnitude (no special-case code), and `getCategoryDetail`'s `topTransactions[0]` resolving to the instalment's own id (not the original transaction's) with the expense's title as fallback description
- Full existing `tests/reimbursement-regression.test.ts` suite (26 tests) confirmed green and unmodified, including the pre-existing "amortization cash-lens byte-identical" assertion on `getCategoryDetail`'s RAW top-transaction amount — proving the topTransactionRows redesign changed the SQL, never the cash-lens observable output

## Task Commits

Each task was committed atomically:

1. **Task 1: Swap getCategoriesBreakdown, getCategoryRanking, getMonthlyTrendByNature to ledgerRowSource** - `8ae9bce7` (feat)
2. **Task 2: Swap getCategoryDeviations (dual query) to ledgerRowSource** - `1a2ae958` (feat)
3. **Task 3: Redesign getCategoryDetail (trend + subcategory swap, topTransactionRows lens-aware) + extend regression** - `2927f692` (feat)

**Plan metadata:** committed separately at end of this SUMMARY's creation.

## Files Created/Modified

- `lib/dal/dashboard.ts` - Five aggregation functions gain an optional trailing `ledgerRowSource` parameter; `getCategoryDetail`'s `topTransactionRows` sub-query redesigned (`FROM ledgerRowSource` + `LEFT JOIN transaction`, COALESCE description/amount fallbacks)
- `tests/amortization-lens-regression.test.ts` - New `describeIfReachable` block asserting all five functions under both lenses (real Postgres)

## Decisions Made

- **`topTransactionRows`'s amount COALESCE order is raw-transaction-first.** `coalesce(transaction.amount, ledgerRowSource.amount)` — never the reverse — because a real transaction row's RAW un-netted amount is the existing, verified cash-lens display contract (77-06 regression comment); the ledger row's amount is only consulted when no transaction row exists (an instalment, which has no netting applied to it in the first place).
- **New regression uses `-30.00`/3 months (`-10.00` per instalment, no rounding remainder) instead of 80-01's `-1000.00`/3.** Chosen specifically so the accrual reference amount (10.00) falls below `DEVIATION_NOISE_THRESHOLD` (15.00) while the cash reference amount (30.00) stays above it — the only way to make `getCategoryDeviations`' cash/accrual difference observable given `DeviationData` carries no raw amount field, only `deviation`/`isNew`/`belowNoiseThreshold`.
- **`requirements.mark-complete` NOT run for LENS-02.** This plan completes five of the ten aggregation sites (all six `dashboard.ts` functions, including 80-01's `getOverviewAmountTotals`, are now lens-selectable), but LENS-02 ("every dashboard widget... reflects instalments") also requires the tags surfaces and the UI wiring across all four sub-routes, which ship in Plans 80-03 through 80-07. Consistent with 80-01's own precedent and the Phase 75/76 established pattern.

## Deviations from Plan

None - plan executed exactly as written. All task actions, acceptance criteria, and the new regression test matched the plan's `<action>` blocks verbatim (grep counts, join direction, COALESCE order, test scenario shape).

## Issues Encountered

None. All automated verification passed on the first attempt:
- `yarn db:up && yarn test tests/reimbursement-regression.test.ts` — green after Task 1 and Task 2 (26/26)
- `yarn db:up && yarn test tests/amortization-lens-regression.test.ts tests/reimbursement-regression.test.ts` — green after Task 3 (28/28, including the 1 new test)
- Full suite: 158 test files, 1933 tests passing (+1 new), 1 pre-existing todo
- `tsc --noEmit` — clean after every task
- `yarn check:language` — passed
- `yarn build` — production build succeeds; all 34 routes compile and register; no new warnings
- `grep -Fc 'effectiveAmount(' lib/dal/dashboard.ts` / `grep -Fc 'isNotSecondary(' lib/dal/dashboard.ts` — both 0 (no double-netting regression)
- `grep -c 'ledgerRowSource' lib/dal/dashboard.ts` — 30 (well over the plan's +12 floor for Task 1 alone)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All six `dashboard.ts` aggregation functions are lens-selectable; the seam pattern (mechanical swap + the new display-only LEFT JOIN technique for row-level display fields) is proven and ready for reuse by Plans 80-03 through 80-07 (the remaining aggregation sites in `overview.ts`/`tags.ts`, `getYearsWithData`/`getMonthsWithData` lens-awareness (D-09/D-10), and the UI wiring across the four dashboard sub-routes).
- No known gaps or blockers. The tag surfaces (`getTagTotals`/`getTagDetail`) are explicitly out of scope for this plan and stay lens-invariant per D-05/D-06 — untouched here.

## Self-Check: PASSED

- FOUND: lib/dal/dashboard.ts (ledgerRowSource param on getCategoriesBreakdown/getCategoryRanking/getCategoryDeviations/getCategoryDetail/getMonthlyTrendByNature)
- FOUND: tests/amortization-lens-regression.test.ts (new describeIfReachable block)
- FOUND commit: 8ae9bce7
- FOUND commit: 1a2ae958
- FOUND commit: 2927f692

---
*Phase: 80-dashboard-accrual-lens*
*Completed: 2026-07-29*
