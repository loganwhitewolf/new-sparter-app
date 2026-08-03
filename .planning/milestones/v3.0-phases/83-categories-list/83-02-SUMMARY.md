---
phase: 83-categories-list
plan: 02
subsystem: ui
tags: [nextjs, zod, dashboard, url-contract, categories]

# Dependency graph
requires:
  - phase: 82-number-engine-and-regression-gate
    provides: Covered/Partial Month engine, pace/projection service, direction.hidden predicate contract (consumed later by 83-03/83-04, not this plan)
provides:
  - "CategoryYearDirectionSchema / CategoryYearSortSchema + parseCategoryYearDirection / parseCategoryYearSort in lib/validations/dashboard.ts (total, never-throwing)"
  - "Additive `year` mode on buildDashboardCategoriesHref / buildDashboardCategoryDetailHref in lib/routes.ts, byte-identical preset-mode fallback when `year` is omitted"
  - "buildDashboardTabHref propagates `year` (never `preset`) across Overview/Categories/Tags"
  - "Category detail page receives an optional `year` searchParam and forwards it into its own back link"
affects: [83-03-categories-list-page, 83-04-categories-list-row-and-sparkline, 84-category-detail-and-cleanup]

actuals:
  tokens: 3598
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Additive URL-contract mode: a new optional field (`year`) branches at the top of an
       existing href builder and returns early, leaving the pre-existing default-path logic
       completely unreached and unmodified for callers who omit the new field."
    - "Total, never-throwing searchParam parsers: `raw ?? <default>` candidate is validated
       against a zod schema; invalid input falls back to the same default, never to `undefined`
       from a defaulted zod parse (avoids the raw-value-vs-parsed-default mismatch bug)."

key-files:
  created:
    - tests/dashboard-year-contract.test.ts
  modified:
    - lib/validations/dashboard.ts
    - lib/routes.ts
    - components/dashboard/dashboard-tab-nav.tsx
    - "app/(app)/dashboard/categories/[id]/page.tsx"
    - tests/dashboard-filters.test.ts

key-decisions:
  - "DashboardCategoryFilters.type widened to 'in' | 'out' | 'allocation' and .sort widened to
     DashboardSort | CategoryYearSort — additive TS-only widening (no runtime behavior change for
     'in'|'out'/'deviation'|'amount' values), required so the year-mode branch can actually accept
     CLIST-04's third direction and CLIST-03's projection sort at the type level."
  - "Year-mode search-string construction factored into a shared buildYearModeSearch() helper
     used by both buildDashboardCategoriesHref and buildDashboardCategoryDetailHref, instead of
     duplicating the branch inline in each function as the plan's action text literally described
     — same behavior, less duplication."

