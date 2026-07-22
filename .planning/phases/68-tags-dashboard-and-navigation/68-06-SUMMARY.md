---
phase: 68-tags-dashboard-and-navigation
plan: 06
subsystem: ui
tags: [nextjs, app-router, drizzle, tag-filter, dashboard]

# Dependency graph
requires:
  - phase: 68-01
    provides: parseTagIdParam / resolveOwnedTagId IDOR defense-in-depth helpers
  - phase: 68-02
    provides: Categorie-tab DAL functions (getCategoryRanking/getCategoryDeviations/getCategoryDetail) accepting tagId
  - phase: 68-03
    provides: Overview-tab DAL functions (getOverview/getOverviewChart/getMonthOverMonthCategoryChanges) accepting tagId, fetchMovers server action tagId arg
  - phase: 68-05
    provides: TagFilterSelect component, buildDashboardTabHref tag forwarding across tab nav
provides:
  - "?tag= read, ownership-validated, and forwarded on all three dashboard-adjacent pages (Overview, Categorie, category detail)"
  - "buildDashboardCategoriesHref/buildDashboardCategoryDetailHref extended to carry tag= losslessly"
  - "Tag filter survives category-ranking-list <-> category-detail navigation and sort-toggle clicks"
  - "Client-side movers-panel month-reselection now also narrows by tagId (Pitfall 4 client half)"
  - "Tag-specific empty-state copy on Overview and Categorie when a tag filter yields zero rows"
affects: [dashboard, tags, navigation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TagFilterSelect rendered as a sibling next to the page's existing filter controls (OverviewHeader's year select, DashboardFilters row) rather than modifying those components"
    - "Page-level verifySession() + resolveOwnedTagId(userId, parseTagIdParam(params)) precedent (from app/(app)/transactions/page.tsx) extended to all three dashboard pages"

key-files:
  created: []
  modified:
    - lib/routes.ts
    - components/dashboard/category-ranking-list.tsx
    - app/(app)/dashboard/overview/page.tsx
    - components/dashboard/overview/overview-movers-section.tsx
    - components/dashboard/overview/overview-empty-state.tsx
    - app/(app)/dashboard/categories/page.tsx
    - app/(app)/dashboard/categories/[id]/page.tsx

key-decisions:
  - "Added a new 'no-data-for-tag' OverviewEmptyState variant (and an equivalent tagId-aware branch in CategoryRankingList's empty state) to satisfy the plan's must_haves copy contract for 'tag filter active, zero matching transactions' — not explicitly spelled out in the task action blocks, but explicitly required by the plan's own must_haves.truths and 68-UI-SPEC.md's locked Copywriting Contract"
  - "Category detail page ([id]/page.tsx) does not render its own TagFilterSelect — matches the existing preset/type pattern where the detail page has no second filter control, only carries the param through backHref"

requirements-completed: [TAG-04]

coverage:
  - id: D1
    description: "buildDashboardCategoriesHref/buildDashboardCategoryDetailHref carry tag= losslessly; CategoryRankingList threads tagId into its detail-page href"
    requirement: "TAG-04"
    verification:
      - kind: unit
        ref: "tests/dashboard-filters.test.ts"
        status: pass
      - kind: unit
        ref: "tests/category-ranking-list.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Overview tab (KPIs, chart, movers panel incl. client-side month reselection) reads/validates ?tag= and narrows consistently"
    requirement: "TAG-04"
    verification:
      - kind: unit
        ref: "tests/overview-dal.test.ts"
        status: pass
      - kind: unit
        ref: "tests/overview-movers.test.tsx"
        status: pass
      - kind: unit
        ref: "tests/overview-movers-action.test.ts"
        status: pass
      - kind: unit
        ref: "tests/step-2-overview.test.tsx"
        status: pass
    human_judgment: true
    rationale: "DAL/action-level tagId threading is unit-tested, but the end-to-end reconciliation claim (KPI sum matches chart sum matches /transactions?tag=X for the same period) and the live click-through UX require a real multi-tag fixture set in a running browser, which this repo's node-only test environment cannot drive."
  - id: D3
    description: "Categorie tab and category detail page read/validate ?tag= and narrow the ranking list, deviation badges, and detail page trend/subcategory/top-transactions data; tag filter survives ranking-list <-> detail navigation and sort-toggle clicks"
    requirement: "TAG-04"
    verification:
      - kind: unit
        ref: "tests/dashboard-dal.test.ts"
        status: pass
      - kind: unit
        ref: "tests/dashboard-filters.test.ts"
        status: pass
    human_judgment: true
    rationale: "Navigation-preservation and cross-page reconciliation (backHref round-trip, foreign tagId silently ignored end-to-end) are asserted at the unit level for the href builders, but the full click-through flow across three real pages needs a browser-driven check this repo's test harness cannot perform."

duration: 12min
completed: 2026-07-21
status: complete
---

# Phase 68 Plan 06: Wire ?tag= through Overview, Categorie, and category detail Summary

