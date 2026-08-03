---
phase: 84-category-detail-and-cleanup
plan: 1
subsystem: ui
tags: [nextjs, drizzle, decimal.js, category-detail, sticky-table, url-contract]

requires:
  - phase: 82-number-engine-and-regression-gate
    provides: getCoveredMonthsInYear, getCategoryMonthlyAmounts, computePaceAndProjection,
      computeCurrentMonthHybrid, buildYearSeries, computeComparison, resolveComparisonJudgement,
      isPartialMonth, MIN_COVERED_MONTHS_FOR_PACE
  - phase: 83-categories-list
    provides: CategoryYearSelect, resolveYear, resolveCategoryDirectionCopy, LensPassthrough,
      the ?year=/?type=/?lens= Categories URL contract precedent
provides:
  - "?year=&months=&from= URL contract for /dashboard/categories/[id] (D-01/D-02/D-03/D-04)"
  - "getCategoryDetailMeta + getCategoryDetailYearWindow DAL: month-state classification
    (covered/current/estimated/uncovered), pace/projection from the full year, per-cell
    month-over-month delta, D-10 reduced-denominator total/average"
  - "CategoryDetailTable: sticky-column 12-month table row 1 (net-new mechanic, no prior
    precedent in this codebase per 84-PATTERNS.md)"
  - "CategoryDetailWindowControls: segmented window length control + start-month select,
    wired to the URL via router.replace, D-04 year-preserves-window re-anchoring"
  - "lib/routes.ts DashboardCategoryFilters.months/from + buildYearModeSearch extension"
affects: [84-02-previous-year-chart-and-subcategories, 84-03-retire-deviation-baseline,
  84-04-context-glossary-rewrite]

actuals:
  tokens: 14500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Sticky-column table (position: sticky left-0/right-0 + opaque bg + z-20 on every
      cell, border-separate border-spacing-0 on <table>) — first use in this codebase,
      modeled directly on the locked prototype (.scratch/dashboard-categories/detail-table.html)"
    - "Pure/exported helper functions (parseCategoryDetailWindow, buildStartMonthOptions)
      for unit-testability without jsdom, following the repo's established
      buildTagFilterSearch/computeMergeEligibility precedent"
    - "URL-param round trip proven via a dedicated test that composes two independent
      parsers' output (CategoryYearSelect's mutation + parseCategoryDetailWindow) instead
      of asserting each in isolation"

key-files:
  created:
    - lib/validations/category-year-window.ts
    - lib/dal/category-detail-year-window.ts
    - components/dashboard/category-detail-table.tsx
    - components/dashboard/category-detail-window-controls.tsx
    - tests/category-detail-window.test.ts
    - tests/category-detail-year-window-dal.test.ts
    - tests/category-detail-table.test.tsx
  modified:
    - app/(app)/dashboard/categories/[id]/page.tsx
    - lib/routes.ts

key-decisions:
  - "Window's first column never renders a delta line at all — not even 'nessun confronto'
    — since it has no in-window predecessor by definition, distinct from a covered month
    whose predecessor exists but lacks a real amount"
  - "getCategoryDetailMeta replicates getCategoryDetail's existing metadata subquery
    verbatim (same allocation-category gap, same type-fallback), per plan instruction —
    widening it is out of this plan's scope"
  - "Test file renamed tests/category-detail-table.test.ts -> .test.tsx (JSX requires the
    x extension under this repo's esbuild/vite loader — verified by direct parse-error
    reproduction)"

patterns-established:
  - "Sticky-column table mechanic (Tailwind sticky left-0/right-0 + opaque bg + z-20 +
    border-separate) — the reference for any future multi-column pinned table in this repo"

requirements-completed: [CDET-01, CDET-03, CDET-06]