patterns-established:
  - "Total parser candidate pattern: `const candidate = raw ?? '<default>'; return
     Schema.safeParse(candidate).success ? candidate : '<default>'` — avoids relying on a zod
     `.default()` to fill in the return value, which would silently return `undefined` cast to the
     schema's type on the safeParse(undefined) success path."

requirements-completed: [CLIST-03, CLIST-05, CLIST-07]

coverage:
  - id: D1
    description: "Additive, total, never-throwing parseCategoryYearDirection/parseCategoryYearSort in lib/validations/dashboard.ts, with 'deviation' retired vocabulary falling back to 'amount' (CLIST-03 sort contract)"
    requirement: CLIST-03
    verification:
      - kind: unit
        ref: "tests/dashboard-year-contract.test.ts#parseCategoryYearDirection / parseCategoryYearSort (D-09, D-08)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Additive year-mode branch in buildDashboardCategoriesHref/buildDashboardCategoryDetailHref; every pre-existing preset-mode test in tests/dashboard-filters.test.ts passes unedited (zero diff verified via git diff --stat)"
    requirement: CLIST-05
    verification:
      - kind: unit
        ref: "tests/dashboard-year-contract.test.ts#buildDashboardCategoriesHref / buildDashboardCategoryDetailHref — year mode (D-12, CLIST-05)"
        status: pass
      - kind: unit
        ref: "tests/dashboard-filters.test.ts (full file, unedited by Task 1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "buildDashboardTabHref drops ?preset= entirely and propagates ?year= instead, across Overview/Categories/Tags; ?lens= and ?type=/?sort= propagation unchanged"
    requirement: CLIST-05
    verification:
      - kind: unit
        ref: "tests/dashboard-filters.test.ts#buildDashboardTabHref"
        status: pass
    human_judgment: false
  - id: D4
    description: "Category detail page receives an optional, total ?year= searchParam and forwards it into its own back link via buildDashboardCategoriesHref's year-mode branch; own preset-based DAL calls untouched"
    requirement: CLIST-07
    verification:
      - kind: unit
        ref: "yarn build (typecheck + route compile), grep -c on the searchParams type and backHref call site"
        status: pass
    human_judgment: true
    rationale: "The page-level wiring (searchParams -> year -> backHref) is thin glue over
      D2's already-unit-tested href builder; no dedicated RSC test harness exists in this repo
      for app/(app)/dashboard/categories/[id]/page.tsx (it is source-verified + typechecked +
      build-verified only, consistent with this repo's existing test coverage for that file).
      A human should visually confirm CLIST-07's coherence test (clicking a row and returning
      does not change the selected year) once Plan 83-04 wires the row's year-carrying link."

duration: 7min
completed: 2026-07-31
status: complete
---

# Phase 83 Plan 02: Year URL Contract Summary

**Additive `?year=` URL contract (D-12) replacing `?preset=` across the tab nav and the Categories href builders, with total/never-throwing direction and sort parsers for the upcoming three-way direction switch and projection sort.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-31T15:18:45+02:00 (end of prior plan 83-01)
- **Completed:** 2026-07-31T15:25:47+02:00
- **Tasks:** 2
- **Files modified:** 5 (+1 created)

## Accomplishments
- `CategoryYearDirectionSchema`/`CategoryYearSortSchema` and their total parsers landed in
  `lib/validations/dashboard.ts`, additive alongside the untouched preset-era schemas the
  category detail page and the v2.8/v2.9 regression harness still depend on.
- `buildDashboardCategoriesHref`/`buildDashboardCategoryDetailHref` gained an additive year-mode
  branch (`lib/routes.ts`) that only activates when `filters.year !== undefined`, leaving the
  existing preset-based body — and every one of its 8 pre-existing tests — byte-identical.
- `buildDashboardTabHref` (`dashboard-tab-nav.tsx`) now propagates `year` instead of `preset`
  across Overview/Categories/Tags (CLIST-05); `type`/`sort`/`lens` propagation is unchanged.
- The category detail page (`app/(app)/dashboard/categories/[id]/page.tsx`) receives an optional
  `year` searchParam (garbage input degrades to `undefined`, never throws — T-83-03) and forwards
  it into its own back link, so a row clicked with `?year=` returns to the list on the same year
  (D-13, CLIST-07) — with zero changes to the page's own `getCategoryDetail`/`getCategoryDeviations`
  calls or its preset-based `DashboardFilters` control.

## Task Commits

Each task was committed atomically:

1. **Task 1: Additive year/direction/sort parsers + year-mode href builders (D-12)** - `2f59a881` (feat)
2. **Task 2: buildDashboardTabHref year propagation + detail page year receipt/back-link (CLIST-05, D-13, CLIST-07)** - `548023b9` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `lib/validations/dashboard.ts` - `CategoryYearDirectionSchema`, `CategoryYearSortSchema`, `parseCategoryYearDirection`, `parseCategoryYearSort` (additive)
- `lib/routes.ts` - `DashboardCategoryFilters.year?: number`, widened `type`/`sort` unions, year-mode branch (via a shared `buildYearModeSearch` helper) in both href builders
- `components/dashboard/dashboard-tab-nav.tsx` - `buildDashboardTabHref` drops `preset`, reads/sets `year` first
- `app/(app)/dashboard/categories/[id]/page.tsx` - `year` searchParam type + total year parsing + `backHref` now calls `buildDashboardCategoriesHref({ year, type, lens })`
- `tests/dashboard-year-contract.test.ts` - new: parser behavior + year-mode href behavior + CLIST-05 round-trip precision probe
- `tests/dashboard-filters.test.ts` - `buildDashboardTabHref` describe block updated to assert `year` propagation instead of `preset`

## Decisions Made
- Widened `DashboardCategoryFilters.type`/`.sort` unions (TS-only, additive) so the year-mode
  branch can carry CLIST-04's `allocation` direction and CLIST-03's `projection` sort — the
  plan's action text said this widening wasn't required, but the plan's own `<behavior>` block
  calls `buildDashboardCategoriesHref({ type: 'allocation', sort: 'projection' })` directly,
  which does not typecheck against the pre-existing `'in' | 'out'` / `DashboardSort` unions.
- Factored the year-mode query-string construction into one shared `buildYearModeSearch()`
  helper reused by both href builders, instead of the literal duplicated-inline-branch shape the
  plan's action text described — same observable behavior, no duplicated logic to drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Widened `DashboardCategoryFilters.type`/`.sort` TS unions**
- **Found during:** Task 1 (writing the year-mode href tests from the plan's own `<behavior>` block)
- **Issue:** The plan's action text says "this plan does not need to widen `DashboardCategoryFilters.type`", but the plan's `<behavior>` block requires `buildDashboardCategoriesHref({ year: 2026, type: 'allocation', sort: 'projection' })` to compile and return `.../categories?year=2026&type=allocation&sort=projection` — impossible against the pre-existing `type?: 'in' | 'out'` / `sort?: DashboardSort` ('deviation'|'amount') field types.
- **Fix:** Widened `type` to `'in' | 'out' | 'allocation'` and `sort` to `DashboardSort | CategoryYearSort`. Additive TS-only change — no runtime behavior differs for any pre-existing `'in'|'out'`/`'deviation'|'amount'` caller.
- **Files modified:** `lib/routes.ts`
- **Verification:** `tsc --noEmit` clean; `tests/dashboard-filters.test.ts` (preset-mode, untouched) still green.
- **Committed in:** `2f59a881` (Task 1 commit)

**2. [Rule 1 - Bug] Rewrote two `buildDashboardTabHref` tests that used `?preset=` as an incidental baseline param**
- **Found during:** Task 2 (running the targeted `buildDashboardTabHref` test suite after the D-12 edit)
- **Issue:** The plan's action text said to "leave the tag-drop and lens-forwarding tests (lines 132-182) untouched" as orthogonal to the `preset`→`year` change. Two of those tests (`'omits ?tag= ... when absent'`, `'omits ?lens= ... when absent'`) used `new URLSearchParams({ preset: 'last-3-months' })` as their baseline "some filter param is present" fixture and asserted `preset=last-3-months` in the expected output — which broke once `buildDashboardTabHref` stopped reading `preset` at all (its actual purpose, tag/lens omission, was unaffected).
- **Fix:** Swapped the baseline param in both tests from `preset: 'last-3-months'` to `year: '2026'`, updating the expected output strings to match; the tests still assert the same tag/lens-omission behavior they always did.
- **Files modified:** `tests/dashboard-filters.test.ts`
- **Verification:** `node_modules/.bin/vitest run tests/dashboard-filters.test.ts` — 34/34 pass.
- **Committed in:** `548023b9` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — pre-existing test/type assumptions the plan's prose got slightly wrong; neither is scope creep)
**Impact on plan:** Both fixes were required for the plan's own stated `<behavior>`/acceptance criteria to hold. No architectural changes, no new files beyond the one the plan specified.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The year URL contract (`?year=`) is live end-to-end: tab nav propagation, both Categories href
  builders, and the detail page's back link all honor it, with the preset-based path completely
  unreached when `year` is present.
- `CategoryYearDirection`/`CategoryYearSort` and their parsers are ready for Plan 83-03 (the list
  page rewrite) and Plan 83-04 (the row/sparkline work) to consume directly.
- No blockers. Full suite green (174 files / 2159 tests + 1 todo), `yarn build` and
  `yarn check:language` both clean.

---
*Phase: 83-categories-list*
*Completed: 2026-07-31*

## Self-Check: PASSED

All created/modified files and both task commit hashes (`2f59a881`, `548023b9`) verified present.
