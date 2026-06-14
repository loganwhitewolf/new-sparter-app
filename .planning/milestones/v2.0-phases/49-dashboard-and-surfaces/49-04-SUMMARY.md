---
phase: 49-dashboard-and-surfaces
plan: "04"
subsystem: dashboard/overview
tags: [dashboard, chart, kpi, movers, allocation, direction-aware]
dependency_graph:
  requires: ["49-02"]
  provides: ["allocation-visible-in-dashboard"]
  affects: ["overview-chart", "kpi-row", "movers-panel", "overview-page"]
tech_stack:
  added: []
  patterns:
    - "3-column movers layout for simultaneous direction display"
    - "abs() on display-only for algebraic DAL values"
    - "parallel Promise.all for 3-direction movers pre-fetch"
key_files:
  created: []
  modified:
    - app/globals.css
    - components/dashboard/overview/kpi-row.tsx
    - components/dashboard/overview/overview-chart.tsx
    - components/dashboard/overview/overview-movers-section.tsx
    - components/dashboard/overview/overview-movers-panel.tsx
    - app/(app)/dashboard/overview/page.tsx
decisions:
  - "Abs on display only: toDecimal(totalAllocation).abs() in kpi-row; DAL remains algebraic for savings-rate calc"
  - "3-column movers: remove selectedDirection state; month selection shows all 3 directions simultaneously"
  - "Parallel fetch: Promise.all([in, out, allocation]) on month change for atomic loading state"
  - "DirectionColumn sub-component: self-contained heading+rows+empty-state per direction"
metrics:
  duration: "~30m (continuation after checkpoint feedback)"
  completed: "2026-06-12T15:53:00Z"
  tasks_completed: 3
  files_modified: 6
---

# Phase 49 Plan 04: 4-Direction Dashboard Presentation Summary

3-bar grouped chart (Entrate/Uscite/Accantonato), 5th KPI card, 3-column movers panel showing all directions simultaneously; allocation displayed positive in KPI.

## What was built

This plan extended the overview dashboard with the visible 4-direction presentation layer on top of the Plan 02 data layer:

**Task 1 (e5901d0):** CSS tokens `--total-allocation` (purple `#a78bfa`) and `--total-transfer` added to `globals.css`. `OverviewChart` extended with a 3rd `<Bar dataKey="accantonato">` (always rendered, zero-height on empty months). `NatureTooltip` updated with Accantonamenti section. Direction-aware `onMonthSelect` and allocation nature-filter chips added.

**Task 2 (74e4eff):** 5th `ReadingKpiCard label="Accantonato"` added to `KpiRow` with `allocationReading()` helper. `OverviewMoversSection` extended with `selectedDirection` state and direction-aware `fetchMovers` call. `OverviewMoversPanel` made direction-aware with per-nature allocation rows (Risparmio/Investimento, max 2), direction-specific headings and empty states in Italian.

**Post-checkpoint fixes (414747f):** Two UX issues identified at checkpoint and resolved atomically.

## Deviations from Plan

### Auto-fixed Issues

**1. [Post-checkpoint fix] KPI "Accantonato" showed negative values**
- **Found during:** Human-verify checkpoint
- **Issue:** The DAL returns `totalAllocation` as an algebraic sum (cash-out = negative amounts). `formatEur(data.totalAllocation)` displayed −€10,000.
- **Fix:** Wrapped display in `toDecimal(data.totalAllocation).abs().toNumber()` before `formatEur()`. DAL unchanged — algebraic value still feeds `savingsRate` calculation correctly.
- **Files modified:** `components/dashboard/overview/kpi-row.tsx`
- **Commit:** 414747f

**2. [Post-checkpoint UX change] Movers panel changed from single-direction to 3-column layout**
- **Found during:** Human-verify checkpoint — user feedback
- **Issue:** Plan specified direction-aware single-panel (click bar → see that direction's movers). User preferred seeing all 3 directions simultaneously on month selection.
- **Fix:** Removed `selectedDirection` state from `OverviewMoversSection`. Month selection now fetches all 3 directions in parallel via `Promise.all`. `OverviewMoversPanel` rewritten to a 3-column grid with `DirectionColumn` sub-component (Entrate | Uscite | Accantonamenti). `OverviewChart` `onMonthSelect` simplified to `(index: number)` — no direction argument. `page.tsx` pre-fetches all 3 directions in parallel server-side.
- **Files modified:** `overview-movers-section.tsx`, `overview-movers-panel.tsx`, `overview-chart.tsx`, `page.tsx`
- **Commit:** 414747f

## Commits

| Hash | Message |
|------|---------|
| e5901d0 | feat(49-04): 3-bar grouped chart with direction-aware click + allocation CSS tokens |
| 74e4eff | feat(49-04): 5th KPI card + direction-aware movers section/panel + page wiring |
| 414747f | fix(49-04): KPI allocation abs display + 3-column movers on month select |

## Known Stubs

None — all data paths wired from real DAL output.

## Threat Flags

None — the `direction` param in `fetchMovers` remains validated against the closed enum (T-49-02-01 mitigation from Plan 02 unchanged). The removal of per-bar direction routing on the client does not weaken the server-side validation.

## Self-Check: PASSED

- `e5901d0`, `74e4eff`, `414747f` all present in git log
- Modified files exist on disk
- TypeScript: no new errors introduced by these changes (pre-existing test file errors in `cascade-options.test.ts` and `category-combobox.test.tsx` are out of scope)