coverage:
  - id: D1
    description: "?year=&months=&from= URL contract with D-01/D-02/D-03 clamping
      (parseCategoryDetailWindow): whole-year default, D-02 ends-on-current-month
      default for a reduced window, out-of-range from clamped never rejected, year
      boundary never crossed"
    requirement: "CDET-03"
    verification:
      - kind: unit
        ref: "tests/category-detail-window.test.ts#parseCategoryDetailWindow (D-01/D-02/D-03, Task 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "getCategoryDetailYearWindow: month-state classification
      (covered/current/estimated/uncovered), pace/projection computed once from the
      full year's pace-eligible Covered Months, current-month hybrid, per-cell
      month-over-month delta, D-10 total/average excluding uncovered months"
    requirement: "CDET-01"
    verification:
      - kind: unit
        ref: "tests/category-detail-year-window-dal.test.ts#getCategoryDetailYearWindow (D-06/D-07/D-10, Task 1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "CategoryDetailTable renders row 1 as a sticky-column 12-month table:
      first column sticky left, summary column sticky right, per-cell delta as a second
      text line, three visually distinct month states, literal 'non importato' for
      uncovered months, D-10 reduced-denominator qualifiers on Totale/Media"
    requirement: "CDET-06"
    verification:
      - kind: unit
        ref: "tests/category-detail-table.test.tsx#CategoryDetailTable (D-06/D-10, Task 1)"
        status: pass
      - kind: manual_procedural
        ref: "Dev server + browser walkthrough of /dashboard/categories/[id]?year=<year> —
          approved by user at the tracer checkpoint"
        status: pass
    human_judgment: true
    rationale: "Sticky-column CSS behavior (position: sticky, opaque backgrounds, z-index
      layering during horizontal scroll) and the three month-state visual treatments are
      not provable by renderToStaticMarkup alone — confirmed by human visual check at the
      Task 1 tracer checkpoint."
  - id: D4
    description: "CategoryDetailWindowControls (segmented window length + start-month
      select) wired to the URL; routes.ts D-04 extension; D-04 year-preserves-window
      round trip proven end-to-end"
    requirement: "CDET-03"
    verification:
      - kind: unit
        ref: "tests/category-detail-window.test.ts#D-04 year-preserves-window round trip (Task 2)"
        status: pass
      - kind: unit
        ref: "tests/category-detail-window.test.ts#buildDashboardCategoryDetailHref — window params (D-01/D-04, Task 2)"
        status: pass
      - kind: unit
        ref: "tests/category-detail-window.test.ts#buildStartMonthOptions (D-03, Task 2)"
        status: pass
    human_judgment: false

duration: ~40min (session spanned one tracer checkpoint pause for human verification)
completed: 2026-08-03
status: complete
---

# Phase 84 Plan 1: Category Detail Foundation — URL Contract, Year-Window DAL, Table Row 1 Summary

**Category detail page rewritten onto the `?year=&months=&from=` contract with a new year-window DAL and a sticky-column 12-month table (row 1), then made interactive with window/year controls proving D-04's re-anchoring with zero extra code.**

## Performance

- **Duration:** ~40 min across two tasks, with one tracer checkpoint pause for human verification in between
- **Completed:** 2026-08-03T12:20:45Z
- **Tasks:** 2 (Task 1 tracer + Task 2 auto)
- **Files modified:** 9 (7 created, 2 modified)

## Accomplishments

