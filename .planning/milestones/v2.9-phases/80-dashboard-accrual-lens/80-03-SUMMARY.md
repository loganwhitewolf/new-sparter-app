---
phase: 80-dashboard-accrual-lens
plan: 03
subsystem: dashboard
tags: [nextjs, drizzle, postgres, decimal.js, sql, url-state]

# Dependency graph
requires:
  - phase: 80-dashboard-accrual-lens (Plan 80-01)
    provides: LedgerRowSource type + resolveLedgerRowSource(lens) (lib/dal/dashboard-filters.ts), Lens type + parseLensParam(value) (lib/utils/search-params.ts), the ledgerRowSource-parameter pattern proven on getOverviewAmountTotals/getOverview
provides:
  - "getMonthOverMonthCategoryChanges and getOverviewChart (lib/dal/overview.ts) both gain an optional trailing ledgerRowSource parameter, defaulting to ledgerEntryCash — the movers drill-down and 12-month bar chart are now lens-selectable"
  - "getYearsWithData (lib/dal/overview.ts) gains an optional lens: Lens = 'cassa' parameter; the cash branch is byte-for-byte untouched raw SQL, the competenza branch additively UNIONs amortization_instalment years so a future instalment-only year is never hidden (D-09, LENS-05)"
  - "getMonthsWithData (lib/dal/months-with-data.ts) gains an optional lens: Lens = 'cassa' parameter for the 'transactions' branch only; the 'files' branch ignores it entirely — no current dashboard route consumes this yet"
  - "resolveYear (components/dashboard/overview/resolve-year.ts) gains an optional yearsForOtherLens?: string[] parameter implementing the D-10 cross-lens clamp: a period valid only in the OTHER lens clamps to the active lens's latest year instead of an empty/misleading fallback"
  - "tests/amortization-lens-regression-overview.test.ts — new real-Postgres regression proving getMonthOverMonthCategoryChanges/getOverviewChart stay cash byte-identical and correctly surface a future instalment-only month under competenza"
