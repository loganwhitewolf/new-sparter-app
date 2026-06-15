---
phase: 49-dashboard-and-surfaces
plan: "02"
subsystem: dal
tags: [dashboard, direction-model, algebraic-sum, adr-0012, money-correctness]
dependency_graph:
  requires:
    - 49-01 (RED tests defining the contract)
  provides:
    - Direction-grouped algebraic-sum aggregation in lib/dal/dashboard.ts
    - totalAllocation on OverviewData + OverviewAggregateRow
    - OverviewChartPoint 3-bucket layout (income/out/allocation)
    - direction-aware getMonthOverMonthCategoryChanges
    - fetchMovers with validated direction param
  affects:
    - lib/dal/dashboard.ts
    - lib/dal/overview.ts
    - lib/actions/overview.ts
    - tests/dashboard-dal.test.ts
    - tests/overview-dal.test.ts
tech_stack:
  added: []
  patterns:
    - "Direction-grouped algebraic sum: CASE WHEN direction.code = 'x' THEN amount"
    - "COALESCE(override.natureId, subCategory.natureId) correlated subquery for effective nature"
    - "innerJoin nature+direction for totals; correlated subquery for chart grouping"
    - "sql<'in'|'out'|...> cast for direction.code in categoryType fields"
    - "VALID_DIRECTIONS closed-enum validation in server actions (T-49-02-01)"
key_files:
  created: []
  modified:
    - lib/dal/dashboard.ts
    - lib/dal/overview.ts
    - lib/actions/overview.ts
    - tests/dashboard-dal.test.ts
    - tests/overview-dal.test.ts
decisions:
  - "categoryType fields use sql<union> cast instead of bare direction.code to satisfy TypeScript strict mode"
  - "getOverviewChart uses correlated subquery for direction code (not innerJoin) to avoid WHERE clause issues with leftJoin nulls"
  - "getMonthlyTrendByNature uses leftJoin for direction to preserve uncategorized rows (totalIgn counting)"
metrics:
  duration: "~30 minutes"
  completed: "2026-06-12"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 49 Plan 02: DAL Aggregation Direction-Grouped Rewrite Summary

Direction-grouped algebraic-sum aggregation replacing sign-split stubs across lib/dal/dashboard.ts and lib/dal/overview.ts; totalAllocation surfaced; OverviewChartPoint reshaped to 3-bucket layout; movers + fetchMovers direction-aware. Plan 01 RED tests are now GREEN.

## What Was Built

### Task 1: lib/dal/dashboard.ts rewrite

**Removed:**
- `notTransferCategory()` helper (replaced with `ne(direction.code, 'transfer')` inline)
- `notExcludedFromTotals()` export (replaced with `eq(direction.includedInTotals, true)`)
- `getAggregatedTransactionsData` function (dead code, zero call sites confirmed)

**Added:**
- `direction` and `nature` imports from `@/lib/db/schema`
- `totalAllocation: string | null` on `OverviewAggregateRow`
- `totalAllocation: string` and `deltas.totalAllocation: number | null` on `OverviewData`
- Direction join chain in `getOverviewAmountTotals` using `COALESCE(override.natureId, sub.natureId)` correlated subquery
- Algebraic-sum CASE expressions: `totalIn` (sum where direction='in'), `totalOut` (abs sum where direction='out'), `totalAllocation` (sum where direction='allocation')
- Direction join + `eq(direction.includedInTotals, true)` in `getCategoriesBreakdown`, `getCategoryRanking`, `getCategoryDeviations`, `getCategoryDetail`
- `direction.code` restored as `categoryType` in all 7 query points (cast via `sql<union>`)
- Direction join in `getMonthlyTrendByNature` for `totalIgn` transfer counting

**buildOverviewData:** `computeSavingsRate(totalIn, totalOut)` receives spending-only `totalOut` — allocation excluded per D-06/Pitfall 3.

### Task 2: lib/dal/overview.ts + lib/actions/overview.ts rewrite

**Removed from overview.ts:**
- `OUT_NATURES` array and `OutNature` type (Pitfall 4: included savings/investment/transfer)
- `notTransferCategory()` function
- `notExcludedFromTotals` import from dashboard.ts

**Reshaped:**
- `OverviewChartPoint.out` narrowed to `{ essential; discretionary; debt }`
- `OverviewChartPoint.allocation: { savings; investment }` added (new bucket)
- `emptyOutSegments()` returns 3 keys only
- `emptyAllocationSegments()` new helper: `{ savings, investment }`

