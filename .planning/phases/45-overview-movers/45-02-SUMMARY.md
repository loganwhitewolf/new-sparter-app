---
phase: 45-overview-movers
plan: 02
subsystem: ui
tags: [overview, movers, chart, controlled-component, useTransition, server-action]

requires:
  - phase: 45-overview-movers
    plan: 01
    provides: fetchMovers server action + formatMoverLine/splitMovers pure functions

provides:
  - OverviewChart promoted to controlled component (selectedMonth + onMonthSelect required props)
  - D-03 Cell highlight active on both Entrate and Uscite bars (fillOpacity 0.4/1.0)
  - OverviewMoversPanel presentational component with heading, two hide-empty sections, spinner, empty state
  - OverviewMoversSection shared-state parent owning selectedMonth + movers via useTransition
  - deriveDefaultMonthIndex helper using Decimal arithmetic on Object.values(p.out)
  - Server-side initial movers prefetch in OverviewDataSection (panel populated on first paint)

affects: [45-03, overview-chart, overview-movers-panel, overview-movers-section, page-overview]

tech-stack:
  added: []
  patterns:
    - controlled-chart-component (selectedMonth/onMonthSelect props; parent owns state)
    - shared-state-parent (one selectedMonth shared between chart + panel via OverviewMoversSection)
    - useTransition-server-action (instant UI update + non-blocking movers refresh)
    - derive-default-month-index (Decimal sum over Record<OutNature, string> via Object.values)

key-files:
  created:
    - components/dashboard/overview/overview-movers-panel.tsx
    - components/dashboard/overview/overview-movers-section.tsx
  modified:
    - components/dashboard/overview/overview-chart.tsx
    - app/(app)/dashboard/overview/page.tsx

key-decisions:
  - "OverviewChart is fully controlled — no internal selectedMonth useState; parent owns the single source of truth (MOVE-01 / lift-state architectural decision)"
  - "OverviewMoversSection as thin shared-state parent wraps both chart and panel so highlight and panel month always agree"
  - "Object.values(p.out) used in deriveDefaultMonthIndex — p.out is Record<OutNature, string> not an array; PATTERNS.md had a bug (p.out.reduce) that was corrected per plan instructions"
  - "isPending check in panel: loading spinner inside panel body only, not full-page (D-05 / specifics)"
  - "Year-crossing guard in panel heading: selectedMonth===0 -> prev=Dicembre, prevYear=year-1"

requirements-completed: [MOVE-01, MOVE-02, MOVE-04, MOVE-05]

duration: 25min
completed: 2026-06-08
---

# Phase 45-02: Overview Movers Wire-Up Summary

**Controlled OverviewChart + OverviewMoversSection shared-state parent + OverviewMoversPanel inline panel — interactive movers drill-down wired end-to-end**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-08T18:10:00Z
- **Completed:** 2026-06-08T18:35:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `OverviewChart` promoted from self-owned state to a controlled component: `selectedMonth: number` and `onMonthSelect: (monthIndex: number) => void` are required props; internal `useState` removed. D-03 Cell highlight active on both Entrate and Uscite Bars (`fillOpacity` 0.4/1.0, `cursor="pointer"`, per-Cell arrays).
- `OverviewMoversSection` (client parent) owns the single `selectedMonth` + `movers` state. Bar click calls `handleMonthSelect` — highlight updates immediately, movers refresh via `fetchMovers` inside `useTransition` (non-blocking, D-05).
- `OverviewMoversPanel` (presentational) renders: D-02 heading (`{Mese} {Anno} vs {PrevMese} {PrevAnno}` with January year-crossing), Loader2 spinner during transition, two hide-empty colored sections (red "Dove hai speso di più", green "Dove hai risparmiato"), D-07 empty state message.
- `deriveDefaultMonthIndex` in `page.tsx`: scans chart downward, sums income and `Object.values(p.out)` via `toDecimal` (D-04 — never the naive last index). Initial movers prefetched server-side for that month.
- `yarn build` passes; no TS errors in any new or modified file.

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | OverviewChart controlled + D-03 Cell highlight | `5318490` |
| 2 | OverviewMoversPanel + OverviewMoversSection | `3b99370` |
| 3 | deriveDefaultMonthIndex + initial movers prefetch | `8d7dead` |

## Files Created/Modified

- `components/dashboard/overview/overview-chart.tsx` — controlled props; Cell highlight on both bars
- `components/dashboard/overview/overview-movers-panel.tsx` — presentational panel (new)
- `components/dashboard/overview/overview-movers-section.tsx` — shared-state parent (new)
- `app/(app)/dashboard/overview/page.tsx` — deriveDefaultMonthIndex + prefetch + renders OverviewMoversSection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed PATTERNS.md p.out.reduce bug**
- **Found during:** Task 3
- **Issue:** `45-PATTERNS.md` line 167 showed `p.out.reduce(...)` which would throw at runtime since `p.out` is `Record<OutNature, string>` (an object), not an array. The plan `<action>` section explicitly warned about this and provided the correct form.
- **Fix:** Used `Object.values(p.out).reduce(...)` as instructed by the plan.
- **Files modified:** `app/(app)/dashboard/overview/page.tsx`
- **Commit:** `8d7dead`

**2. [Minor cleanup] Removed data.length - 1 from inline comment**
- **Found during:** Task 3 acceptance-criteria verification (grep check)
- **Issue:** Comment text `(never data.length - 1 / December)` caused the acceptance-criteria grep to return 1 instead of 0.
- **Fix:** Rephrased to `(not naively the last index)` — same intent, no false positive.
- **Files modified:** `app/(app)/dashboard/overview/page.tsx`
- **Commit:** `8d7dead`

## Known Stubs

None — all data flows are wired end-to-end. `initialMovers` is pre-fetched server-side; `fetchMovers` is called on every subsequent bar click.

## Threat Flags

No new security surface beyond what the plan's threat model covers:
- `monthIndex` from bar click is bounded server-side in `fetchMovers` (T-45-01, Plan 01).
- Initial prefetch runs inside the authenticated server component (T-45-02, Plan 01).
- Panel strings rendered as React text children — no `dangerouslySetInnerHTML` (T-45-04).

---

## Self-Check: PASSED

Files created/modified:

- [x] `components/dashboard/overview/overview-chart.tsx` — exists
- [x] `components/dashboard/overview/overview-movers-panel.tsx` — exists (new)
- [x] `components/dashboard/overview/overview-movers-section.tsx` — exists (new)
- [x] `app/(app)/dashboard/overview/page.tsx` — exists

Commits verified:

- [x] `5318490` — feat(45-02): make OverviewChart controlled
- [x] `3b99370` — feat(45-02): add OverviewMoversPanel + OverviewMoversSection
- [x] `8d7dead` — feat(45-02): wire deriveDefaultMonthIndex + initial movers prefetch
