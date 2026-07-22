---
phase: 70-dashboard-tag-filter-removal
plan: 01
subsystem: ui
tags: [nextjs, react, server-actions, dashboard, tags, routing]

# Dependency graph
requires:
  - phase: 68-dashboard-tag-filter
    provides: the period-scoped ?tag= dashboard filter that this plan removes
  - phase: 69-tag-dedicated-view
    provides: /tags/[id], the all-time canonical per-tag view that replaces it
provides:
  - "/dashboard/overview, /dashboard/categories and /dashboard/categories/[id] with zero tag wiring"
  - "buildDashboardCategoriesHref / buildDashboardCategoryDetailHref that cannot emit ?tag="
  - "a tag-free overview component chain (dashboard section -> movers section -> fetchMovers)"
affects: [70-02 (dashboard DAL parameter removal), tag-analysis, dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Call sites removed before signatures: wave 1 drops every argument while the DAL keeps its optional params, so tsc is clean at every task boundary"

key-files:
  created: []
  modified:
    - app/(app)/dashboard/overview/page.tsx
    - components/dashboard/overview/overview-empty-state.tsx
    - app/(app)/dashboard/categories/page.tsx
    - app/(app)/dashboard/categories/[id]/page.tsx
    - components/dashboard/category-ranking-list.tsx
    - lib/routes.ts
    - components/dashboard/overview/overview-dashboard-section.tsx
    - components/dashboard/overview/overview-movers-section.tsx
    - lib/actions/overview.ts
  deleted:
    - tests/overview-movers-action.test.ts

key-decisions:
  - "Legacy /dashboard/*?tag=<id> URLs degrade silently — the param is simply not read (D1); no redirect, no error, no tag-specific empty state"
  - "Pure removal, no substitute affordance on the dashboard (D2) — per-tag analysis is reached via /dashboard/tags -> /tags/[id]"
  - "tests/overview-movers-action.test.ts deleted rather than skipped (D4) — all six cases asserted only the removed argument"

patterns-established:
  - "Removal waves ordered consumers-before-definition: dashboard pages stop passing `tag` before the field leaves DashboardCategoryFilters"

requirements-completed: [TAG-13]

coverage:
  - id: D1
    description: "/dashboard/overview renders no tag-filter control and ignores a legacy ?tag= param; the zero-data branch shows the year empty state"
    requirement: "TAG-13"
    verification:
      - kind: other
        ref: "/usr/bin/grep -rnE \"TagFilterSelect|parseTagIdParam|no-data-for-tag|tagId|\\btag\\b\" 'app/(app)/dashboard/overview/page.tsx' components/dashboard/overview/overview-empty-state.tsx (zero hits)"
        status: pass
      - kind: unit
        ref: "./node_modules/.bin/vitest run (full suite, 140 files / 1754 tests)"
        status: pass
    human_judgment: true
    rationale: "Rendered absence of a control and the silent-degradation behaviour of a legacy ?tag= URL are visual/route-level facts; no automated UI test covers the overview page shell."
  - id: D2
    description: "Both category pages stop reading ?tag=; neither dashboard href builder can emit a tag param; the ranking empty state has one unconditional message"
    requirement: "TAG-13"
    verification:
      - kind: other
        ref: "/usr/bin/grep -rnE \"TagFilterSelect|parseTagIdParam|tagId|\\btag\\b\" 'app/(app)/dashboard/categories' components/dashboard/category-ranking-list.tsx lib/routes.ts (zero hits)"
        status: pass
      - kind: unit
        ref: "tests/dashboard-filters.test.ts#dashboard category list routes / dashboard category detail routes"
        status: pass
    human_judgment: false
  - id: D3
    description: "No dashboard component prop or Server Action parameter carries a tag id (overview section -> movers section -> fetchMovers)"
    verification:
      - kind: other
        ref: "/usr/bin/grep -rn \"tagId\" components/dashboard/overview/ lib/actions/overview.ts (zero hits)"
        status: pass
      - kind: unit
        ref: "tests/overview-movers.test.tsx (movers panel rendering, unchanged and green)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Dashboard totals, chart buckets and movers are byte-identical to the pre-existing unfiltered behaviour — no surviving assertion was edited"
    verification:
      - kind: unit
        ref: "./node_modules/.bin/vitest run — tests/overview-dal.test.ts, tests/dashboard-dal.test.ts, tests/category-ranking-list.test.tsx all green with zero assertion edits"
        status: pass
    human_judgment: false
  - id: D5
    description: "REGRESSION FENCE held: lib/dal/transaction-tags-sql.ts, lib/dal/transactions.ts, lib/dal/tags.ts and app/(app)/transactions/** are untouched; /transactions?tag= and the TAG-14 toolbar filter still work"
    verification:
      - kind: other
        ref: "git diff --name-only <phase-base>..HEAD (no path under lib/dal/ or app/(app)/transactions/)"
        status: pass
      - kind: unit
        ref: "tests/transaction-tags-sql.test.ts, tests/transactions-dal.test.ts, tests/data-table-toolbar.test.tsx"
        status: pass
    human_judgment: true
    rationale: "The toolbar tag filter shipped days ago; a human should click /transactions?tag=<id> once to confirm the narrowing still applies end-to-end, since no e2e test exercises it."

# Metrics
duration: 8min
completed: 2026-07-22
status: complete
---

# Phase 70 Plan 01: Dashboard tag-filter removal (call sites) Summary

**The period-scoped `?tag=` dashboard filter is gone from every surface that read or rendered it — three pages, two href builders, one empty-state variant and the whole overview→movers→`fetchMovers` argument chain — while the dashboard DAL keeps its optional params so the tree type-checks at every commit.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-22T17:33:00Z
- **Completed:** 2026-07-22T17:41:00Z
- **Tasks:** 3/3
- **Files modified:** 9 modified, 1 deleted

## Accomplishments

- `/dashboard/overview` no longer imports `TagFilterSelect`, `parseTagIdParam`, `getTags` or `resolveOwnedTagId`; its `searchParams` type is `{ year?: string }` and the zero-data branch renders the fixed `no-data-for-year` empty state. A legacy `?tag=<id>` URL is silently ignored (D1).
- `OverviewEmptyState`'s variant union is narrowed to `no-years | no-data-for-year`; the tag branch and its doc line are gone.
- `/dashboard/categories` and `/dashboard/categories/[id]` (the easy-to-miss drill-down) no longer parse `?tag=`, resolve tag ownership, fetch tags, or thread a tag id into DAL calls or hrefs.
- `DashboardCategoryFilters` lost its `tag?: number` field and neither `buildDashboardCategoriesHref` nor `buildDashboardCategoryDetailHref` can emit `?tag=` any more.
- `CategoryRankingList` lost its `tagId` prop; the empty state is one unconditional period/type message instead of a two-armed ternary.
- The client-side chain is tag-free: `OverviewDashboardSection` → `OverviewMoversSection` → `fetchMovers`, including the `safeTagId` defensive derivation in the Server Action.
- The header wrappers (`flex flex-wrap items-center gap-3` / `gap-2`) that existed only to seat the removed control were collapsed, restoring the pre-filter layout.

## Task Commits

1. **Task 1 (tracer): /dashboard/overview end-to-end** — `bef3f41` (refactor)
2. **Task 2: categories pages + both href builders** — `6cabb41` (refactor)
3. **Task 3: overview → movers → fetchMovers argument chain** — `e41a398` (refactor)

## Files Created/Modified

- `app/(app)/dashboard/overview/page.tsx` — tag imports, `?tag=` read, ownership resolution, tags fetch, both control render sites and the tag-conditional empty-state expression removed; `verifySession()` kept as the auth gate but no longer destructured.
- `components/dashboard/overview/overview-empty-state.tsx` — variant union narrowed to two members.
- `app/(app)/dashboard/categories/page.tsx` — same removal; `SortToggle` and `CategoryRankingContent` lost their `tagId` props; the Suspense wrapper collapsed back to `DashboardFilters`.
- `app/(app)/dashboard/categories/[id]/page.tsx` — `resolveOwnedTagId` import, `?tag=` parse and back-href `tag:` entry removed.
- `components/dashboard/category-ranking-list.tsx` — `tagId` prop removed, empty state collapsed to one message, `tag:` dropped from the detail-href argument.
- `lib/routes.ts` — `tag?: number` deleted from `DashboardCategoryFilters` and the two `params.set('tag', …)` blocks removed. `APP_ROUTES.tags`, `dashboardTags` and `tagDetail` are untouched.
- `components/dashboard/overview/overview-dashboard-section.tsx`, `components/dashboard/overview/overview-movers-section.tsx`, `lib/actions/overview.ts` — `tagId` prop/param and the three positional arguments removed; the T-45-01 / T-49-02-01 year/monthIndex/direction validation blocks kept verbatim.
- `tests/overview-movers-action.test.ts` — **deleted** (see Test Coverage Delta).

## Test Coverage Delta

- **Deleted:** `tests/overview-movers-action.test.ts` (6 cases). Every case asserted either the fifth positional argument to `getMonthOverMonthCategoryChanges` or the defensive bound on the `tagId` parameter — both removed by this plan. Deletion over skipping per D4.
- **Net effect:** the suite goes from 141 files / 1760 tests to 140 files / 1754 tests, all green.
- **Residual gap:** `fetchMovers` now has **no dedicated unit test**. Its surviving logic (session check, year/monthIndex bounds, closed-enum direction validation) is unchanged by this plan, so this is a coverage gap rather than a regression — but it is a real gap, and `lib/actions/overview.ts` is currently only exercised indirectly through `tests/overview-movers.test.tsx`. Restoring a small argument-free test for the validation branches is a reasonable follow-up for plan 70-02 or a later hardening pass.
- No surviving dashboard assertion was edited (D3): every removed argument was `undefined` on the default path, so no number moved.

## Decisions Made

None beyond the plan — D1/D2/D3/D4 from CONTEXT.md were followed as specified.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- **Pre-existing `tsc --noEmit` errors (out of scope, not introduced here).** The baseline tree already fails type-check in six unrelated test files: `tests/suggestion-card.test.tsx` (7), `tests/suggestion-promote-form.test.tsx` (6), `tests/cascade-options.test.ts` (4), `tests/category-combobox.test.tsx` (2), `tests/transactions-dal.test.ts` (1), `tests/file-download-api.test.ts` (1). The error set is **byte-identical before and after all three commits** — none touches a file this plan modified, and the count never changed across task boundaries. Logged to `deferred-items.md`; per the executor scope boundary they were not fixed here.
- The plan's `tsc --noEmit` gate is therefore satisfied in the "no new errors" sense, not the "zero errors" sense. This is worth knowing before plan 70-02 runs the same gate.

## Regression Fence

Verified after the final commit — nothing under `lib/dal/` or `app/(app)/transactions/` appears in `git diff --name-only` for this plan:

- `lib/dal/transaction-tags-sql.ts:24` — `tagScopedTransactions` definition intact.
- `lib/dal/transactions.ts:8,340` — import + `conditions.push(tagScopedTransactions(filters.tagId))` intact (powers `/transactions?tag=` and the TAG-14 toolbar filter).
- `lib/dal/tags.ts:124` — `resolveOwnedTagId` and its docstring untouched (plan 70-02 updates the comment).
- `lib/dal/overview.ts` (5 refs) and `lib/dal/dashboard.ts` (9 refs) still call `tagScopedTransactions` behind now-unreachable optional params — exactly the state plan 70-02 expects to find.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 70-02 can proceed: no caller anywhere passes a tag argument into `getOverview`, `getOverviewChart`, `getMonthOverMonthCategoryChanges`, `getCategoryRanking`, `getCategoryDetail` or `getCategoryDeviations`, so removing the parameters is now a pure signature narrowing.
- Still alive and owned by 70-02: `components/dashboard/tag-filter-select.tsx` + `tests/tag-filter-select.test.tsx`, `parseTagIdParam` in `lib/validations/dashboard.ts` + its `describe('parseTagIdParam (68-01)')` block in `tests/dashboard-filters.test.ts`, and the `tagId` params in `lib/dal/overview.ts` / `lib/dal/dashboard.ts`.
- Manual check worth doing before ship: open `/transactions?tag=<id>` and the toolbar tag filter once (D5 human judgment).

## Self-Check: PASSED

- All three task commits exist in git (`bef3f41`, `6cabb41`, `e41a398`).
- `tests/overview-movers-action.test.ts` confirmed gone from disk.
- `git diff --name-only bef3f41~1 HEAD` lists exactly the 9 planned files plus the deleted test —
  nothing under `lib/dal/` or `app/(app)/transactions/` (regression fence held).
- `deferred-items.md` written alongside this summary.

---
*Phase: 70-dashboard-tag-filter-removal*
*Completed: 2026-07-22*
