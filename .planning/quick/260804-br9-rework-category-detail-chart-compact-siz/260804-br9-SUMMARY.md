---
phase: 260804-br9
plan: 01
subsystem: ui
tags: [react, nextjs, dashboard, categories, dal, drizzle]

# Dependency graph
requires:
  - phase: 84-category-detail-and-cleanup
    provides: getCategoryDetailYearWindow, CategoryDetailTable, CategorySubcategoryBreakdown
provides:
  - "CategoryDetailView ('ytd'|'projection') discriminator replacing the arbitrary months/from window"
  - "getCategoryDetailYearWindow(categoryId, year, view, ledgerRowSource?) — ytd never substitutes computeCurrentMonthHybrid, never includes an 'estimated' month, returns null pace/projection"
  - "CategoryDetailAmountsChart — compact div/flex monthly-amounts bars reusing category-sparkline's resolveBarFillStyle"
  - "CategoryDetailViewToggle — 2-pill YTD/Proiezione toggle, hidden (not disabled) outside the current year"
affects: [category-detail-page, categories-dashboard]

# Actuals (#2632)
actuals:
  tokens: 5894
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "View discriminator over arbitrary window params: one DAL function, one return shape, a closed 2-value enum instead of forking shapes per mode"
    - "Chart/list bar-styling reuse via an exported pure function (resolveBarFillStyle) instead of re-deriving per-state fill/hatch logic per component"

key-files:
  created:
    - components/dashboard/category-detail-view-toggle.tsx
    - tests/category-detail-view-toggle.test.tsx
  modified:
    - lib/validations/category-year-window.ts
    - lib/dal/category-detail-year-window.ts
    - lib/routes.ts
    - components/dashboard/category-sparkline.tsx
    - components/dashboard/category-detail-amounts-chart.tsx (renamed from category-detail-difference-chart.tsx)
    - components/dashboard/category-detail-skeleton.tsx
    - components/dashboard/category-detail-table.tsx
    - app/(app)/dashboard/categories/[id]/page.tsx
    - tests/category-detail-year-window-dal.test.ts
    - tests/category-detail-window.test.ts
    - tests/category-detail-amounts-chart.test.tsx (renamed from category-detail-difference-chart.test.tsx)
    - tests/category-detail-table.test.tsx

key-decisions:
  - "Chart component/test renamed to category-detail-amounts-chart (not kept at the old filename) per orchestrator deviation — git mv preserves history, avoids a permanent misnomer"
  - "ytd's window slice always starts in January (startIndex=0); resolvedMonthCount is the only view-dependent quantity, so a past year's ytd/projection are provably identical by construction, no separate past-year branch"

patterns-established:
  - "resolveBarFillStyle/BarFillStyle exported from category-sparkline.tsx as the single shared per-state (covered/current/estimated/uncovered) bar-fill contract for any future compact chart"

requirements-completed: [CDET-VIEW-01, CDET-VIEW-02, CDET-VIEW-03, CDET-VIEW-04, CDET-VIEW-05]

