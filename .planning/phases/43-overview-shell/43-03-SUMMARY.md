---
phase: 43-overview-shell
plan: "03"
subsystem: dashboard/overview
tags: [overview, year-scope, empty-state, server-component, suspense]
dependency_graph:
  requires: ["43-01", "43-02", "42-03"]
  provides: ["overview-page-shell", "resolveYear", "OverviewEmptyState"]
  affects: ["app/(app)/dashboard/overview/page.tsx"]
tech_stack:
  added: []
  patterns: ["async Server Component with Suspense streaming", "D-04 year resolution", "D-06 empty states"]
key_files:
  created:
    - components/dashboard/overview/resolve-year.ts
    - components/dashboard/overview/overview-empty-state.tsx
    - components/dashboard/overview/overview-page-skeleton.tsx
  modified:
    - app/(app)/dashboard/overview/page.tsx
decisions:
  - "D-04 year resolution implemented as pure helper: requested-in-years > current-year-if-present > years[0]"
  - "Single Suspense boundary wrapping OverviewDataSection (fetches overview + chart in parallel)"
  - "Empty state for no-data year uses toDecimal().isZero() check on totalIn + totalOut (both must be zero)"
  - "Wave-1/2 dependencies (dal/overview.ts, nature-labels.ts, schema.ts, dashboard.ts, seed-extras.ts) ported from develop via Rule 3"
metrics:
  duration: "~45 minutes"
  completed: "2026-06-08T10:26:06Z"
  tasks_completed: 2
  files_changed: 11
---

# Phase 43 Plan 03: Overview Page Shell Summary

**One-liner:** Year-scoped async Server Component wiring OverviewHeader + KpiRow + OverviewChart to Phase 42 DAL with D-04 resolution and D-06 empty states.

## What Was Built

### Task 1: resolveYear helper + OverviewEmptyState (commit 3e5b6a6)

**`components/dashboard/overview/resolve-year.ts`**
Pure function `resolveYear(requested, years): number | null` implementing D-04:
- `years` empty → `null` (no data)
- `requested` in `years` → use it
- else current calendar year if in `years`
- else `years[0]` (most recent, DESC order)

Guarantees HEAD-03: returned year is always a member of `years`.

**`components/dashboard/overview/overview-empty-state.tsx`**
`OverviewEmptyState` component with `variant: 'no-years' | 'no-data-for-year'` + optional `year?`.
Italian messages for D-06 empty states (gentle/observational copy per CONTEXT.md).

Also included in this commit: ported wave-1/2 artifacts from develop into this worktree:
- `components/dashboard/overview/{format.ts, kpi-card-reading.tsx, kpi-row.tsx, overview-chart.tsx, overview-header.tsx}`
- `lib/dal/overview.ts`

### Task 2: Rewrite overview/page.tsx (commit 7369c7c)

**`app/(app)/dashboard/overview/page.tsx`**
Rewritten as async Server Component:
- `searchParams: Promise<{ year?: string }>` — reads `?year=`
- Calls `getYearsWithData()` → `resolveYear(params.year, years)`
- `year === null` → `<OverviewEmptyState variant="no-years" />`
- Otherwise: renders `<OverviewHeader year={year} years={years} />` (eager) then `<Suspense fallback={<OverviewPageSkeleton />}><OverviewDataSection year={year} /></Suspense>`
- `OverviewDataSection`: async child that `Promise.all([getOverview, getOverviewChart])`, checks `isYearWithNoData(totalIn, totalOut)`, renders KpiRow + chart section or `<OverviewEmptyState variant="no-data-for-year" year={year} />`

**`components/dashboard/overview/overview-page-skeleton.tsx`**
Co-located skeleton (4 KPI cards + chart area) so Plan 04 can delete the old `overview-skeleton.tsx` without affecting this page.

Also ported in this commit (Rule 3 — blocked build): `lib/dal/dashboard.ts`, `lib/db/schema.ts`, `lib/utils/nature-labels.ts`, `scripts/seed-extras.ts`.

## Verification

- `yarn build` (via `node_modules/.bin/next build`): **BUILD_OK** — 23 routes, all green.
- `yarn check:language`: pre-existing violations only in `app/proto/overview/NOTES.md`, `tests/`, and `scripts/seed-extras.ts`. No new violations in files created/modified by this plan.
- grep checks on page.tsx: `getYearsWithData`, `resolveYear`, `OverviewHeader`, `KpiRow`, `OverviewChart`, `searchParams` all present; `parseDashboardFilters`, `EntrateUsciteChart`, `KpiCards`, `BilancioBarsChart`, `OverviewFilters` all absent.

## Deviations from Plan

### Rule 3: Ported wave-1/2 dependencies from develop into worktree

**Found during:** Task 1 (and confirmed during Task 2 build)

**Issue:** This worktree branch (`worktree-agent-a4d17c624c6c705e8`) was created from a commit predating the Phase 43 wave-1/2 merge into `develop`. The following files were missing:
- `components/dashboard/overview/{format.ts, kpi-card-reading.tsx, kpi-row.tsx, overview-chart.tsx, overview-header.tsx}` (Plan 43-01/02)
- `lib/dal/overview.ts` (Plan 43-02)
- `lib/dal/dashboard.ts` (Phase 42 additions: `getOverviewAmountTotals`, `buildOverviewData`, etc.)
- `lib/db/schema.ts` (Phase 42: `income_extraordinary` in `flowNatureEnum`)
- `lib/utils/nature-labels.ts` (Phase 42: `income_extraordinary` in `FlowNature`)
- `scripts/seed-extras.ts` (Phase 42: `income_extraordinary` in `NATURE_SLUGS`)

**Fix:** `git checkout ab4d71d -- <files>` to pull each file from the post-wave-1/2 commit on develop.

**Files modified:** All 9 files listed above.

**Commits:** 3e5b6a6 (wave-1/2 components + DAL), 7369c7c (schema/dashboard/seed-extras)

### Known stubs

None. All data paths are wired to real DAL calls.

## Threat Surface Scan

No new trust boundaries introduced. The `?year=` query parameter is the only external input; it is constrained by `resolveYear` to a member of `getYearsWithData()` before reaching the DAL (T-43-05 mitigated). The raw string is never echoed into the DOM (T-43-06 mitigated).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `resolve-year.ts` | FOUND |
| `overview-empty-state.tsx` | FOUND |
| `overview-page-skeleton.tsx` | FOUND |
| `page.tsx` (rewritten) | FOUND |
| commit 3e5b6a6 | FOUND |
| commit 7369c7c | FOUND |