**getMonthOverMonthCategoryChanges:**
- New signature: `(year, monthIndex = 0, directionParam: 'in'|'out'|'allocation' = 'out', limit = 10)`
- `allocation` grain: groups by nature (natureTable.id) instead of category — returns at most 2 rows (Risparmio, Investimento)
- `in`/`out` grain: groups by category (unchanged logic)
- `MonthOverMonthChange.natureCode?: string | null` added for allocation grain
- `MonthOverMonthChange.categoryId: number | null` (was `number`; null for allocation grain)

**getOverviewChart:**
- Correlated subquery `directionCodeSql` added alongside `natureSql`
- Routing: direction first (in → income, out → out, allocation → allocation), then nature within bucket
- Transfer excluded via `WHERE ... != 'transfer'` correlated subquery

**fetchMovers (lib/actions/overview.ts):**
- New signature: `(year, monthIndex, direction: 'in'|'out'|'allocation' = 'out')`
- `VALID_DIRECTIONS = ['in','out','allocation'] as const` closed-enum guard (T-49-02-01)
- Returns `{ movers: [], error: 'Parametri non validi.' }` for invalid direction values

### Test updates

- `tests/dashboard-dal.test.ts`: removed `notExcludedFromTotals` import/test; updated `buildOverviewData` calls to include `totalAllocation`; removed all `@ts-expect-error` on `totalAllocation`
- `tests/overview-dal.test.ts`: removed `@ts-expect-error` on `allocation` bucket (now typed on `OverviewChartPoint`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript strict mode: direction.code needs sql<union> cast**
- **Found during:** Task 1 yarn build
- **Issue:** Drizzle infers `direction.code` as `string` (varchar column), but `categoryType` fields in intermediate types require `'in'|'out'|'allocation'|'system'|'transfer'|null`
- **Fix:** Wrapped `direction.code` in `sql<'in'|'out'|'allocation'|'system'|'transfer'|null>\`${direction.code}\`` at all 7 categoryType select sites
- **Files modified:** lib/dal/dashboard.ts
- **Commit:** 95de533 (type fix included in Task 2 commit)

**2. [Rule 2 - Missing critical functionality] notExcludedFromTotals test removed**
- **Found during:** Task 1 — the export `notExcludedFromTotals` was deleted per plan, but a test was asserting it
- **Fix:** Removed the test `it('notExcludedFromTotals() helper builds correct OR predicate')` and the import
- **Files modified:** tests/dashboard-dal.test.ts
- **Commit:** 19c540c

## TDD Gate Compliance

Both tasks used `tdd="true"` mode. This plan is GREEN phase (Plan 01 authored the RED tests).

| Gate | Status | Notes |
|------|--------|-------|
| RED committed | PASSED (Plan 01) | cc068d4, afc7389 |
| GREEN committed | PASSED (Plan 02) | 19c540c, 95de533 |
| REFACTOR | N/A | No cleanup needed |

## Test Run Evidence

```
Test Files  1 failed | 79 passed (80)
Tests       6 failed | 962 passed | 1 todo (969)
```

6 failing tests are the Plan 01 RED cascade-options tests (`buildDirectionNatureMap` — Plan 03/05 deliverable). All dashboard-dal and overview-dal tests are GREEN.

## Known Stubs

None — all `TODO(Phase 49)` markers in dashboard.ts and overview.ts are resolved.

## Threat Flags

None — no new trust boundaries introduced. T-49-02-01 (direction param tampering) was mitigated in fetchMovers per the threat register.

## Self-Check: PASSED

Verified:
- `grep -c 'notExcludedFromTotals|notTransferCategory' lib/dal/dashboard.ts` = 0: YES
- `grep -c 'getAggregatedTransactionsData' lib/dal/dashboard.ts` = 0: YES
- `grep -c 'direction.code' lib/dal/dashboard.ts` > 0: YES (7 occurrences)
- `grep -c 'totalAllocation' lib/dal/dashboard.ts` > 0: YES (11 occurrences)
- `grep -c 'TODO(Phase 49)' lib/dal/dashboard.ts` = 0: YES
- `grep -c 'OUT_NATURES' lib/dal/overview.ts` = 0: YES
- `grep -c 'allocation' lib/dal/overview.ts` > 0: YES
- `grep -c 'TODO(Phase 49)' lib/dal/overview.ts` = 0: YES
- `grep -c 'VALID_DIRECTIONS' lib/actions/overview.ts` > 0: YES
- `yarn test -- dashboard-dal overview-dal` exits with only cascade-options failures: YES
- `yarn build` exits 0: YES
- Commits 19c540c and 95de533 exist in git log: YES
