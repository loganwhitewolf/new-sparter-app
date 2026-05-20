---
phase: "21"
plan: "02"
---

# T02: Replaced placeholder overview/page.tsx with real server component (KpiCards + MonthlyTrendChart), added OverviewFilters (preset-only), fixed DashboardFilters to use usePathname(), and extended parseDashboardFilters with optional defaultPreset

**Replaced placeholder overview/page.tsx with real server component (KpiCards + MonthlyTrendChart), added OverviewFilters (preset-only), fixed DashboardFilters to use usePathname(), and extended parseDashboardFilters with optional defaultPreset**

## What Happened

Four files were changed to complete the migration:

1. `app/(app)/dashboard/overview/page.tsx` — replaced the T01 placeholder with a full server component. Reads `searchParams`, calls `parseDashboardFilters` to resolve the active preset, renders `OverviewFilters` (client-side preset selector), and renders `KpiCards` + `MonthlyTrendChart` each inside their own `Suspense` boundary with the appropriate skeleton. Each async section receives the raw preset string so the inner async components can independently call the DAL.

2. `components/dashboard/overview-filters.tsx` — new client component with only the period preset `<Select>` (no type tabs, which belong to the categories/breakdown page). Uses `usePathname()` to build the replacement URL so it works correctly on `/dashboard/overview` and any future sub-route that uses it.

3. `components/dashboard/dashboard-filters.tsx` — replaced the hardcoded `'/dashboard'` string with `usePathname()`. Also cleaned up the `router.replace()` call to omit the `?` when the search string is empty, matching the pattern used in OverviewFilters.

4. `lib/validations/dashboard.ts` — `parseDashboardFilters` now accepts an optional second argument `options?: { defaultPreset?: DashboardPreset }`. The resolved preset falls back to `options.defaultPreset` before the hard-coded `'last-month'` default, enabling callers that want a different default without touching the URL.

## Verification

yarn tsc --noEmit was run. Zero errors from any of the touched files (dashboard/overview/page.tsx, dashboard-filters.tsx, overview-filters.tsx, lib/validations/dashboard.ts). The only TypeScript errors in the output are pre-existing, unrelated to this task: a missing settings/patterns page referenced by .next/types (not yet created in S02) and a test symbol error in pattern-actions.test.ts.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `yarn tsc --noEmit 2>&1 | grep -E '(dashboard|overview|filters|validations/dashboard)'` | 0 | PASS — no errors in changed files | 18000ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `app/(app)/dashboard/overview/page.tsx`
- `components/dashboard/overview-filters.tsx`
- `components/dashboard/dashboard-filters.tsx`
- `lib/validations/dashboard.ts`