- New `?year=&months=&from=` URL contract for `/dashboard/categories/[id]`: `parseCategoryDetailWindow` is the single window-clamping site (D-01/D-02/D-03), never throws, never crosses the year boundary.
- New `lib/dal/category-detail-year-window.ts`: `getCategoryDetailMeta` (category id/name/slug/direction) and `getCategoryDetailYearWindow` (month-state classification, pace/projection from the full year, current-month hybrid, per-cell month-over-month delta, D-10 total/average that excludes uncovered months from both sum and denominator).
- New `CategoryDetailTable`: the first sticky-column table in this codebase (no prior precedent — confirmed via 84-PATTERNS.md's grep), modeled on the locked prototype (`.scratch/dashboard-categories/detail-table.html`). Independently reproduces the prototype's own printed numbers (pace 406,00, total 4.540,30, average 412,75, all five per-cell deltas) from a from-scratch test fixture, which is a strong correctness signal on top of passing assertions.
- Page rewritten to the new contract: `DashboardFilters`/`parseDashboardFilters`/`CATEGORY_DETAIL_DEFAULT_PRESET`/`getCategoryDeviations`/`getCategoryDetail` all removed from this file (grep-at-zero verified); category-null redirect now happens before any Suspense boundary.
- New `CategoryDetailWindowControls`: segmented Anno intero/9/6/3 mesi control + start-month select, wired via `router.replace` exactly like `CategoryYearSelect`; never touches the `year` param itself.
- `lib/routes.ts`'s `DashboardCategoryFilters`/`buildYearModeSearch` extended with `months`/`from`, mirroring the existing `type`/`sort` "only when non-default" pattern; list hrefs (`buildDashboardCategoriesHref`) untouched — the list has no window (D-04).
- D-04's year-preserves-window re-anchoring proven by an explicit round-trip test that composes `CategoryYearSelect`'s own URL mutation with `parseCategoryDetailWindow` — zero new re-anchoring code needed.

## Task Commits

1. **Task 1: Year+window URL parser, year-window DAL (current-year series), table row 1 end-to-end** - `e6bc12bf` (feat, tracer)
2. **Task 2: Window controls UI, routes.ts D-04 extension, year-preserves-window round trip** - `8e549daf` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified

- `lib/validations/category-year-window.ts` - `parseCategoryDetailWindow` (D-01/D-02/D-03 window clamp), `CATEGORY_DETAIL_WINDOW_LENGTHS`, `CategoryDetailWindow`/`CategoryDetailWindowLength` types
- `lib/dal/category-detail-year-window.ts` - `getCategoryDetailMeta`, `getCategoryDetailYearWindow`, month-state/series types
- `components/dashboard/category-detail-table.tsx` - `CategoryDetailTable`, the sticky-column row-1 renderer
- `components/dashboard/category-detail-window-controls.tsx` - `CategoryDetailWindowControls`, `buildStartMonthOptions`
- `app/(app)/dashboard/categories/[id]/page.tsx` - rewritten to the new URL contract, wires both controls + the table
- `lib/routes.ts` - `DashboardCategoryFilters.months`/`.from`, `buildYearModeSearch` extension
- `tests/category-detail-window.test.ts` - parser tests, D-04 round trip, href tests, `buildStartMonthOptions` tests
- `tests/category-detail-year-window-dal.test.ts` - DAL month-state/pace/delta/D-10 tests
- `tests/category-detail-table.test.tsx` - component render tests (renamed from the plan's `.ts` — see Deviations)

## Decisions Made

- `getCategoryDetailMeta` replicates `getCategoryDetail`'s existing metadata subquery verbatim, including its known allocation-category gap — widening that predicate is explicitly out of this plan's scope (CR-01 in `category-ranking-list.tsx` already prevents an allocation category from linking here).
- The window's first column never shows a delta line at all (neither a computed delta nor "nessun confronto") — it has no in-window predecessor, which is a distinct case from a covered/current month whose predecessor exists but has no real amount.
- `subcategories`/`topTransactions`/`previousYear` are typed as empty/`null` placeholders on `CategoryDetailYearWindowData` for Plan 84-02 to fill in — a tracer stub, not an architecture change later.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test file extension corrected from `.test.ts` to `.test.tsx`**
- **Found during:** Task 1 (writing `tests/category-detail-table.test.ts` per the plan's literal filename)
- **Issue:** The plan's frontmatter/action block names the component test file `tests/category-detail-table.test.ts`, but the file contains JSX. Running it produced a hard parse error (`Expected '>' but found Identifier`) under this repo's vite/esbuild transform, which does not apply the JSX loader to `.ts` files.
- **Fix:** Created the file as `tests/category-detail-table.test.tsx` instead — matching the repo's own existing convention (`tests/category-detail-components.test.tsx`).
- **Files modified:** `tests/category-detail-table.test.tsx` (created directly with the correct extension; no `.ts` version was ever committed)
- **Verification:** `vitest run tests/category-detail-table.test.tsx` — 7/7 tests pass
- **Committed in:** `e6bc12bf` (Task 1 commit)

**2. [Rule 1 - Bug] Component logic fix: window index 0 must never render "nessun confronto"**
- **Found during:** Task 1, while writing the component's own tests
- **Issue:** The initial implementation suppressed the delta *value* for the first column but still fell through to rendering the literal "nessun confronto" placeholder whenever `monthOverMonthDelta` was `null` and the month had a real amount — which is also true for index 0 (the DAL always returns `null` there). This produced a spurious "nessun confronto" on the window's very first cell, contradicting the must-have "the window's first column never shows a delta".
- **Fix:** Added an explicit `index > 0` gate (`showDeltaLine`) before rendering either the computed delta or the "nessun confronto" fallback.
- **Files modified:** `components/dashboard/category-detail-table.tsx`
- **Verification:** `tests/category-detail-table.test.tsx`'s "index 0 never carries a delta line" test
- **Committed in:** `e6bc12bf` (Task 1 commit)

**3. [Rule 3 - Blocking] `yarn typecheck` does not exist in this repo — substituted `tsc --noEmit`**
- **Found during:** Task 1, running the phase-level `<verification>` block's `yarn typecheck` command
- **Issue:** `package.json` has no `typecheck` script (confirmed by grep).
- **Fix:** Ran `node_modules/.bin/tsc --noEmit -p tsconfig.json` directly instead — equivalent check, clean on every commit in this plan.
- **Files modified:** none (verification-only)
- **Verification:** `tsc --noEmit` clean after both tasks
- **Committed in:** n/a (not a code change)

---

**Total deviations:** 3 auto-fixed (1 bug — test extension, 1 bug — component logic, 1 blocking — missing script)
**Impact on plan:** All three were necessary to make the plan's own acceptance criteria pass as literally stated (a first-column "no delta" must-have, and a runnable test suite). No scope creep — no file outside this plan's `files_modified` list was touched.

## Issues Encountered

None beyond the three deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `CategoryDetailYearWindowData`'s `previousYear`/`subcategories`/`topTransactions` fields are typed and present (as `null`/`[]`), ready for Plan 84-02 to populate without any type change.
- The sticky-column table mechanic and its Tailwind classes are established and directly reusable for Plan 84-02's previous-year row and subcategory table.
- Retired symbols (`getCategoryDetail`, `getCategoryDeviations`, `DashboardFilters`, `dashboard-filters.tsx`) remain fully intact everywhere else in the codebase — only this page's own imports of them were removed, as required for Plan 84-03/84-04's later, isolated removal (D-17).
- No blockers for Plan 84-02.

---
*Phase: 84-category-detail-and-cleanup*
*Completed: 2026-08-03*