**Read, ownership-validate, and forward `?tag=` end-to-end on all three dashboard-adjacent pages, with the filter surviving category-list-to-detail navigation.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-21T12:25:00Z
- **Completed:** 2026-07-21T12:37:27Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- `buildDashboardCategoriesHref`/`buildDashboardCategoryDetailHref` extended with `tag`, and `CategoryRankingList` threads the active `tagId` into its own detail-page links — the tag filter now survives ranking-list <-> detail navigation the same way `preset`/`type`/`sort` already do
- Overview tab (`app/(app)/dashboard/overview/page.tsx`) reads `?tag=`, validates ownership via `resolveOwnedTagId` (fail-closed), forwards `tagId` to `getOverview`/`getOverviewChart`/all three `getMonthOverMonthCategoryChanges` calls, and renders `TagFilterSelect` next to the year selector; `OverviewMoversSection` forwards `tagId` on client-side month reselection, closing Pitfall 4's client-side half
- Categorie tab and category detail page both read/validate `?tag=` and forward it to `getCategoryRanking`/`getCategoryDeviations`/`getCategoryDetail`; `SortToggle` and `backHref` forward `tag` so switching sort order or navigating back never drops the active filter

## Task Commits

1. **Task 1: Carry ?tag= through the category-list <-> category-detail navigation** - `15f30ed` (feat)
2. **Task 2: Wire ?tag= into the Overview tab (KPIs, chart, movers panel)** - `c731b30` (feat)
3. **Task 3: Wire ?tag= into the Categorie tab + category detail page** - `06e1d45` (feat)

_Note: no TDD tasks in this plan — all three tasks are `type="auto"`._

## Files Created/Modified
- `lib/routes.ts` - `DashboardCategoryFilters.tag`, both href builders emit `tag=` when set
- `components/dashboard/category-ranking-list.tsx` - `tagId` prop threaded into detail-page href; tag-aware empty-state copy
- `app/(app)/dashboard/overview/page.tsx` - reads/validates `?tag=`, renders `TagFilterSelect`, forwards `tagId` to all Overview DAL calls
- `components/dashboard/overview/overview-movers-section.tsx` - `tagId` prop forwarded to all three `fetchMovers` calls on month reselection
- `components/dashboard/overview/overview-empty-state.tsx` - new `no-data-for-tag` variant with locked UI-SPEC copy
- `app/(app)/dashboard/categories/page.tsx` - reads/validates `?tag=`, renders `TagFilterSelect`, forwards `tagId`; `SortToggle` forwards `tag`
- `app/(app)/dashboard/categories/[id]/page.tsx` - reads/validates `?tag=`, forwards `tagId`, `backHref` carries `tag`

## Decisions Made
- Added a `no-data-for-tag` `OverviewEmptyState` variant and a `tagId`-aware branch in `CategoryRankingList`'s existing empty state to satisfy the plan's `must_haves.truths` copy contract ("Nessuna transazione con questo tag nel periodo selezionato" / "Cambia periodo o rimuovi il filtro tag per vedere altri dati.") — the individual task `<action>` blocks didn't spell this out mechanically, but it's an explicit `must_haves` truth of this plan and a locked row in 68-UI-SPEC.md's Copywriting Contract, so it was treated as in-scope (Rule 2 — missing critical functionality per the plan's own contract).
- Category detail page intentionally does not render its own `TagFilterSelect` — matches the existing pattern where `preset`/`type` have no second control on that page either; the tag filter is set on the ranking-list page and carried through via the URL param only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added tag-aware empty-state copy on Overview and Categorie**
- **Found during:** Task 2 and Task 3
- **Issue:** The plan's `must_haves.truths` explicitly requires "Nessuna transazione con questo tag nel periodo selezionato" / "Cambia periodo o rimuovi il filtro tag per vedere altri dati." to surface when a tag filter yields zero matching transactions, and this exact copy is locked in 68-UI-SPEC.md's Copywriting Contract — but neither task's `<action>` block instructed adding it. Without it, a tag-filtered empty period would show the generic "no data for this year" / "no categories in this period" messages, which would misleadingly point the user at the wrong control (year/period instead of the tag filter).
- **Fix:** Added a `no-data-for-tag` variant to `OverviewEmptyState` (selected when `isYearWithNoData` is true and `tagId` is set) and a `tagId`-conditional branch in `CategoryRankingList`'s existing empty-state block.
- **Files modified:** `components/dashboard/overview/overview-empty-state.tsx`, `app/(app)/dashboard/overview/page.tsx`, `components/dashboard/category-ranking-list.tsx`
- **Verification:** Existing test suites (`tests/category-ranking-list.test.tsx`, `tests/step-2-overview.test.tsx`) still pass unchanged (no test asserted the previous generic-only behavior); `yarn check:language` passes on the new Italian product copy.
- **Committed in:** `c731b30` (Task 2), `06e1d45` (Task 3)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary to satisfy the plan's own locked must_haves truth and the UI-SPEC's Copywriting Contract; no scope creep beyond that contract.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TAG-04 is now fully wired at the page level across all three dashboard-adjacent surfaces (Overview, Categorie, category detail), completing what Plans 68-01/02/03/05 built at the DAL/component level.
- Human/browser-driven verification still recommended for the full reconciliation claim (KPI sum = chart sum = `/transactions?tag=X` for the same period) across a real multi-tag fixture set, per this plan's `<verification>` note — flagged as `human_judgment: true` in coverage D2/D3 above.
- Plan 68-07 (remaining incomplete plan in this phase) and Phase 68 verification are next.

---
*Phase: 68-tags-dashboard-and-navigation*
*Completed: 2026-07-21*

## Self-Check: PASSED

All 7 modified files and the SUMMARY.md confirmed present on disk; all 4 commits (`15f30ed`, `c731b30`, `06e1d45`, `ac3e767`) confirmed in git log.
