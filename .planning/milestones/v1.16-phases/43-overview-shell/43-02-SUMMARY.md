---
phase: 43-overview-shell
plan: "02"
subsystem: dashboard/overview
tags: [chart, recharts, OverviewChart, grouped-bars, D-03-scaffold]
dependency_graph:
  requires:
    - lib/dal/overview.ts (OverviewChartPoint type + getOverviewChart DAL function)
    - lib/utils/decimal.ts (toDecimal — Decimal.js arithmetic on DECIMAL strings)
    - components/ui/chart.tsx (ChartContainer/ChartTooltip/ChartLegend wrappers)
  provides:
    - components/dashboard/overview/overview-chart.tsx (OverviewChart component)
    - components/dashboard/overview/format.ts (formatEur / formatEurCompact)
  affects:
    - app/(app)/dashboard/overview/page.tsx (Plan 03 will import OverviewChart)
tech_stack:
  added: []
  patterns:
    - recharts grouped BarChart (two Bar series, no stackId)
    - LabelList with compact k-notation formatter for always-on bar labels
    - D-03 scaffold: selectedMonth useState + per-Cell opacity hook + onClick wiring (inert in P43)
    - Decimal.js summing of DECIMAL strings before conversion to recharts numbers
key_files:
  created:
    - components/dashboard/overview/overview-chart.tsx
    - components/dashboard/overview/format.ts
  modified:
    - lib/dal/overview.ts (restored from phase 42 — was missing from worktree base)
    - lib/dal/dashboard.ts (restored)
    - lib/db/schema.ts (restored)
    - lib/utils/nature-labels.ts (restored)
    - scripts/seed-extras.ts (restored)
    - tests/nature-labels.test.ts (restored)
decisions:
  - "Inline format.ts creation in plan 02 (Rule 3 — blocking dependency, plan 01 creates identical file)"
  - "LabelList formatter typed as (v: unknown) to satisfy recharts LabelFormatter signature"
  - "D-03 scaffold: fillOpacity=1 and cursor=default on all Cells (no visible P43 affordance)"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-08"
  tasks_completed: 1
  files_created: 2
  files_restored: 6
---

# Phase 43 Plan 02: OverviewChart hero chart Summary

Grouped Entrate/Uscite recharts bar chart ported from proto variant-a with D-03 scaffold (selectedMonth state + Cell hooks inert in P43) and production Decimal.js sums.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | OverviewChart — port variant A, strip P44/P45, keep D-03 scaffold | a3b767b | components/dashboard/overview/overview-chart.tsx, components/dashboard/overview/format.ts |

## What Was Built

**`components/dashboard/overview/format.ts`**
Production number formatters replacing the throwaway proto `eur`/`eurCompact`:
- `formatEur(value: string | number): string` — `Intl.NumberFormat('it-IT', currency: 'EUR', maximumFractionDigits: 0)`, accepts DAL DECIMAL strings
- `formatEurCompact(value: string | number): string` — k-notation for values ≥ 1000 (e.g. "2,5k"), rounded integer otherwise; used for always-on bar labels