affects: [80-04, 80-05, 80-06, 80-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Navigation lens-awareness is architecturally distinct from the netting-fragment ledgerRowSource pattern: getYearsWithData/getMonthsWithData take a lens: Lens parameter and branch internally (cash branch = untouched raw SQL, competenza branch = additive UNION against amortization_instalment) — they never take a LedgerRowSource object, because this function counts 'any activity', not a netted total"
    - "Cross-lens fallback clamp: resolveYear's yearsForOtherLens parameter distinguishes 'requested is a stale bookmark' (generic current-year/most-recent fallback) from 'requested came from a lens switch' (clamp to the active lens's latest year) — same pure-function, no-side-effects shape as the original"

key-files:
  created:
    - tests/amortization-lens-regression-overview.test.ts
    - tests/resolve-year.test.ts
  modified:
    - lib/dal/overview.ts
    - lib/dal/months-with-data.ts
    - components/dashboard/overview/resolve-year.ts
    - tests/overview-dal.test.ts
    - tests/months-with-data-dal.test.ts

key-decisions:
  - "getYearsWithData's competenza branch and getMonthsWithData's competenza branch both read directly from `transaction`/`amortization_instalment` via UNION ALL, never ledgerEntryCash/ledgerEntryAccrual — those views' cash branch excludes refund-linked secondary rows via NOT EXISTS, which would silently drop a refund-transaction's year/month from these functions' output. These are navigation functions ('any activity'), not netting aggregations ('netted total')."
  - "getYearsWithData's cash branch is left as a separate, unindented early-return statement AFTER a competenza early-return block, rather than nested inside an `if (lens === 'cassa') { ... }` — preserves the exact original line content/indentation for the cash path (verified via git diff: only additive lines above it, zero changes inside the pre-existing block), satisfying the plan's zero-diff acceptance criterion literally rather than just behaviorally."
  - "requirements.mark-complete NOT run for LENS-04/LENS-05 in this plan — LENS-04/LENS-05 also require the year-selector UI to actually call getYearsWithData(lens)/getMonthsWithData(table, lens) and pass yearsForOtherLens into resolveYear, which is UI-wiring work left to a later Wave in this phase (Plans 80-04..80-07); this plan delivers only the DAL/pure-function backend those UI changes will consume."

patterns-established:
  - "Navigation vs. aggregation seam distinction: a DAL function that counts 'does any activity exist in period X' takes a `lens: Lens` string and branches its own SQL; a DAL function that aggregates/nets amounts takes a `LedgerRowSource` object and swaps its FROM/dateScopedTransactions target. Never conflate the two — T-80-06's threat register entry documents exactly why."

requirements-completed: []

# Coverage metadata
coverage:
  - id: D1
    description: "getMonthOverMonthCategoryChanges and getOverviewChart accept an optional trailing ledgerRowSource parameter (default ledgerEntryCash); all four getMonthOverMonthCategoryChanges query blocks and getOverviewChart's single query read from it"
    requirement: "LENS-02"
    verification:
      - kind: integration
        ref: "tests/amortization-lens-regression-overview.test.ts#dashboard accrual lens — movers + bar chart seam (Phase 80, Plan 80-03, ADR 0019 §10) (real Postgres)"
        status: pass
      - kind: integration
        ref: "tests/reimbursement-regression.test.ts (full suite, unmodified, run against the new parameter)"
        status: pass
    human_judgment: false
  - id: D2
    description: "getOverviewChart under competenza shows a non-zero out bucket for a future month past the current calendar month, driven only by a materialized instalment with no transaction row (LENS-04)"
    requirement: "LENS-04"
    verification:
      - kind: integration
        ref: "tests/amortization-lens-regression-overview.test.ts#dashboard accrual lens — movers + bar chart seam (Phase 80, Plan 80-03, ADR 0019 §10)"
        status: pass
    human_judgment: false
  - id: D3
    description: "getMonthOverMonthCategoryChanges under competenza fires isNew:true for a plan's first instalment month with no special-case suppression (D-07)"
    requirement: "LENS-02"
    verification:
      - kind: integration
        ref: "tests/amortization-lens-regression-overview.test.ts#dashboard accrual lens — movers + bar chart seam (Phase 80, Plan 80-03, ADR 0019 §10)"
        status: pass
    human_judgment: false
  - id: D4
    description: "getYearsWithData gains an optional lens parameter; the cash branch is byte-for-byte untouched raw SQL; the competenza branch additively unions amortization_instalment years"
    requirement: "LENS-05"
    verification:
      - kind: unit
        ref: "tests/overview-dal.test.ts#getYearsWithData"
        status: pass
      - kind: manual_procedural
        ref: "git diff lib/dal/overview.ts — zero line changes inside the pre-existing cash-branch statement block (only additive lines above it)"
        status: pass
    human_judgment: false
  - id: D5
    description: "getMonthsWithData gains an optional lens parameter for the 'transactions' branch only; the 'files' branch ignores it entirely"
    requirement: "LENS-05"
    verification:
      - kind: unit
        ref: "tests/months-with-data-dal.test.ts#getMonthsWithData"
        status: pass
    human_judgment: false
  - id: D6
    description: "resolveYear gains an optional yearsForOtherLens parameter implementing the D-10 cross-lens clamp, with the pre-existing single-lens contract preserved when the parameter is omitted"
    requirement: "LENS-05"
    verification:
      - kind: unit
        ref: "tests/resolve-year.test.ts"
        status: pass
    human_judgment: false

# Metrics
duration: ~11min
completed: 2026-07-29
status: complete
---

# Phase 80 Plan 03: dashboard-accrual-lens netting-fragment migration + lens-aware navigation Summary

**Migrated the movers drill-down (`getMonthOverMonthCategoryChanges`) and 12-month bar chart (`getOverviewChart`) to the `ledgerRowSource` pattern, and separately made `getYearsWithData`/`getMonthsWithData` lens-aware via an additive UNION against `amortization_instalment` — so an accrual-only future instalment year/month is never hidden from the selector, with `resolveYear` clamping a cross-lens period mismatch to the active lens's latest year.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-07-29T09:16:00Z
- **Completed:** 2026-07-29T09:26:38Z
- **Tasks:** 2/2
- **Files modified:** 8 (6 modified, 2 created)

## Accomplishments

- `getMonthOverMonthCategoryChanges` (lib/dal/overview.ts) — all four query blocks (allocation current/previous, category current/previous) now read from an optional trailing `ledgerRowSource` parameter (default `ledgerEntryCash`), swapping `.from()`/join/`dateScopedTransactions()`/amount-`sql` in each
- `getOverviewChart` (lib/dal/overview.ts) — its single nature-keyed monthly query gains the same `ledgerRowSource` parameter; `natureSql`/`directionCodeSql` correlated subqueries left untouched (unaffected by which row source supplies the amount)
- `getYearsWithData` (lib/dal/overview.ts) — gains `lens: Lens = 'cassa'`; the cash branch's exact original statement is preserved as a separate early-return AFTER a new competenza early-return block, so `git diff` shows zero line changes inside the pre-existing cash path (T-80-06 mitigated literally, not just behaviorally); the competenza branch UNIONs `transaction`/`amortization_instalment` occurred_at columns directly — never `ledgerEntryCash`/`ledgerEntryAccrual`, since those views' `NOT EXISTS` refund-exclusion would silently drop a refund year
- `getMonthsWithData` (lib/dal/months-with-data.ts) — gains `lens: Lens = 'cassa'` for the `'transactions'` branch only; `'files'` branch untouched (D-09 explicit requirement, no current caller consumes the new parameter yet)
- `resolveYear` (components/dashboard/overview/resolve-year.ts) — gains an optional `yearsForOtherLens?: string[]` third parameter; when `requested` exists only in `yearsForOtherLens` (not the active lens's `years`), clamps to `years[0]` instead of falling through to the current-year/most-recent fallback (D-10)
- `tests/amortization-lens-regression-overview.test.ts` (new) — real-Postgres proof: seeds a -600.00 outflow with a 3-month plan; cash stays byte-identical (600.00, isNew:true) for both movers and the chart; competenza fires isNew:true for the first instalment month (no special-case suppression, D-07) and shows the future month-(N+2) bar-chart bucket non-zero from the instalment alone, with no `transaction` row that month (LENS-04)
- `tests/resolve-year.test.ts` (new), `tests/overview-dal.test.ts`/`tests/months-with-data-dal.test.ts` (extended) — unit coverage for every new lens/yearsForOtherLens parameter, confirming omitted/`'cassa'` calls are unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Swap getMonthOverMonthCategoryChanges + getOverviewChart to ledgerRowSource** - `7c2d10a` (feat)
2. **Task 2: Lens-aware getYearsWithData/getMonthsWithData + resolveYear cross-lens clamp** - `c6a89c5` (feat)

**Plan metadata:** committed separately at end of this SUMMARY's creation.

## Files Created/Modified

- `lib/dal/overview.ts` - `getMonthOverMonthCategoryChanges`/`getOverviewChart` gain `ledgerRowSource`; `getYearsWithData` gains `lens`
- `lib/dal/months-with-data.ts` - `getMonthsWithData` gains `lens` for the `'transactions'` branch
- `components/dashboard/overview/resolve-year.ts` - `resolveYear` gains `yearsForOtherLens` (D-10 clamp)
- `tests/amortization-lens-regression-overview.test.ts` (new) - real-Postgres cash/accrual proof, sibling of Plan 80-01's harness file
- `tests/resolve-year.test.ts` (new) - unit tests for `resolveYear`'s full fallback contract including D-10
- `tests/overview-dal.test.ts` - extended `getYearsWithData` describe block with lens-parameter tests
- `tests/months-with-data-dal.test.ts` - extended both `'transactions'`/`'files'` describe blocks with lens-parameter tests

## Decisions Made

- **getYearsWithData/getMonthsWithData's competenza branches read `transaction`/`amortization_instalment` directly via `UNION ALL`, never `ledgerEntryCash`/`ledgerEntryAccrual`.** These are navigation functions ("does any activity exist in this period") not netting aggregations ("what is the netted total") — the ledger views' `NOT EXISTS` refund-exclusion would silently drop a refund-transaction's year/month, a real regression this plan's threat register (T-80-06) explicitly calls out.
- **getYearsWithData's cash-branch code is a separate unindented early-return statement placed AFTER the new competenza early-return, not nested inside an `if (lens === 'cassa') {...}` block.** Wrapping it in an if-block would re-indent every line by one level, which would show as a line-by-line diff even though the SQL text itself is unchanged — defeating the plan's own "zero line changes inside the cash path" acceptance criterion. The chosen structure keeps the pre-existing statement byte-for-byte identical; `git diff` on the final file confirms only additive lines above it.
- **`requirements.mark-complete` NOT run for LENS-04/LENS-05.** This plan delivers the DAL/pure-function backend (lens-selectable aggregation functions, lens-aware navigation, cross-lens clamp) but LENS-04/LENS-05's full user-facing capability also requires the year-selector UI to call these functions with a resolved lens and thread `yearsForOtherLens` into `resolveYear` — that UI wiring is scoped to later plans in this phase's Wave. Consistent with the Phase 75/76/80-01/80-02 precedent of deferring `requirements.mark-complete` until the complete capability ships.

## Deviations from Plan

None - plan executed exactly as written. The `git diff`-verified indentation choice for `getYearsWithData`'s cash branch (documented above as a Decision) is a structural implementation choice within the plan's own literal acceptance criterion, not a deviation from it.

## Issues Encountered

None. All automated verification passed on the first attempt:
- `yarn db:up && yarn test tests/amortization-lens-regression-overview.test.ts tests/reimbursement-regression.test.ts` — 27/27 passing (Task 1's `<verify>`)
- `yarn test tests/overview-dal.test.ts tests/months-with-data-dal.test.ts tests/resolve-year.test.ts` — 40/40 passing (Task 2's `<verify>`)
- Plan-level `<verification>`: `yarn db:up && yarn test tests/reimbursement-regression.test.ts tests/overview-dal.test.ts tests/months-with-data-dal.test.ts tests/resolve-year.test.ts` — 66/66 passing
- Full suite: 160 test files, 1950 tests passing, 1 pre-existing todo
- `tsc --noEmit` — clean
- `yarn check:language` — passed
- `yarn build` — production build succeeds, all routes compile including `/dashboard/overview`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `getMonthOverMonthCategoryChanges`, `getOverviewChart`, `getYearsWithData`, `getMonthsWithData`, and `resolveYear` are all proven and ready for the remaining Wave plans (80-04..80-07) to wire into the actual `/dashboard/overview` year-selector UI and the other dashboard sub-routes' aggregation call sites.
- **Known gap (inherited, not introduced by this plan):** the year-selector UI does not yet call `getYearsWithData(lens)`/`getMonthsWithData(table, lens)` with a resolved lens, nor does `/dashboard/overview` pass `yearsForOtherLens` into `resolveYear` — this plan built the backend those UI changes will consume; the wiring itself is scoped to a later plan in this phase.

## Self-Check: PASSED

- FOUND: tests/amortization-lens-regression-overview.test.ts
- FOUND: tests/resolve-year.test.ts
- FOUND: .planning/phases/80-dashboard-accrual-lens/80-03-SUMMARY.md
- FOUND commit: 7c2d10a
- FOUND commit: c6a89c5

---
*Phase: 80-dashboard-accrual-lens*
*Completed: 2026-07-29*
