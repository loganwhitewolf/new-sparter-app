---
phase: 29-dashboard-intelligence
plan: "01"
subsystem: dashboard
tags:
  - dashboard
  - dates
  - decimal
  - deviation
  - tdd
dependency_graph:
  requires: []
  provides:
    - "lib/utils/date.ts: fixed last-month preset (D-01)"
    - "lib/utils/dashboard.ts: computeDeviation, buildDeviationMap, DeviationResult"
    - "tests/dashboard-utils.test.ts: unit test coverage for deviation utilities"
    - "tests/deviation-badge.test.tsx: failing Wave 0 scaffold (owned by Plan 02)"
    - "tests/dashboard-charts.test.tsx: failing Wave 0 scaffold (owned by Plan 03)"
  affects:
    - "lib/dal/dashboard.ts: previousDashboardPresetDateRange corrected for last-month"
    - "tests/dashboard-dal.test.ts: last-month assertions updated to April + January edge case"
tech_stack:
  added: []
  patterns:
    - "Decimal.js for all monetary arithmetic in deviation utilities"
    - "TDD: RED (test file first) then GREEN (implementation)"
key_files:
  created:
    - tests/dashboard-utils.test.ts
    - tests/deviation-badge.test.tsx
    - tests/dashboard-charts.test.tsx
  modified:
    - lib/utils/date.ts
    - lib/dal/dashboard.ts
    - tests/dashboard-dal.test.ts
    - lib/utils/dashboard.ts
decisions:
  - "Fixed previousDashboardPresetDateRange('last-month') in lib/dal/dashboard.ts (now.getMonth() - 2) to correctly return the period before the fixed Reference Period"
  - "Appended deviation exports before roundedPercent definition; function hoisting makes this valid in TypeScript"
  - "tests/dashboard-filters.test.ts NOT modified — D-01 assertion was only in dashboard-dal.test.ts"
metrics:
  duration: "4 minutes"
  completed: "2026-05-19T19:07:04Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 4
---

# Phase 29 Plan 01: Foundation — D-01 Fix, Deviation Utilities, Wave 0 Scaffolds Summary

**One-liner:** Fixed last-month date preset bug, added computeDeviation/buildDeviationMap with Decimal.js arithmetic, and laid Wave 0 failing test scaffolds for DeviationBadge and split chart components.

## What Was Built

### D-01 Bug Fix (Task 1)

Fixed `dashboardPresetToDateRange('last-month')` in `lib/utils/date.ts`. The buggy implementation reused the outer `to` constant (end of current month) and used `now.getMonth()` for `from`, producing the current month instead of the previous calendar month.

**Exact fix applied:**

```typescript
// lib/utils/date.ts — case 'last-month'/default
// BEFORE (buggy):
return {
  from: new Date(now.getFullYear(), now.getMonth(), 1),  // current month
  to,  // end of current month
}

// AFTER (fixed):
return {
  from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
  to: endOfMonth(now.getFullYear(), now.getMonth() - 1),
}
```

Also fixed `previousDashboardPresetDateRange('last-month')` in `lib/dal/dashboard.ts` from `now.getMonth() - 1` to `now.getMonth() - 2`. Before the D-01 fix, "current" was the current month (May) and "previous" was last month (April). After the fix, "current" correctly is April, so "previous" must be March — two months before `now`.

### Updated Test Assertions (Task 1)

Two updated assertions in `tests/dashboard-dal.test.ts` for `now = new Date(2026, 4, 15)`:

- **Before:** `current: { from: new Date(2026, 4, 1), to: new Date(2026, 4, 31, ...) }` (May — wrong)
- **After:** `current: { from: new Date(2026, 3, 1), to: new Date(2026, 3, 30, ...) }` (April — correct)

- **Before:** `previous: { from: new Date(2026, 3, 1), to: new Date(2026, 3, 30, ...) }` (April — wrong)
- **After:** `previous: { from: new Date(2026, 2, 1), to: new Date(2026, 2, 31, ...) }` (March — correct)

New January edge-case test added:
```typescript
it('returns previous December when last-month is queried in January', () => {
  expect(dashboardPresetToDateRange('last-month', new Date(2026, 0, 15))).toEqual({
    from: new Date(2025, 11, 1),
    to: new Date(2025, 11, 31, 23, 59, 59, 999),
  })
})
```
JavaScript Date handles negative month rollover natively (month - 1 when month = 0 gives December of prior year).

