---
phase: 68-tags-dashboard-and-navigation
plan: 05
subsystem: dashboard-ui
tags: [react, next.js, select, dashboard, tags, url-state]

# Dependency graph
requires:
  - phase: 68-01
    provides: APP_ROUTES.dashboardTags route constant, TagRow type (lib/dal/tags.ts)
provides:
  - TagFilterSelect component (components/dashboard/tag-filter-select.tsx) — { tags, value } props, reads/writes ?tag= via router.replace
  - buildTagFilterSearch(searchParams, nextValue) — pure, exported URL-writing helper
  - 3rd "Tag" tab in DashboardTabNav, routing to APP_ROUTES.dashboardTags
  - buildDashboardTabHref now forwards ?tag= alongside preset/type/sort
affects: [68-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "URL-searchParam client filter control (DashboardFilters' updateFilters idiom, reused verbatim for TagFilterSelect)"
    - "Pure exported URL-logic helper for components with no jsdom test harness (mirrors MergeExpensesDialog's exported step-logic precedent)"

key-files:
  created:
    - components/dashboard/tag-filter-select.tsx
    - tests/tag-filter-select.test.tsx
  modified:
    - components/dashboard/dashboard-tab-nav.tsx
    - app/(app)/dashboard/layout.tsx
    - tests/dashboard-filters.test.ts

key-decisions:
  - "buildTagFilterSearch extracted as a standalone exported pure function (not inlined in the component) so the ?tag= write/clear logic is unit-testable without jsdom — this repo's Radix Select portals into document.body and produces no output under renderToStaticMarkup, so behavior coverage lives on this function instead of a simulated Select interaction"
  - "Sentinel value for 'Tutti i tag' is the literal string 'all', not empty string — Radix Select reserves value=\"\" for 'no selection'; no real tagId can ever be the string 'all' since tagId is a positive integer per parseTagIdParam/resolveOwnedTagId (68-01)"

requirements-completed: [TAG-04]

coverage:
  - id: D1
    description: "TagFilterSelect renders only the 'Tutti i tag' sentinel when tags=[] — never hidden"
    requirement: "TAG-04"
    verification:
      - kind: unit
        ref: "tests/tag-filter-select.test.tsx#TagFilterSelect > renders only the Tutti i tag sentinel when tags is empty"
        status: pass
    human_judgment: false
  - id: D2
    description: "Selecting a tag sets ?tag={id}; selecting the sentinel removes ?tag= entirely (not empty-string)"
    requirement: "TAG-04"
    verification:
      - kind: unit
        ref: "tests/tag-filter-select.test.tsx#buildTagFilterSearch (3 cases: set, clear, preserve-other-params)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Archived tag SelectItem shows the Archiviato badge inline and remains selectable (never a separate/hidden group, never disabled)"
    requirement: "TAG-04"
    verification:
      - kind: unit
        ref: "tests/tag-filter-select.test.tsx#TagFilterSelect > lists an archived tag inline with the Archiviato badge"
        status: pass
    human_judgment: false
  - id: D4
    description: "SelectTrigger has aria-label=\"Filtro tag\" and className containing w-[170px]"
    requirement: "TAG-04"
    verification:
      - kind: unit
        ref: "tests/tag-filter-select.test.tsx#TagFilterSelect > has aria-label and w-[170px] trigger width"
        status: pass
    human_judgment: false
  - id: D5
    description: "buildDashboardTabHref forwards ?tag=5 across all three tab links (Overview/Categorie/Tag), and omits it (not empty-string) when absent"
    requirement: "TAG-04"
    verification:
      - kind: unit
        ref: "tests/dashboard-filters.test.ts#buildDashboardTabHref > forwards ?tag= across ... tab switches (68-05); omits ?tag= ... when absent"
        status: pass
    human_judgment: false
  - id: D6
    description: "DashboardTabNavFallback Suspense placeholder renders all three tab labels (Overview, Categorie, Tag)"
    requirement: "TAG-04"
    verification:
      - kind: manual
        ref: "app/(app)/dashboard/layout.tsx — visual/structural review; no existing test suite covers this Suspense fallback component"
        status: pass
    human_judgment: true

duration: 12min
completed: 2026-07-21
status: complete
---

# Phase 68 Plan 05: TagFilterSelect + 3-Tab Dashboard Nav Summary

**New `TagFilterSelect` client control (single-select `?tag=` URL filter, "Tutti i tag" sentinel, inline archived badge) and a third "Tag" tab in `DashboardTabNav` that carries `?tag=` across all tab switches.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-21
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `TagFilterSelect` (`components/dashboard/tag-filter-select.tsx`) — a `'use client'` Select control mirroring `DashboardFilters`'s preset-select shape (`w-[170px]`, `aria-label="Filtro tag"`), reading/writing `?tag=` via `useSearchParams`/`router.replace`/`useTransition`. Renders even with zero tags. Archived tags render inline with the existing `Badge variant="secondary" text-[10px]` "Archiviato" idiom — never hidden, never disabled.
- `buildTagFilterSearch(searchParams, nextValue)` — the pure URL-writing logic extracted and exported so the set/clear behavior is directly unit-tested without a DOM-interaction harness (this repo has no jsdom; Radix `Select` portals into `document.body` and produces nothing under `renderToStaticMarkup`).
- Third "Tag" tab added to `DashboardTabNav`'s `tabs` array, routing to `APP_ROUTES.dashboardTags` (already added in Plan 68-01).
- `buildDashboardTabHref` extended to read and forward `?tag=` the same conditional-set way `preset`/`type`/`sort` already are — verified round-tripping across Overview ↔ Categorie ↔ Tag.
- `DashboardTabNavFallback` (dashboard layout's Suspense fallback) gained a third "Tag" placeholder div matching the existing two.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the TagFilterSelect client control** - `2be7672` (feat)
2. **Task 2: Add the third "Tag" tab + carry `?tag=` across tab switches** - `412ec52` (feat)

## Files Created/Modified

- `components/dashboard/tag-filter-select.tsx` - NEW: `TagFilterSelect` component + exported `buildTagFilterSearch` pure helper
- `tests/tag-filter-select.test.tsx` - NEW: unit coverage for `buildTagFilterSearch` and structural/render assertions for `TagFilterSelect` (empty/populated/archived/active states, aria-label, trigger width)
- `components/dashboard/dashboard-tab-nav.tsx` - Added 3rd "Tag" tab entry + `tag` forwarding in `buildDashboardTabHref`
- `app/(app)/dashboard/layout.tsx` - `DashboardTabNavFallback` gained a third "Tag" placeholder div
- `tests/dashboard-filters.test.ts` - Added explicit coverage for `?tag=` forwarding across all three tabs and omission when absent

## Decisions Made

- `buildTagFilterSearch` extracted as a standalone exported pure function rather than an inline closure (unlike `DashboardFilters`'s unexported `updateFilters`) — this repo's Node-only test environment cannot simulate a Radix `Select` interaction, so the URL-writing logic itself is the unit of test coverage, following the precedent set by `MergeExpensesDialog`'s exported pure step-logic helpers (Phase 65-06).
- Sentinel value for "Tutti i tag" is the literal string `'all'`, not an empty string — Radix reserves `value=""` for "no selection is possible" and would throw/warn; `'all'` can never collide with a real `tagId` since those are always positive integers.

## Deviations from Plan

None - plan executed exactly as written. The plan's `<read_first>` pointed to the archived-badge idiom in `bulk-assign-tags-dialog.tsx` (verified at lines 176-181) and `DashboardFilters`'s `updateFilters` pattern (verified at lines 47-68), both reused as specified. The only addition beyond the plan's literal file list was the two test files (`tests/tag-filter-select.test.tsx` new, `tests/dashboard-filters.test.ts` extended) — implied by the plan's own `<verify>` blocks, which reference both paths.

## Issues Encountered

None. Full existing test suite (135 files, 1694 tests + 1 pre-existing todo) remains green after this plan's changes. `yarn check:language` clean. `tsc --noEmit` shows zero new errors (pre-existing unrelated failures in `tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, `tests/transactions-dal.test.ts` predate this plan and are out of scope).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`TagFilterSelect` and the 3-tab `DashboardTabNav` are ready for Plan 68-06 to wire into the Overview/Categorie RSC pages (reading `?tag=` via `parseTagIdParam`/`resolveOwnedTagId` from Plan 68-01) and to build the `/dashboard/tags` page itself. No blocking issues.

---
*Phase: 68-tags-dashboard-and-navigation*
*Completed: 2026-07-21*

## Self-Check: PASSED

All created/modified files found on disk; both task commits (`2be7672`, `412ec52`) verified present in git log.