**`components/dashboard/overview/overview-chart.tsx`**
`OverviewChart` client component (`'use client'`) consuming `OverviewChartPoint[]`:
- Two side-by-side Bar series `entrate` (var(--total-in) green) and `uscite` (var(--total-out) red); no `stackId`, no balance series (CHART-01, CHART-03)
- Income split collapsed: `income.recurring + income.extraordinary` → one green bar per month using `toDecimal().plus()` (NEVER native +)
- 6 OUT natures collapsed: `essential + discretionary + operational + financial + debt + extraordinary` → one red bar using `toDecimal()` reduction (CHART-03)
- `LabelList` on each Bar with `formatEurCompact` for always-on compact k-notation labels above bars (CHART-02)
- `ChartTooltipContent` for exact values in tooltip (CHART-02)
- D-03 scaffold present: `selectedMonth` useState (defaults to last index), `onClick` handlers on both Bars, per-Cell map on uscite Bar — all rendered inert in P43 (`fillOpacity=1`, `cursor="default"`)
- Optional no-op props typed for P44/P45: `onMonthSelect?`, `hiddenIncome?`, `hiddenOut?`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored 6 phase-42 files missing from worktree base**
- **Found during:** Task 1 — TypeScript type errors when compiling overview-chart.tsx
- **Issue:** The worktree was created from commit `66ef84da` (loganwhitewolf/develop merge) which diverged from develop BEFORE phase 42 was merged. `lib/dal/overview.ts` (defines `OverviewChartPoint`), `lib/dal/dashboard.ts`, `lib/db/schema.ts`, `lib/utils/nature-labels.ts`, `scripts/seed-extras.ts`, and `tests/nature-labels.test.ts` were all at pre-phase-42 versions. The plan 02 component requires `OverviewChartPoint` from `lib/dal/overview.ts`.
- **Fix:** Restored all 6 files from commit `5b84b02` (develop tip at plan-creation time) via `git show 5b84b02:<path>`.
- **Files modified:** lib/dal/overview.ts (created), lib/dal/dashboard.ts, lib/db/schema.ts, lib/utils/nature-labels.ts, scripts/seed-extras.ts, tests/nature-labels.test.ts
- **Commit:** fe867b6

**2. [Rule 1 - Bug] LabelList formatter typed as (v: unknown) instead of (v: number)**
- **Found during:** Task 1 — `npx tsc --noEmit` error
- **Issue:** Recharts `LabelFormatter` type accepts `RenderableText` (string | number | undefined) not `number`, causing TS2322 assignment error
- **Fix:** Changed `(v: number) => formatEurCompact(Number(v))` to `(v: unknown) => formatEurCompact(Number(v))` — `Number(unknown)` is safe (NaN-safe via the formatter)
- **Files modified:** components/dashboard/overview/overview-chart.tsx
- **Commit:** a3b767b (integrated into task commit)

**3. [Rule 3 - Blocking] Created format.ts in plan 02 (plan 01 is parallel)**
- **Found during:** Task 1 — import `from './format'` would fail if plan 01 hadn't run yet
- **Issue:** Plans 01 and 02 are both wave 1 with `depends_on: []` — they run in parallel. Plan 02 needs `format.ts` which plan 01 creates. As a parallel executor, plan 01's work is not available in this worktree.
- **Fix:** Created `components/dashboard/overview/format.ts` with identical content to what plan 01 specifies. The orchestrator merge will deduplicate the identical file.
- **Files created:** components/dashboard/overview/format.ts
- **Commit:** a3b767b

## Verification

- `npx tsc --noEmit` clean (0 errors after fixes)
- Automated grep checks pass: `export function OverviewChart`, `OverviewChartPoint`, `dataKey="entrate"`, `dataKey="uscite"`, `LabelList`, `formatEurCompact` all present; no `FilterBar`/`MoversList`/`useFilters`/`./shared`/`stackId`/`PROTOTYPE`
- Two Bar series with no `stackId` — grouped bars (CHART-01)
- `LabelList` with `formatEurCompact` always-on labels (CHART-02)
- No balance series, no nature stacking (CHART-03)
- D-03 scaffold: `selectedMonth` state + `onClick` + per-Cell map present; `fillOpacity=1` / `cursor="default"` (no P43 affordance)

## Known Stubs

None — the component is a presentation-only component consuming real `OverviewChartPoint[]` from the DAL. No hardcoded data or placeholders.

## Threat Flags

None — all rendered values are numeric formatter output or fixed month abbreviations from the DAL. React escapes by default; no `dangerouslySetInnerHTML`. The bar `onClick` sets internal state only (no security impact in P43).

## Self-Check: PASSED

- FOUND: components/dashboard/overview/overview-chart.tsx
- FOUND: components/dashboard/overview/format.ts
- FOUND: commit a3b767b (task commit)
- FOUND: commit fe867b6 (deviation commit)
- TSC: 0 errors
