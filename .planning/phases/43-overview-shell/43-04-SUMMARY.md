---
phase: 43-overview-shell
plan: "04"
subsystem: dashboard/overview
tags: [cleanup, dead-code, deletion]
dependency_graph:
  requires: ["43-03"]
  provides: ["clean-codebase-post-redesign"]
  affects: ["components/dashboard/", "app/proto/overview/", "tests/"]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - app/(app)/dashboard/overview/page.tsx
  deleted:
    - components/dashboard/kpi-cards.tsx
    - components/dashboard/kpi-card.tsx
    - components/dashboard/entrate-uscite-chart.tsx
    - components/dashboard/bilancio-bars-chart.tsx
    - components/dashboard/overview-filters.tsx
    - components/dashboard/overview-skeleton.tsx
    - components/dashboard/trend-skeleton.tsx
    - app/proto/overview/ (15 files)
    - tests/dashboard-charts.test.tsx
    - tests/kpi-card.test.tsx
decisions:
  - "Deleted tests/dashboard-charts.test.tsx and tests/kpi-card.test.tsx alongside their components — no replacement needed since the new OverviewChart/KpiRow components are covered by the new shell design"
  - "Cherry-picked Plan 43-03 prerequisite commits before executing Plan 04 deletions — worktree base predated wave-3 merge"
metrics:
  duration: "~8 minutes"
  completed: "2026-06-08"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 37
---

# Phase 43 Plan 04: Overview Cleanup Summary

Delete superseded overview components and the throwaway proto route after Plan 03 rewrote overview/page.tsx to use the new shell.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Delete superseded components, proto route, old tests | b89380d | 22 deleted, 9 added (Plan 03 cherry-pick), 6 modified |

## What Was Built

Deletion-only plan (D-02). Removed all code superseded by the Phase 43 redesign:

- **7 dashboard components deleted:** `kpi-cards.tsx`, `kpi-card.tsx`, `entrate-uscite-chart.tsx`, `bilancio-bars-chart.tsx`, `overview-filters.tsx`, `overview-skeleton.tsx`, `trend-skeleton.tsx`.
- **`app/proto/overview/` deleted:** 15 files — the PO-approved prototype was promoted to production in Plans 43-01/02/03 and the throwaway route is no longer needed.
- **2 test files deleted:** `tests/dashboard-charts.test.tsx` and `tests/kpi-card.test.tsx` — these tested the now-deleted components.

The `app/(app)/dashboard/overview/page.tsx` was cherry-picked from Plan 43-03 (prerequisite — worktree base predated wave-3 merge) and now uses only new shell components.

## Verification

- `yarn build` (via `node_modules/.bin/next build` from worktree root): **BUILD_OK** — 22 routes, `/proto/overview` absent from output.
- `yarn check:language` (via `scripts/check-code-language.mjs`): pre-existing violations only in `scripts/seed-extras.ts` and `tests/suggestion-promote-form.test.tsx`. No new violations from this plan.
- Repo-wide grep: zero remaining references to any deleted module path (`kpi-cards|entrate-uscite-chart|bilancio-bars-chart|overview-filters|dashboard/overview-skeleton|dashboard/trend-skeleton|dashboard/kpi-card'`).
- Categories tab components (`category-breakdown-chart`, `category-detail-trend-chart`, etc.) and `dashboard-tab-nav.tsx` are untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cherry-pick Plan 43-03 prerequisite commits**
- **Found during:** Task 1 (guard phase — checking overview/page.tsx state)
- **Issue:** This worktree branch was created from commit `66ef84d` (pre-wave-3 merge). The `overview/page.tsx` still imported the old components, and the new shell components (`components/dashboard/overview/`) were absent. Deleting the old components would have broken the build.
- **Fix:** Cherry-picked commits `3e5b6a6` and `7369c7c` from Plan 43-03 (resolveYear, OverviewEmptyState, new page.tsx, Phase-42 DAL files). Both applied cleanly with no conflicts.
- **Files modified:** `app/(app)/dashboard/overview/page.tsx`, `components/dashboard/overview/*` (9 new files), `lib/dal/dashboard.ts`, `lib/dal/overview.ts`, `lib/db/schema.ts`, `lib/utils/nature-labels.ts`, `scripts/seed-extras.ts`
- **Commit:** b89380d (included in the single task commit)

**2. [Rule 1 - Bug] Deleted tests for deleted components**
- **Found during:** GUARD phase (grep for remaining importers)
- **Issue:** `tests/dashboard-charts.test.tsx` imported `entrate-uscite-chart` and `bilancio-bars-chart`; `tests/kpi-card.test.tsx` imported `kpi-card`. These would fail to compile after deletion.
- **Fix:** Deleted both test files alongside their components.
- **Files deleted:** `tests/dashboard-charts.test.tsx`, `tests/kpi-card.test.tsx`
- **Commit:** b89380d

## Known Stubs

None — this is a deletion-only plan; no new UI introduced.

## Threat Flags

None — deletion-only plan introduces no new input surface.

## Self-Check: PASSED

- Components deleted: confirmed via git diff
- Proto route deleted: `/proto/overview` absent from build output
- Commit b89380d exists: confirmed
- Zero external importers: grep returned no results
- Build green: BUILD_OK (22 routes)
