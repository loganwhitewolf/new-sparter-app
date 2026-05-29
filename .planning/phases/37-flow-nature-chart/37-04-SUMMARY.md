---
phase: 37-flow-nature-chart
plan: 04
subsystem: ui
tags: [recharts, dashboard, nature-chart, url-state, react]

requires:
  - phase: 37-01
    provides: NATURE_ORDER, NATURE_LABELS, NATURE_COLORS from nature-labels.ts
  - phase: 37-03
    provides: getMonthlyTrendByNature, MonthlyNatureTrendPoint from lib/dal/dashboard.ts

provides:
  - Stacked BarChart with one Bar per FlowNature segment (+ unclassified) replacing two-bar In/Out chart
  - URL-persisted legend toggles via ?hidden= param (useSearchParams + router.replace + startTransition)
  - Overview page calls getMonthlyTrendByNature + getAggregatedTransactionsData in parallel

affects:
  - 37-05 (settings UI can now reference the same FlowNature segments)

tech-stack:
  added: []
  patterns:
    - URL-persisted UI state via searchParams + router.replace + startTransition
    - Custom ChartLegendContent wrapper with onClick for toggle behavior

key-files:
  created: []
  modified:
    - components/dashboard/entrate-uscite-chart.tsx
    - app/(app)/dashboard/overview/page.tsx

key-decisions:
  - "Unclassified segment rendered only when at least one month has non-zero null-nature amount"
  - "?hidden= param removed from URL when all natures visible (D-03 compliance)"
  - "BilancioBarsChart and getAggregatedTransactionsData left unmodified — parallel Promise.all"

patterns-established:
  - "URL-persisted chart legend: useSearchParams + router.replace + startTransition pattern"

requirements-completed:
  - R-FN-04
  - R-FN-05
  - R-FN-06

duration: ~30min
completed: 2026-05-26
---

# Plan 37-04: EntrateUsciteChart Rewrite Summary

**Stacked nature-segmented BarChart with URL-persisted legend toggles replacing the two-bar In/Out chart**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-05-26
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced two-bar In/Out chart with stacked BarChart grouped by FlowNature segments (R-FN-04)
- URL-persisted legend toggle via `?hidden=` param using `useSearchParams` + `router.replace` + `startTransition` (R-FN-05)
- Custom legend renders Italian nature labels; unclassified segment shown only when data present (D-05)
- Overview page calls `getMonthlyTrendByNature` + `getAggregatedTransactionsData` in parallel; BilancioBarsChart unchanged
- All 7 `dashboard-charts.test.tsx` tests GREEN; tsc and `check:language` pass (R-FN-06)

## Task Commits

1. **Task 1: Rewrite chart tests for nature-segmented assertions [RED]** - `af960f5` (test)
2. **Task 2: Rewrite EntrateUsciteChart + wire overview page** - `d03f4ec` (feat)

## Files Created/Modified

- `components/dashboard/entrate-uscite-chart.tsx` — Stacked nature BarChart, URL toggle logic, custom legend
- `app/(app)/dashboard/overview/page.tsx` — Parallel DAL calls, both charts wired

## Decisions Made

- Unclassified segment uses Italian label "Non classificato" and is omitted from the chart when all months have zero unclassified amounts
- When the hidden set becomes empty after toggling, `?hidden=` param is removed from the URL (D-03)
- `BilancioBarsChart` receives original `getAggregatedTransactionsData` output unchanged — no migration of that chart

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Wave 3 partially complete: 37-04 done, 37-05 pending (settings UI: nature field on subcategory creation + inline Select override)
- `effectiveNature` from `getCategoriesForUser` (37-03) ready for consumption in 37-05

---
*Phase: 37-flow-nature-chart*
*Completed: 2026-05-26*
