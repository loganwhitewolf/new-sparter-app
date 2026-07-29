---
phase: 80-dashboard-accrual-lens
plan: 04
subsystem: dashboard
tags: [nextjs, react, url-state, drizzle]

# Dependency graph
requires:
  - phase: 80-dashboard-accrual-lens (Plan 80-01)
    provides: LedgerRowSource type + resolveLedgerRowSource(lens), Lens type + parseLensParam(value), the ledgerRowSource-parameter pattern proven on getOverview
  - phase: 80-dashboard-accrual-lens (Plan 80-03)
    provides: getOverviewChart/getMonthOverMonthCategoryChanges gain ledgerRowSource, getYearsWithData gains lens, resolveYear gains yearsForOtherLens (D-10 cross-lens clamp)
provides:
  - "/dashboard/overview fetches getYearsWithData for BOTH lenses unconditionally and resolves the active year via the extended resolveYear(requested, yearsForActiveLens, yearsForOtherLens) — the D-10 cross-lens clamp is now wired into a real navigation path"
  - "Every widget on /dashboard/overview (KPI totals, 12-month bar chart incl. prior-year YoY comparison, movers drill-down for in/out/allocation) reads the SAME resolved ledgerRowSource — no per-call re-derivation (T-80-08 closed)"
  - "buildDashboardTabHref (components/dashboard/dashboard-tab-nav.tsx) preserves ?lens= across Overview <-> Categorie <-> Tag tab navigation, mirroring the existing preset/type/sort/tag preservation (D-03)"
