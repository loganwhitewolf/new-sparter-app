# Quick Task 260711-gfd: Dashboard-wide filter chips + sustainability default

## Goal (user decision 2026-07-11, option B)

The chart's nature chips (Ricorrenti/Straordinarie · Essenziale/Discrezionale/Debiti ·
Risparmio/Investimento) stop being chart-local and drive the WHOLE dashboard — KPI cards
included. Default selection answers the sustainability question: **recurring income vs
all spending** (Straordinarie excluded by default). This supersedes the hardcoded
"structural" card variants: with the default selection, Bilancio's hero IS the
structural balance and Tasso's hero IS the structural rate — emerging from the filter,
not from dual display.

## Why (diagnosis)

- KPI cards were static snapshots; the chart filtered but the cards didn't follow —
  two divergent stories on one screen.
- The most interesting default number is "do recurring incomes cover all spending".

## Architecture

- Chart points (`OverviewChartPoint[]`) carry the exact same nature buckets as the KPI
  aggregate → **KPIs are derivable client-side** by summing filtered points (Decimal.js).
- Filtered YoY deltas need prior-year points → fetch `getOverviewChart(year - 1)` in
  parallel (empty/zero prior year → null deltas, existing null-delta handling).
- Filter state lifts from `OverviewChart` to a new client wrapper that renders
  chips → KpiRow → movers section. sessionStorage persistence reused as-is
  (stored EXCLUDED keys; **absence now means the sustainability default**, not all-on).

## Tasks

1. **`overview-kpi-derive.ts`** (new, pure): `deriveFilteredKpis(points, prevPoints,
   includedIncome, includedOut, includedAllocation)` → totals (Decimal→string), balance,
   savingsRate (`computeSavingsRate`), structuralBalance (recurring − included out),
   per-key income/out sums for the composition bars, deltas via `computeDeltaPercent`
   (savingsRate delta = percent-change of the rate, mirroring the DAL).
   `DEFAULT_EXCLUDED_CHIPS = { income: ['extraordinary'], out: [], allocation: [] }`.
2. **`kpi-row.tsx`**: props become `{ data: points, prevData, includedIncome/Out/
   Allocation, year }`. Cards render from derived values. Composition bars show only
   included segments (single included segment → honest "Ricorrenti 100%" bar).
   Bilancio reading: structural-aware warn only when `extraordinary` is included;
   otherwise plain balanceReading(balance, null). Remove the dead null-breakdown
   fallback + `trendReading`/`resolveTrendReading` (no longer reachable).
3. **`overview-chart.tsx`**: controlled — receives sets + toggle/reset handlers via
   props; internal filter state, persistence, and the `OverviewChartFilters` render
   move out.
4. **`overview-dashboard-section.tsx`** (new client wrapper): owns sets + persistence
   restore/write (default = sustainability); renders `OverviewChartFilters` (global,
   above the cards), `KpiRow`, `OverviewMoversSection` (passes sets down).
5. **`page.tsx`**: fetch `getOverviewChart(year - 1)` in the existing `Promise.all`;
   render the new section. `getOverview` stays for empty-check + nudge.
6. **Tests**: units for `deriveFilteredKpis` (default = structural numbers; all-on =
   totals parity; zero prior year → null deltas; empty selections); KpiRow render tests
   on the new props; drop trendReading tests; persistence default assertions.

## Verify

- Full suite green; tsc clean on touched files; check:language clean.
- Throwaway proto: real dashboard section, screenshot default (sustainability) +
  after re-enabling Straordinarie (Playwright click), light + dark. Remove after.

## Out of scope

- DAL cleanup: `OverviewData.structuralBalance/totalInRecurring/structuralSavingsRate/
  outByNature` become unused by the cards — left in place, flagged for a later sweep.
- Month-scoped KPIs (cards stay year-scoped).
- URL params for chips (260709-gfz decision stands: sessionStorage only).
