---
phase: 82-number-engine-and-regression-gate
plan: 02
subsystem: dashboard
tags: [nextjs-app-router, drizzle, vitest, dashboard-lens]

requires:
  - phase: 80-dashboard-accrual-lens
    provides: LensSwitch component, resolveLedgerRowSource/LedgerRowSource seam, parseLensParam/Lens type
provides:
  - Categories list and detail pages pinned to cash by construction (no ledgerRowSource argument reaches the aggregation calls at all, so `?lens=` in the URL has zero effect on Categories)
  - LensSwitch confined to a single render site (components/dashboard/overview/overview-header.tsx)
  - buildDashboardTabHref stripped of the dead `tag` searchParam while `lens` propagation is unchanged
  - Source-inspection regression test (tests/lens-switch-placement.test.tsx) proving the render-site inventory
affects: [83-categories-list, 84-category-detail-and-cleanup]

tech-stack:
  added: []
  patterns:
    - "Pin-by-construction: a page stops reading a URL param entirely (no parse, no fallback) rather than parsing it and discarding the result — makes 'the URL cannot affect this' a structural fact, not a convention"
    - "Source-inspection test (readFileSync + .includes()/.not.toContain()) for RSC render-site assertions in a Node-only test env with no jsdom, matching the pattern noted in tests/dashboard-filters.test.ts"

key-files:
  created:
    - tests/lens-switch-placement.test.tsx
  modified:
    - app/(app)/dashboard/categories/page.tsx
    - app/(app)/dashboard/categories/[id]/page.tsx
    - components/dashboard/category-ranking-list.tsx
    - components/dashboard/dashboard-tab-nav.tsx
    - tests/dashboard-filters.test.ts

key-decisions:
  - "verifySession() call retained in both Categories pages for its auth-gate side effect, but its userId destructure was dropped once hasAmortizationPlans(userId) (the LensSwitch visibility gate) was removed — the only remaining reader of userId in either page"
  - "lib/routes.ts's DashboardCategoryFilters.lens field and buildDashboardCategoriesHref/buildDashboardCategoryDetailHref's lens handling are left untouched — CONTEXT.md D-12's verified site inventory scopes this cleanup to the two pages + category-ranking-list.tsx only; lib/routes.ts is out of this task's scope"

patterns-established:
  - "A page confining a global control to one route removes the control's props end-to-end (parse -> resolve -> prop -> callee), not just the JSX render — otherwise the aggregation binding still reads the URL invisibly"

requirements-completed: [RETIRE-03, RETIRE-04]

coverage:
  - id: D1
    description: "Categories list page (app/(app)/dashboard/categories/page.tsx) renders no LensSwitch and calls getCategoryRanking/getCategoryDeviations with no ledgerRowSource argument, so they always resolve to their ledgerEntryCash default regardless of ?lens="
    requirement: "RETIRE-03"
    verification:
      - kind: unit
        ref: "tests/lens-switch-placement.test.tsx#LensSwitch render-site placement (D-12, RETIRE-03) > Categories list page renders no LensSwitch and resolves no ledgerRowSource from the URL"
        status: pass
    human_judgment: false
  - id: D2
    description: "Categories detail page (app/(app)/dashboard/categories/[id]/page.tsx) renders no LensSwitch and calls getCategoryDetail/getCategoryDeviations with no ledgerRowSource argument"
    requirement: "RETIRE-03"
    verification:
      - kind: unit
        ref: "tests/lens-switch-placement.test.tsx#LensSwitch render-site placement (D-12, RETIRE-03) > Categories detail page renders no LensSwitch and resolves no ledgerRowSource from the URL"
        status: pass
    human_judgment: false
  - id: D3
    description: "components/dashboard/overview/overview-header.tsx remains the sole LensSwitch render site; app/(app)/dashboard/tags/page.tsx verified (not edited) as already lens-invariant"
    requirement: "RETIRE-03"
    verification:
      - kind: unit
        ref: "tests/lens-switch-placement.test.tsx#LensSwitch render-site placement (D-12, RETIRE-03) > Overview header remains the sole LensSwitch render site"
        status: pass
      - kind: unit
        ref: "tests/lens-switch-placement.test.tsx#LensSwitch render-site placement (D-12, RETIRE-03) > Tags page renders no LensSwitch (already compliant, LSD-05 — verify only, no edit)"
        status: pass
    human_judgment: false
  - id: D4
    description: "buildDashboardTabHref drops the dead tag searchParam across all three tabs, while lens continues to propagate unchanged, including when both are present simultaneously"
    requirement: "RETIRE-04"
    verification:
      - kind: unit
        ref: "tests/dashboard-filters.test.ts#buildDashboardTabHref > drops the dead ?tag= parameter across Overview <-> Categorie <-> Tag tab switches (RETIRE-04, D-14)"
        status: pass
      - kind: unit
        ref: "tests/dashboard-filters.test.ts#buildDashboardTabHref > drops ?tag= while preserving ?lens= when both are present (RETIRE-04, D-13, D-14)"
        status: pass
      - kind: unit
        ref: "tests/dashboard-filters.test.ts#buildDashboardTabHref > forwards ?lens= across Overview <-> Categorie <-> Tag tab switches (Phase 80)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-30
status: complete
---

# Phase 82 Plan 02: Lens Confinement and Tab Nav Cleanup Summary

