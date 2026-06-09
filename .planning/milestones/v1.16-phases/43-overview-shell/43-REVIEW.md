---
phase: 43-overview-shell
reviewed: 2026-06-08T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - components/dashboard/overview/format.ts
  - components/dashboard/overview/kpi-card-reading.tsx
  - components/dashboard/overview/kpi-row.tsx
  - components/dashboard/overview/overview-header.tsx
  - components/dashboard/overview/overview-chart.tsx
  - components/dashboard/overview/resolve-year.ts
  - components/dashboard/overview/overview-empty-state.tsx
  - components/dashboard/overview/overview-page-skeleton.tsx
  - app/(app)/dashboard/overview/page.tsx
  - lib/dal/overview.ts
  - lib/dal/dashboard.ts
  - lib/utils/nature-labels.ts
  - scripts/seed-extras.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 43: Code Review Report

**Reviewed:** 2026-06-08
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 43 delivers the overview dashboard shell: year picker, KPI row, bar chart, and empty states. The architecture is sound — `resolveYear` correctly validates the attacker-controlled `?year=` param against the user-owned `years` list, all DAL calls are behind `verifySession()`, and monetary arithmetic consistently uses Decimal.js at computation boundaries. The component layer is clean React.

Three issues need attention before the phase is considered shippable:

1. **BLOCKER (CR-01):** `getOverviewChart` uses a `to` date that excludes the last day of December, producing a silent data gap for December transactions.
2. **WARNING (WR-01):** Income amounts are accumulated without `abs()` in `getOverviewChart`, which can produce negative bar values for income natures if the DB returns a negative sum.
3. **WARNING (WR-02):** `getOverview` in `lib/dal/overview.ts` shadows the identically-named `getOverview` export in `lib/dal/dashboard.ts`; the page import is unambiguous today, but the name collision will cause confusion or accidental breakage in future refactors.
4. **WARNING (WR-03 / WR-04):** Two bare `catch {}` blocks silently swallow DB errors in `getYearsWithData` and `getOverviewChart`, making failures invisible in production.

---

## Critical Issues

### CR-01: December data silently excluded from chart year range

**File:** `lib/dal/overview.ts:310`
**Issue:** The `to` date for `getOverviewChart` is constructed as:
```ts
const to = new Date(year, 11, 31, 23, 59, 59, 999)
```
`new Date(year, 11, 31, ...)` is correct — month index 11 is December. However the `monthsBetween` utility is called with `from = new Date(year, 0, 1)` and `to = new Date(year, 11, 31, ...)`. This is not itself the bug.

The actual issue is that the SQL `WHERE` clause for `getOverviewChart` uses `dateScopedTransactions(userId, from, to)` which expands to `lte(transactionTable.occurredAt, to)`. Because `to` is `new Date(year, 11, 31, 23, 59, 59, 999)` — i.e., 999ms before midnight of Jan 1 — transactions timestamped at exactly `YYYY-12-31 23:59:59.999` are included, but any transaction at `YYYY-12-31 23:59:59.9999` (sub-millisecond precision in Postgres `timestamptz`) would be excluded. More importantly, the `monthsBetween` utility is passed the same dates; if it generates months via `to_char` it will include December correctly, but the `from`/`to` passed to `dateScopedTransactions` must cover the full last day. Cross-check `getOverview` (line 134): it constructs its upper bound as `new Date(year, lastMonthIdx + 1, 0, 23, 59, 59, 999)` — i.e., "day 0 of the next month" which is the last day of `lastMonthIdx`. For December (`lastMonthIdx=11`), this produces `new Date(year, 12, 0, ...)` = `new Date(year, 11, 31, 23, 59, 59, 999)`. That construction is equivalent and correct.