coverage:
  - id: D1
    description: "Chart above the category detail table renders compact monthly-amounts bars (own spend per month), never a delta/comparison chart"
    requirement: CDET-VIEW-01
    verification:
      - kind: unit
        ref: "tests/category-detail-amounts-chart.test.tsx#renders exactly one bar-column per data.current.months entry, each carrying data-month/data-state — 3-month (ytd-shaped) fixture"
        status: pass
      - kind: unit
        ref: "tests/category-detail-amounts-chart.test.tsx#renders zero <svg elements"
        status: pass
      - kind: unit
        ref: "tests/category-detail-amounts-chart.test.tsx#renders zero delta/comparison vocabulary words"
        status: pass
    human_judgment: true
    rationale: "Visual compactness/layout and real-browser rendering are not provable by unit tests alone — a human should confirm the chart reads as compact on /dashboard/categories/[id]"
  - id: D2
    description: "YTD (default, Jan-current month, no projection) and Proiezione (opt-in, 12 months, pace+hybrid) views govern the whole page via a single view discriminator"
    requirement: CDET-VIEW-02
    verification:
      - kind: unit
        ref: "tests/category-detail-year-window-dal.test.ts#ytd view (CDET-VIEW-02, 260804-br9 Task 1) > current.months has exactly 7 entries (2026-01..2026-07) and none is estimated"
        status: pass
      - kind: unit
        ref: "tests/category-detail-year-window-dal.test.ts#ytd view (CDET-VIEW-02, 260804-br9 Task 1) > the current month (2026-07) is the RAW actual amount, never the pace hybrid"
        status: pass
      - kind: unit
        ref: "tests/category-detail-year-window-dal.test.ts#ytd view (CDET-VIEW-02, 260804-br9 Task 1) > pace and projection are both null"
        status: pass
    human_judgment: false
  - id: D3
    description: "The chosen view governs the whole page — table rows, subcategory breakdown, every total/average — via a single DAL slice shared by all consumers"
    requirement: CDET-VIEW-03
    verification:
      - kind: unit
        ref: "tests/category-detail-table.test.tsx#CategoryDetailTable (D-06/D-10, Task 1)"
        status: pass
    human_judgment: true
    rationale: "Subcategory breakdown and totals coherence across the whole page is best confirmed in a real browser session, not solely by per-component unit tests"
  - id: D4
    description: "?months=/?from= are removed entirely; stale deep links degrade silently to YTD; ?year=/?lens= unchanged"
    requirement: CDET-VIEW-04
    verification:
      - kind: unit
        ref: "tests/category-detail-window.test.ts#parseCategoryDetailView > a bogus view value degrades silently to ytd (CDET-VIEW-04)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A past year hides the view toggle entirely (not disabled) and always shows the complete 12 months"
    requirement: CDET-VIEW-05
    verification:
      - kind: unit
        ref: "tests/category-detail-view-toggle.test.tsx#CategoryDetailViewToggle (CDET-VIEW-02/05, 260804-br9 Task 3)"
        status: pass
    human_judgment: true
    rationale: "The toggle's hide-vs-show gating is wired in the RSC page (app/(app)/dashboard/categories/[id]/page.tsx isCurrentYear check) which has no dedicated test — confirmed by tsc --noEmit + full suite passing but not directly unit-tested; a human should click through year selection in-browser"

duration: 15min
completed: 2026-08-04
status: complete
---

# Quick Task 260804-br9: Rework Category Detail Chart Summary

**Category detail chart replaced with a compact monthly-amounts bar chart reusing the categories-list sparkline's bar styling; the old `12/9/6/3` window controls replaced by a 2-pill YTD/Proiezione toggle that governs the whole page.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-04T06:48:00Z
- **Completed:** 2026-08-04T06:58:04Z
- **Tasks:** 3
- **Files modified:** 17 (2 created, 2 renamed, 1 deleted, 12 modified)

## Accomplishments
- `getCategoryDetailYearWindow` now takes a `view: 'ytd' | 'projection'` discriminator instead of an arbitrary `{months, from}` window; `ytd` never substitutes `computeCurrentMonthHybrid`, never contains an `'estimated'` month, and returns null `pace`/`projection`
- `CategoryDetailAmountsChart` (rewritten in place, renamed from `CategoryDetailDifferenceChart`) renders compact div/flex bars via the categories list's own `resolveBarFillStyle`, with zero SVG and zero delta/comparison vocabulary — that comparison stays confined to the table
- `CategoryDetailViewToggle` replaces the deleted `CategoryDetailWindowControls`: a 2-pill YTD/Proiezione group, hidden (never disabled) outside the current year
- `lib/routes.ts` and `lib/validations/category-year-window.ts` carry no `months`/`from` fields; stale `?months=`/`?from=` deep links silently resolve to YTD

## Task Commits

Each task was committed atomically:

1. **Task 1: DAL/contract — replace the arbitrary window with a YTD/Proiezione view discriminator** - `f5519b31` (feat)
2. **Task 2: Compact monthly-amounts chart, reusing the sparkline's per-state bar styling** - `2987183a` (test, RED) + `96356ec2` (feat, GREEN)
3. **Task 3: YTD/Proiezione toggle, page wiring, table adaptation** - `2beac1e2` (feat)

**Plan metadata:** pending (this commit, made by the orchestrator after SUMMARY/STATE update)

_Note: Task 2 (`tdd="true"`) has two commits — a RED test commit against the renamed-but-not-yet-rewritten component, then a GREEN implementation commit. No REFACTOR commit was needed._

## TDD Gate Compliance

Task 2 (`tdd="true"`) gate sequence verified in git log:
- RED: `2987183a` `test(260804-br9): add failing test for compact category detail amounts chart` — 6/6 new tests failed (component not yet rewritten) before this commit, confirmed via a direct `vitest run` before committing.
- GREEN: `96356ec2` `feat(260804-br9): implement compact monthly-amounts chart reusing sparkline bar styling` — all 6 tests pass.
- REFACTOR: none needed (implementation was clean on first pass).