### Deviation Utilities (Task 2)

Public API exported from `lib/utils/dashboard.ts`:

```typescript
export type DeviationResult = number | null | 'new'

export function computeDeviation(
  referenceAmount: string | number,
  baseline: string | number
): DeviationResult

export type DeviationReferenceRow = { id: number; amount: string }
export type DeviationBaselineRow = { id: number; month: string; amount: string }

export function buildDeviationMap(input: {
  referenceRows: DeviationReferenceRow[]
  baselineRows: DeviationBaselineRow[]
  noiseThreshold: string
}): Map<number, DeviationResult>
```

**`computeDeviation` semantics:**
- `null` — both reference and baseline are zero (exclude from view)
- `'new'` — baseline is zero but reference is non-zero (first appearance)
- `number` — signed percentage rounded to 1 decimal place; positive = more than average, negative = less

**`buildDeviationMap` semantics:**
- Iterates `referenceRows`; applies noise threshold to reference amount (D-05: reference < threshold → null)
- Groups `baselineRows` by `id`, tracks distinct months and sums per month
- Averages baseline across however many distinct months are present (D-03: up to 3)
- All arithmetic uses Decimal.js — no native `+`, `-`, `*`, `/` on amounts
- Categories present only in baseline are omitted from the result Map

### Wave 0 Failing Scaffolds (Task 3)

**`tests/deviation-badge.test.tsx`** — intentionally RED (fails at import: `@/components/dashboard/deviation-badge` does not exist):
- Tests null/new/positive/negative deviation states
- Tests color polarity: out categories red for positive (overspend), green for negative (underspend); reversed for in
- Owned by **Plan 02**

**`tests/dashboard-charts.test.tsx`** — intentionally RED (fails at import: `@/components/dashboard/entrate-uscite-chart` and `bilancio-bars-chart` do not exist):
- Tests `EntrateUsciteChart` renders Entrate and Uscite labels, excludes Non categorizzato/Ignorato/Bilancio
- Tests `BilancioBarsChart` renders Bilancio label
- Owned by **Plan 03**

**`tests/dashboard-filters.test.ts` was NOT modified.** The plan listed it in `files_modified` because the phase scope referenced it, but inspection of the file confirmed it covers only `parseDashboardFilters` and route builders — it has no `last-month` date assertion. The D-01 assertion exclusively lives in `tests/dashboard-dal.test.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed previousDashboardPresetDateRange for last-month in lib/dal/dashboard.ts**
- **Found during:** Task 1 GREEN phase verification
- **Issue:** After fixing `dashboardPresetToDateRange('last-month')` to return April when `now = May`, `getOverviewComparisonRanges` still failed because `previousDashboardPresetDateRange('last-month')` used `now.getMonth() - 1` (giving April again) instead of `now.getMonth() - 2` (giving March). The plan's research notes stated the previous function "was already correct" but that was relative to the buggy current (May), not the fixed current (April).
- **Fix:** Changed `now.getMonth() - 1` to `now.getMonth() - 2` in the `last-month`/`default` case of `previousDashboardPresetDateRange`
- **Files modified:** `lib/dal/dashboard.ts`
- **Commit:** 98e6938

## Known Stubs

None — this plan delivers utilities and tests only, no UI components.

## Threat Flags

No new security-relevant surface introduced. This plan is pure utility code (date arithmetic, percentage computation) and test scaffolds — no I/O, no network endpoints, no auth paths.

## Self-Check: PASSED

Files verified to exist:
- `lib/utils/date.ts` — FOUND
- `lib/utils/dashboard.ts` — FOUND
- `tests/dashboard-utils.test.ts` — FOUND
- `tests/dashboard-dal.test.ts` — FOUND
- `tests/deviation-badge.test.tsx` — FOUND
- `tests/dashboard-charts.test.tsx` — FOUND

Commits verified:
- 98e6938 — fix(29-01): fix D-01 last-month preset — FOUND
- 6043101 — feat(29-01): add computeDeviation and buildDeviationMap — FOUND
- f20f3c6 — test(29-01): add Wave 0 failing scaffolds — FOUND