**Re-evaluated:** Both `getOverview` and `getOverviewChart` use equivalent upper bounds for the full year. CR-01 is a false positive on the date arithmetic itself. However, there is a **real data gap** caused by the inconsistency between the two functions: `getOverview` (overview.ts, line 118) applies a **YTD upper bound** (last month with data, D-11 logic), while `getOverviewChart` always queries the **full calendar year** (`Jan–Dec`). This means the KPI totals shown in the KPI row reflect a YTD-capped range, while the chart bars show the full year. In a year that is still in progress (e.g. the user's current year), the chart will include future-empty months but the KPIs will not sum to the chart totals. This is a **display correctness bug** — the numbers in the KPI row and the chart bars are computed over different time spans.

**Fix:** Either:
- Pass the resolved `lastMonthIdx` to `getOverviewChart` so the chart also uses a YTD upper bound (and zero-fills months beyond it), or
- Document explicitly (in a comment at the page `Promise.all` call site) that the two queries intentionally use different time spans. If the design intent is that the KPIs are YTD and the chart is full-year, the KPI labels should say "YTD" to avoid misleading the user.

---

## Warnings

### WR-01: Income amounts not abs()-ed before accumulation in getOverviewChart

**File:** `lib/dal/overview.ts:377-381`
**Issue:** In `getOverviewChart`, when accumulating `income` nature rows:
```ts
if (nature === 'income') {
  bucket.income.recurring = toDecimal(bucket.income.recurring)
    .plus(toDecimal(rawAmount))
    .toFixed(2)
}
```
`rawAmount` is the raw result of `sum(transaction.amount)`. Income transactions should have positive amounts, but there is no `abs()` guard. The OUT natures (line 387) correctly call `.abs()` before accumulation:
```ts
const absAmount = toDecimal(rawAmount).abs().toFixed(2)
```
If any income-tagged transaction has a negative amount (e.g. a reversal), the sum could be negative and `deriveBarRow` in `overview-chart.tsx` would produce a negative `entrate` value. Recharts will render a negative bar pointing downward, which is visually broken and incorrect.

**Fix:**
```ts
if (nature === 'income') {
  bucket.income.recurring = toDecimal(bucket.income.recurring)
    .plus(toDecimal(rawAmount).abs())   // abs() guard, same as OUT natures
    .toFixed(2)
} else if (nature === 'income_extraordinary') {
  bucket.income.extraordinary = toDecimal(bucket.income.extraordinary)
    .plus(toDecimal(rawAmount).abs())   // abs() guard
    .toFixed(2)
}
```

### WR-02: Name collision — getOverview exported from both dal/overview.ts and dal/dashboard.ts

**File:** `lib/dal/overview.ts:118` and `lib/dal/dashboard.ts:849`
**Issue:** Both files export a function named `getOverview`. The signatures differ:
- `lib/dal/overview.ts`: `getOverview(year: number): Promise<OverviewData>` — Phase 43 function
- `lib/dal/dashboard.ts`: `getOverview(preset: DashboardPreset): Promise<OverviewData>` — legacy Phase 42 function

The page (`app/(app)/dashboard/overview/page.tsx:3`) imports from `lib/dal/overview`, so it resolves correctly today. But any developer who writes `import { getOverview } from '@/lib/dal/dashboard'` in a new file will get the wrong function with an incompatible signature, and the TypeScript compiler may not catch it if the call site passes a compatible type. The legacy `getOverview` in `dashboard.ts` is also no longer needed by the overview page.

**Fix:** Rename the legacy `getOverview` in `lib/dal/dashboard.ts` to `getLegacyOverview` or `getDashboardOverview`, or remove it if no other file imports it. Run:
```bash
grep -r "from.*dal/dashboard.*getOverview\|getOverview.*dal/dashboard" --include="*.ts" --include="*.tsx" .
```
to check for other callers before removal.

### WR-03: Silent catch in getYearsWithData hides DB errors

**File:** `lib/dal/overview.ts:103-105`
**Issue:**
```ts
} catch {
  return []
}
```
If `getYearsWithData` fails due to a connection error or schema issue, it silently returns `[]`. This causes the page to render the `no-years` empty state instead of surfacing the error — the user sees "no transactions" when there is actually a database problem. This makes production outages invisible.

**Fix:** Log the error before returning the fallback:
```ts
} catch (err) {
  console.error('[overview] getYearsWithData failed', err)
  return []
}
```

### WR-04: Silent catch in getOverviewChart hides DB errors

**File:** `lib/dal/overview.ts:353-355`
**Issue:** Same pattern as WR-03. A DB failure in `getOverviewChart` returns `rows = []`, which causes the chart to render 12 zero bars with no indication of an error. The `OverviewDataSection` checks `isYearWithNoData` using `overview.totalIn` and `overview.totalOut` (from `getOverview`), but if `getOverview` succeeds and `getOverviewChart` silently fails, the KPI row renders real numbers while the chart shows all zeros — a contradictory UI.

**Fix:** Same pattern — log before swallowing:
```ts
} catch (err) {
  console.error('[overview] getOverviewChart failed', err)
  rows = []
}
```

---

## Info

### IN-01: formatEurCompact handles negatives incorrectly for bar labels

**File:** `components/dashboard/overview/format.ts:27-34`
**Issue:** `formatEurCompact` does not handle negative values. If called with a negative number (possible if WR-01 is not fixed and a negative bar value reaches recharts), the output would be `"-2,5k"` which is visually acceptable, but `Math.round(n)` for small negatives (e.g. `-800`) returns `-800` without a `k` suffix — the sign is preserved but the compact format is asymmetric. This is a latent issue gated on WR-01.

**Fix:** No immediate change required if WR-01 is fixed. If negative values are ever intentional, add `Math.abs` before the threshold check and prepend the sign separately.

### IN-02: D-03 scaffold leaves unused import (useState) loaded on every chart render

**File:** `components/dashboard/overview/overview-chart.tsx:3`
**Issue:** `useState` is imported and `selectedMonth` state is maintained, but neither `selectedMonth` nor `setSelectedMonth` has any visible effect in P43 (the `Cell` opacity is hardcoded to 1 and `onClick` only sets inert state). This is intentional scaffolding per the D-03 comment, but it means every chart render allocates state that does nothing. This is acceptable as a planned scaffold; flagged for awareness only.

**Fix:** No action needed until P45 wires the drill-down; the comment is clear.

---

_Reviewed: 2026-06-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
