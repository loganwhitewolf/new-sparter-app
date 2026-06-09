---
phase: 44-overview-interactions
reviewed: 2026-06-08T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - app/(app)/dashboard/overview/page.tsx
  - components/dashboard/overview/overview-chart-filters.tsx
  - components/dashboard/overview/overview-chart-utils.ts
  - components/dashboard/overview/overview-chart.tsx
  - components/dashboard/overview/overview-nudge.tsx
  - tests/overview-interactions.test.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 44: Code Review Report

**Reviewed:** 2026-06-08
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 44 delivers the OverviewChart filter chips, the nudge banner, and their unit tests. The monetary arithmetic, Decimal.js usage, localStorage hydration guard, and DAL session scoping are all correct. The filter logic in `overview-chart-utils.ts` is sound and well-tested. Three warnings and three info items were found — no critical/security issues.

The most actionable finding is that the `onMonthSelect` prop is declared in the TypeScript interface but silently dropped from the destructuring: callers who pass this prop receive no error and no effect. The `selectedMonth` state is written on every bar click but never read, causing unnecessary re-renders. Both of these will bite P45 work when the movers drill-down seam needs to be wired up.

---

## Warnings

### WR-01: `onMonthSelect` prop declared in interface but never destructured or called

**File:** `components/dashboard/overview/overview-chart.tsx:33-36`

**Issue:** The `OverviewChartProps` type declares `onMonthSelect?: (monthIndex: number) => void` at line 33, but the function signature on line 36 only destructures `{ data }`. Any parent that passes `onMonthSelect` will get no type error and no callback invocation — the prop is silently discarded. When P45 wires up the movers panel using this seam, it will appear to compile but do nothing.

**Fix:**
```tsx
export function OverviewChart({ data, onMonthSelect }: OverviewChartProps) {
  // ...
  function handleBarClick(_: unknown, index: number) {
    setSelectedMonth(index)
    onMonthSelect?.(index)
  }
  // then use handleBarClick in the onClick props of both bars
}
```

---

### WR-02: `selectedMonth` state is written but never read — causes a re-render on every bar click with no effect

**File:** `components/dashboard/overview/overview-chart.tsx:39,120,140`

**Issue:** `setSelectedMonth(index)` is called in the `onClick` handlers for both the `entrate` bar (line 120) and the `uscite` bar (line 140), but `selectedMonth` is never consumed in the JSX — the only reference is the `D-03` comment inside the `Cell` `fillOpacity` prop. Every bar click triggers a full React re-render of the chart component with no visible outcome. This is not just wasted work: it means the `Cell` array re-renders on every click even though `fillOpacity` is hardcoded to `1` regardless of the selection value.

**Fix:** Either remove the `onClick` handlers entirely until P45 adds the movers panel, or add a guard so the state setter is a no-op until the feature is live:
```tsx
// Option A — remove until P45:
// (delete the onClick props from both Bar elements)

// Option B — keep the seam, fix the no-op re-render by only updating if actually used:
// Wire onMonthSelect (see WR-01) and let the parent decide whether to re-render.
```

---

### WR-03: Empty `data` array produces `selectedMonth = -1`, a stale sentinel that persists after data arrives

**File:** `components/dashboard/overview/overview-chart.tsx:39`

**Issue:** `useState(() => data.length - 1)` initializes `selectedMonth` to `-1` when `data` is empty. The page-level `isYearWithNoData` guard prevents `OverviewChart` from mounting with no chart data for years that have no transactions, but the guard checks `totalIn + totalOut === 0`, not whether the chart array itself is empty. If `getOverviewChart` returns an empty array for any other reason (e.g., a transient DAL error that hits the catch-and-return-empty branch in `overview.ts:353`), `OverviewChart` mounts with `selectedMonth = -1`. Because `selectedMonth` is not currently used to drive any DOM output this is dormant, but it will become a real bug in P45 when `fillOpacity` uses `i === selectedMonth`.

**Fix:**
```tsx
const [selectedMonth, setSelectedMonth] = useState(
  () => (data.length > 0 ? data.length - 1 : 0)
)
```
Or clamp on access:
```tsx
const safeSelectedMonth = data.length > 0 ? selectedMonth : 0
```

---

## Info

### IN-01: Top-level `await import()` in test file is an unusual pattern; static imports are clearer

**File:** `tests/overview-interactions.test.tsx:11-16`

**Issue:** The test file uses dynamic top-level `await import(...)` for `OverviewNudge` and `OverviewChartFilters` (lines 11 and 15). These components are `'use client'` modules but have no runtime side effects that require deferred loading. Vitest handles this via its ESM runner, but the pattern is unconventional and will confuse tooling that expects static imports. Static imports make dependency graphs explicit and are faster to parse.

**Fix:**
```tsx
import {
  OverviewNudge,
  shouldShowNudge,
} from '@/components/dashboard/overview/overview-nudge'
import { OverviewChartFilters } from '@/components/dashboard/overview/overview-chart-filters'
```

---

### IN-02: `OUT_NATURE_KEY_MAP` indirection in `overview-chart-filters.tsx` adds a layer with no benefit

**File:** `components/dashboard/overview/overview-chart-filters.tsx:43-50`

**Issue:** `OUT_NATURE_KEY_MAP` maps each `OutKey` to the identical key in `NATURE_LABELS` (e.g., `essential → 'essential'`). The only consumer is `NATURE_LABELS[OUT_NATURE_KEY_MAP[key]]` on line 200, which is equivalent to `NATURE_LABELS[key]` because the keys are identical. The indirection exists because `OutKey` and `keyof typeof NATURE_LABELS` are different types, but since `OutKey` values are a strict subset of `NATURE_LABELS` keys, a cast is sufficient.

**Fix:**
```tsx
// Remove OUT_NATURE_KEY_MAP entirely and use:
label={NATURE_LABELS[key as keyof typeof NATURE_LABELS]}
```
Or declare the type relationship explicitly so no cast is needed.

---

### IN-03: `formatEurCompact` does not handle negative values — inconsistent output for any negative bar value

**File:** `components/dashboard/overview/format.ts:27-34`

**Issue:** `formatEurCompact` formats `2500` as `"2,5k"`, but `-2500` yields `"-2,5k"`. The label loses the `€` prefix that `formatEur` would include, so the two formatters are inconsistent for negative inputs. In production this only matters if a chart bucket can go negative — the DAL uses `abs()` for OUT amounts, so uscite bars are always positive. Income bars could theoretically be negative if `nature === 'income'` transactions are negative (credit reversals). The risk is low but the omission is worth documenting.

**Fix:** Guard or document:
```ts
export function formatEurCompact(value: string | number): string {
  const numeric = typeof value === 'string' ? Number(value) : value
  const n = Number.isFinite(numeric) ? numeric : 0
  // Only format non-negative values; negative input falls back to formatEur
  if (n < 0) return formatEur(n)
  if (n >= 1000) {
    return `${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k`
  }
  return String(Math.round(n))
}
```

---

_Reviewed: 2026-06-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