**Categories pinned to cash by construction (no `ledgerRowSource` argument reaches `getCategoryRanking`/`getCategoryDeviations`/`getCategoryDetail` from either page), `LensSwitch` confined to Overview's sole render site, and `buildDashboardTabHref` stripped of the dead `?tag=` parameter while `?lens=` keeps propagating invisibly.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2 completed
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- `app/(app)/dashboard/categories/page.tsx` and `app/(app)/dashboard/categories/[id]/page.tsx` no longer import `LensSwitch`, `parseLensParam`, `resolveLedgerRowSource`, or `hasAmortizationPlans` — the pages stop parsing `?lens=` entirely rather than parsing it and pinning the result, so a `?lens=competenza` URL has zero effect on what Categories computes (D-12).
- `getCategoryRanking(filters)`, `getCategoryDeviations({ type })`, `getCategoryDetail(categoryId, filters)` are now called with no second argument from either Categories page, relying on `lib/dal/dashboard.ts`'s own `ledgerEntryCash` default.
- `components/dashboard/category-ranking-list.tsx` drops its now-orphaned `lens?: Lens` prop, destructure, and `Lens` type import — its sole caller stopped passing one.
- `components/dashboard/overview/overview-header.tsx` verified as the sole remaining `<LensSwitch` render site; `app/(app)/dashboard/tags/page.tsx` verified unchanged (already lens-invariant per its existing LSD-05 comment).
- `buildDashboardTabHref` no longer reads or sets `tag` (dead since v2.7, TAG-13); its `lens` propagation line is untouched (D-13).
- New `tests/lens-switch-placement.test.tsx` source-asserts the render-site inventory via `readFileSync` + string-containment checks (this repo's Node-only test env has no jsdom for a full RSC render).
- `tests/dashboard-filters.test.ts`'s `tag=5` test inverted into a drop-assertion, plus a new combined `tag`+`lens` case proving `tag` is dropped while `lens` survives when both are present.

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin Categories to cash and remove the lens switch (D-12, RETIRE-03)** - `3dca821f` (feat)
2. **Task 2: Drop the dead `tag` param from dashboard tab navigation (D-13, D-14, RETIRE-04)** - `3527653a` (feat)

**Plan metadata:** (this SUMMARY's commit, recorded below)

_Note: both tasks were `tdd="true"`; each task's own edits and its accompanying test assertion were verified together before the single atomic commit (the plan's own `<verify>` command is the red/green proof), matching the pattern used in 82-01's SUMMARY._

## Files Created/Modified
- `app/(app)/dashboard/categories/page.tsx` - LensSwitch/parseLensParam/resolveLedgerRowSource/hasAmortizationPlans removed; `getCategoryRanking`/`getCategoryDeviations` called with no ledgerRowSource argument (Task 1)
- `app/(app)/dashboard/categories/[id]/page.tsx` - same shape (Task 1)
- `components/dashboard/category-ranking-list.tsx` - `lens?: Lens` prop and its `Lens` type import removed (Task 1)
- `tests/lens-switch-placement.test.tsx` - new source-inspection regression test proving the render-site inventory (Task 1)
- `components/dashboard/dashboard-tab-nav.tsx` - `tag` read/set lines removed from `buildDashboardTabHref`; `lens` untouched (Task 2)
- `tests/dashboard-filters.test.ts` - `tag=5` test inverted to a drop-assertion, renamed, plus a new combined tag+lens case (Task 2)

## Decisions Made
- `verifySession()` is still called in both Categories pages (its auth-gate side effect is required), but the `{ userId }` destructure was dropped once `hasAmortizationPlans(userId)` — the only other reader of `userId` in either page — was removed alongside the LensSwitch visibility gate. This is a direct consequence of removing the gate, not a separate architectural change.
- `lib/routes.ts`'s `DashboardCategoryFilters.lens` field, and the `lens` handling inside `buildDashboardCategoriesHref`/`buildDashboardCategoryDetailHref`, are left untouched exactly as the plan's `<action>` block specifies — CONTEXT.md's D-12 verified site inventory scopes this cleanup to the two Categories pages and `category-ranking-list.tsx` only.

## Deviations from Plan

None - plan executed exactly as written. The `verifySession()`/`userId` adjustment above is a direct, mechanical consequence of the plan's own instruction to remove `hasAmortizationPlans` and the `hasPlans` gate (not an independent deviation): once `userId` had no other reader in either page, keeping the destructure would have left an unused-variable build/lint failure.

## Issues Encountered

None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RETIRE-03 and RETIRE-04 are complete: Categories is lens-invariant by construction (no code path can read `?lens=` into an aggregation call), and the dead `tag` param is gone from tab navigation while `lens` still propagates.
- `app/(app)/dashboard/tags/page.tsx` is confirmed unchanged (`git diff` shows no entry for it).
- 82-01's tests (`tests/pace-and-projection.test.ts`, `tests/pace-engine-lens-regression.test.ts`) remain green, unaffected by this plan's presentation/routing-only changes.
- No blockers for Plan 82-03 (remaining engine surface) or Phase 83 (categories-list), which can now build the new list UI against Categories pages that are guaranteed cash-only.

---
*Phase: 82-number-engine-and-regression-gate*
*Completed: 2026-07-30*

## Self-Check: PASSED

All modified/created files (`app/(app)/dashboard/categories/page.tsx`,
`app/(app)/dashboard/categories/[id]/page.tsx`, `components/dashboard/category-ranking-list.tsx`,
`components/dashboard/dashboard-tab-nav.tsx`, `tests/dashboard-filters.test.ts`,
`tests/lens-switch-placement.test.tsx`, this SUMMARY) verified present on disk. Both task commits
(`3dca821f`, `3527653a`) verified present in `git log --oneline --all`.