affects: [80-05, 80-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Page-level lens resolution now happens BEFORE the year fetch, not after: parseLensParam runs first, then getYearsWithData is called for both lenses in parallel, then resolveYear picks the active year — this ordering is required because the D-10 clamp needs to know which lens is active to know which years[] is 'active' vs 'other'"

key-files:
  created: []
  modified:
    - app/(app)/dashboard/overview/page.tsx
    - components/dashboard/dashboard-tab-nav.tsx
    - tests/dashboard-filters.test.ts

key-decisions: []

patterns-established: []

requirements-completed: [LENS-04, LENS-05]

# Coverage metadata
coverage:
  - id: D1
    description: "/dashboard/overview fetches getYearsWithData('cassa') and getYearsWithData('competenza') unconditionally, derives yearsForActiveLens/yearsForOtherLens, and calls the extended resolveYear(requested, active, other) for the D-10 cross-lens clamp"
    requirement: "LENS-05"
    verification:
      - kind: unit
        ref: "node_modules/.bin/tsc --noEmit (type-level proof the 3-argument resolveYear call and the both-lens getYearsWithData calls compile against Plan 80-03's signatures)"
        status: pass
      - kind: unit
        ref: "tests/resolve-year.test.ts (Plan 80-03, unmodified — proves the D-10 clamp logic this page now calls)"
        status: pass
    human_judgment: true
    rationale: "The interactive click-through (visit ?lens=competenza&year=2030, confirm the year selector offers 2030, flip to cassa, confirm the clamp to the latest cash year instead of an empty state) requires a live browser session; this sandbox has no browser-automation tool. The underlying logic (resolveYear's D-10 branch, getYearsWithData's competenza UNION) is proven by Plan 80-03's real-Postgres and unit tests; this plan's own proof is limited to tsc + the full test suite passing with the new call sites wired in, consistent with Plan 80-01's D5 precedent for this exact class of gap."
  - id: D2
    description: "getOverviewChart (current + prior year for YoY deltas) and all three getMonthOverMonthCategoryChanges calls (in/out/allocation) receive the SAME resolved ledgerRowSource the KPI totals (getOverview) use — never re-derived per call site"
    requirement: "LENS-04"
    verification:
      - kind: integration
        ref: "tests/amortization-lens-regression-overview.test.ts (Plan 80-03, unmodified — proves getOverviewChart/getMonthOverMonthCategoryChanges are lens-correct at the DAL layer this page now calls with a single shared ledgerRowSource variable)"
        status: pass
      - kind: unit
        ref: "node_modules/.bin/tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "Confirming the chart/movers/KPIs visually update TOGETHER on a lens flip requires a live browser session (this plan's own <verification> block explicitly calls for a manual visit). The code-level guarantee (one ledgerRowSource const threaded to every call site, verified by direct code reading of the diff) and the full automated suite passing are the proof available in this sandbox."
  - id: D3
    description: "buildDashboardTabHref preserves a present lens searchParam and omits it when absent, for all three tab hrefs (overview, categories, tags)"
    requirement: "LENS-01"
    verification:
      - kind: unit
        ref: "tests/dashboard-filters.test.ts#buildDashboardTabHref forwards ?lens= across Overview <-> Categorie <-> Tag tab switches (Phase 80)"
        status: pass
      - kind: unit
        ref: "tests/dashboard-filters.test.ts#buildDashboardTabHref omits ?lens= (not forced) when absent from the current params"
        status: pass
    human_judgment: false

# Metrics
duration: ~15min
completed: 2026-07-29
status: complete
---

# Phase 80 Plan 04: dashboard-accrual-lens overview end-to-end wiring Summary

**`/dashboard/overview` now fetches both lenses' years unconditionally, resolves the active year through the D-10 cross-lens clamp, and threads one shared `ledgerRowSource` into the KPI totals, 12-month chart (incl. prior-year YoY), and movers drill-down; `buildDashboardTabHref` carries `?lens=` across tab navigation exactly like `preset`/`type`/`sort`/`tag`.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-29T11:36:07+02:00
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- `app/(app)/dashboard/overview/page.tsx` — `parseLensParam` now runs before the year fetch; `getYearsWithData('cassa')` and `getYearsWithData('competenza')` are fetched in parallel unconditionally (both are needed for the cross-lens clamp regardless of which lens is active); `yearsForActiveLens`/`yearsForOtherLens` are derived from the active lens and passed into the extended `resolveYear(requested, active, other)` (Plan 80-03's D-10 clamp)
- The single `ledgerRowSource` resolved for `getOverview`'s KPI totals is now threaded into `getOverviewChart(year, ledgerRowSource)`, `getOverviewChart(year - 1, ledgerRowSource)` (the prior-year chart feeding YoY deltas), and all three `getMonthOverMonthCategoryChanges(year, defaultMonthIndex, direction, 10, ledgerRowSource)` calls (in/out/allocation) — one variable, never re-derived per call site, closing T-80-08
- `buildDashboardTabHref` (`components/dashboard/dashboard-tab-nav.tsx`) reads a `lens` searchParam and sets it on the built href when present, mirroring the existing `preset`/`type`/`sort`/`tag` precedent line-for-line
- `tests/dashboard-filters.test.ts` — two new test cases for `buildDashboardTabHref`: forwards `?lens=` across all three tab hrefs, and omits it (not forced) when absent

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire /dashboard/overview's chart + movers + year selector to the resolved lens** - `796d9b49` (feat)
2. **Task 2: Preserve ?lens= across dashboard tab navigation** - `e45cfafc` (test, RED) + `56a06445` (feat, GREEN)

**Plan metadata:** committed separately at end of this SUMMARY's creation.

## Files Created/Modified

- `app/(app)/dashboard/overview/page.tsx` - both-lens year fetch, D-10 cross-lens clamp via extended `resolveYear`, `ledgerRowSource` threaded to `getOverviewChart` (both years) and all three `getMonthOverMonthCategoryChanges` calls
- `components/dashboard/dashboard-tab-nav.tsx` - `buildDashboardTabHref` preserves `?lens=` across tab navigation
- `tests/dashboard-filters.test.ts` - two new `buildDashboardTabHref` test cases for the `lens` param (forward-when-present, omit-when-absent)

## Decisions Made

None - plan executed exactly as written. The page-level lens-resolution reordering (parse lens before fetching years, rather than after) is an implementation detail required by the plan's own literal action spec (`yearsForActiveLens = lens === 'competenza' ? ... `), not a deviation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All automated verification passed on the first attempt:
- Task 1: `node_modules/.bin/tsc --noEmit` — clean
- Task 2 RED: `yarn test tests/dashboard-filters.test.ts` — 1 new test failed as expected (before the fix), 27 pre-existing tests passed
- Task 2 GREEN: `yarn test tests/dashboard-filters.test.ts` — 28/28 passing
- Plan-level `<verification>`: `node_modules/.bin/tsc --noEmit && yarn test tests/dashboard-filters.test.ts` — green
- Full suite: `yarn test` — 160 test files, 1952 tests passing, 1 pre-existing todo
- `yarn check:language` — passed

**Known gap (inherited, same class as Plan 80-01's D5/D2 above):** the manual browser click-through this plan's own `<verification>` block calls for ("Manually visit /dashboard/overview, flip the lens, confirm chart + movers + KPIs + year selector all update together") was not driven in this sandbox — no browser-automation tool available. The code-level proof (one shared `ledgerRowSource` const, the 3-argument `resolveYear` call, `tsc` clean, full suite green) and the DAL-layer real-Postgres tests from Plan 80-03 are the evidence available here; recommend a quick manual spot-check before phase-level UAT sign-off.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `/dashboard/overview` is now fully lens-consistent across every widget (KPIs, chart, movers, year selector) and the lens survives tab navigation to `/dashboard/categories` and `/dashboard/tags`.
- Plans 80-05 (categories/categories-detail wiring) and 80-07 (D-03 all-four-routes completion, `requirements.mark-complete` for LENS-01) can now reuse `buildDashboardTabHref`'s lens preservation unmodified — no further changes needed there.
- **Known gap:** the interactive lens-flip click-through on `/dashboard/overview` has not been manually driven end-to-end in this sandbox across Plans 80-01/80-03/80-04 — recommend a single manual pass covering all three (KPI totals, chart/movers, year-selector clamp) before Phase 80's final UAT/audit.

## Self-Check: PASSED

- FOUND: app/(app)/dashboard/overview/page.tsx
- FOUND: components/dashboard/dashboard-tab-nav.tsx
- FOUND: tests/dashboard-filters.test.ts
- FOUND commit: 796d9b49
- FOUND commit: e45cfafc
- FOUND commit: 56a06445

---
*Phase: 80-dashboard-accrual-lens*
*Completed: 2026-07-29*