## Files Created/Modified
- `lib/validations/category-year-window.ts` - `CategoryDetailView`/`parseCategoryDetailView` replace `CategoryDetailWindow`/`parseCategoryDetailWindow`/`CATEGORY_DETAIL_WINDOW_LENGTHS`
- `lib/dal/category-detail-year-window.ts` - `view` discriminator parameter; `year`/`view` replace the `window` field on `CategoryDetailYearWindowData`; window always starts January, length depends on view
- `lib/routes.ts` - `months`/`from` removed from `DashboardCategoryFilters` and `buildYearModeSearch`
- `components/dashboard/category-sparkline.tsx` - `resolveBarFillStyle`/`BarFillStyle` exported (additive)
- `components/dashboard/category-detail-amounts-chart.tsx` - rewritten in place (renamed from `category-detail-difference-chart.tsx`), exports `CategoryDetailAmountsChart`
- `components/dashboard/category-detail-skeleton.tsx` - chart placeholder shrunk to `h-16`, `min-h-[220px]` removed
- `components/dashboard/category-detail-window-controls.tsx` - deleted
- `components/dashboard/category-detail-view-toggle.tsx` - new 2-pill YTD/Proiezione toggle
- `components/dashboard/category-detail-table.tsx` - reads `data.year` instead of `data.window.from`
- `app/(app)/dashboard/categories/[id]/page.tsx` - parses `?view=`, computes `isCurrentYear`, conditionally renders the toggle, passes `view` to the DAL and the renamed chart
- `tests/category-detail-year-window-dal.test.ts` - all calls updated to the `view` argument; new `ytd view` describe block
- `tests/category-detail-window.test.ts` - rewritten around `parseCategoryDetailView` only
- `tests/category-detail-amounts-chart.test.tsx` - rewritten (renamed from `category-detail-difference-chart.test.tsx`) around the new behavior contract
- `tests/category-detail-table.test.tsx` - fixture updated to `year`/`view`
- `tests/category-detail-view-toggle.test.tsx` - new

## Decisions Made
- Followed the orchestrator's approved deviation: renamed `category-detail-difference-chart.tsx`/`.test.tsx` to `category-detail-amounts-chart.tsx`/`.test.tsx` via `git mv` (preserves history) instead of keeping the old filename with a renamed export.
- `ytd`'s window always starts in January (`startIndex = 0`); `resolvedMonthCount` is the only view-dependent quantity in the DAL, so a past year's `ytd` and `projection` are provably identical by construction — no added past-year branch was needed anywhere in `getCategoryDetailYearWindow`.

## Deviations from Plan

None beyond the orchestrator's pre-approved filename deviation (documented above and executed as instructed) - plan executed exactly as written otherwise.

## Issues Encountered
None.

## Verification Results

- `node_modules/.bin/vitest run tests/category-detail-year-window-dal.test.ts tests/category-detail-window.test.ts tests/category-detail-amounts-chart.test.tsx tests/category-detail-table.test.tsx tests/category-detail-view-toggle.test.tsx tests/category-detail-components.test.tsx tests/category-subcategory-breakdown.test.tsx tests/dashboard-year-contract.test.ts tests/category-detail-link.test.ts tests/category-ranking-list.test.tsx` — 10 files, 81 tests, all passing.
- `node_modules/.bin/tsc --noEmit` — clean, no errors.
- `yarn check:language` — passed.
- `node_modules/.bin/vitest run` (full suite) — 189 files, 2259 tests passed, 1 pre-existing todo, 0 failures. No suites were red before or after this task.
- Manual browser smoke (the plan's 4-step `yarn dev` walkthrough) was **not** run in this session — deferred to human verification, since this quick-task execution ran headless with no browser access. See "Next Steps" below.

## Known Stubs

None.

## Next Steps
- Manual smoke-test in browser recommended before merge: (1) current year shows YTD by default (elapsed months only, no projection); (2) switching to Proiezione extends chart/table/subcategory breakdown to 12 months with pre-existing pace/hybrid figures; (3) a past `?year=` hides the toggle and always shows 12 months; (4) a stale `?months=6&from=2026-02` URL renders the YTD default with no error.
- Everything else (CDET-VIEW-01 through 05) is unit-test-covered and typechecks cleanly; the above is presentation/interaction confirmation only.

## Self-Check: PASSED

All created/modified files verified present (or confirmed deleted where the plan required
deletion); all 4 task commit hashes (`f5519b31`, `2987183a`, `96356ec2`, `2beac1e2`) verified in
`git log`.

---
*Phase: 260804-br9*
*Completed: 2026-08-04*
