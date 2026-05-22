---
phase: "21"
plan: "04"
---

# T04: Extended MonthlyTrendChart from BarChart to ComposedChart with balance Line series and per-point colored BalanceDot (green/red based on sign)

**Extended MonthlyTrendChart from BarChart to ComposedChart with balance Line series and per-point colored BalanceDot (green/red based on sign)**

## What Happened

Refactored `components/dashboard/monthly-trend-chart.tsx` to switch from `BarChart` to `ComposedChart`. Added a `balance` series computed in `useMemo` using `toDecimal(totalIn).minus(toDecimal(totalOut)).toNumber()` — Decimal.js used throughout per project rule, no native JS arithmetic on monetary values. Introduced a `BalanceDot` render-prop component: renders a green dot (`var(--total-in)`) for balance >= 0, red (`var(--color-destructive)`) for negative. The balance `Line` uses `strokeWidth={2}` with `activeDot={false}` to keep interaction clean. Extended `SeriesKey` union and `trendChartConfig` to include the balance entry. Added the balance toggle button to the series array. All four existing bar series (`totalIn`, `totalOut`, `totalNc`, `totalIgn`) are preserved unchanged. The `MonthlyTrendPoint[]` prop type is untouched — no DAL changes required. A `ChartPoint` internal type was introduced to give the chartData shape explicit typing, ensuring the `BalanceDot` payload prop is type-safe.

## Verification

Ran `yarn tsc --noEmit` — no errors in `monthly-trend-chart.tsx` or any dashboard file. Pre-existing errors in `.next/types` (unrelated patterns route) and `pattern-actions.test.ts` are not introduced by this task. Balance computation uses Decimal.js exclusively: `toDecimal(point.totalIn).minus(toDecimal(totalOut)).toNumber()`. BalanceDot color logic branches on `payload.balance >= 0`.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn tsc --noEmit 2>&1 | grep 'monthly-trend-chart' || echo 'No errors in monthly-trend-chart.tsx'` | 0 | pass | 12000ms |
| 2 | `yarn tsc --noEmit 2>&1 | grep 'dashboard' || echo 'No errors in dashboard files'` | 0 | pass | 12000ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `components/dashboard/monthly-trend-chart.tsx`
