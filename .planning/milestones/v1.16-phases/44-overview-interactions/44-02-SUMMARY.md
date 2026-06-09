---
phase: 44-overview-interactions
plan: "02"
subsystem: dashboard/overview
tags: [nudge, localStorage, client-island, tdd, ux, categorization]
dependency_graph:
  requires:
    - components/dashboard/overview/overview-chart-utils.ts
    - lib/dal/overview (OverviewData.uncategorizedCount)
  provides:
    - components/dashboard/overview/overview-nudge.tsx
  affects:
    - app/(app)/dashboard/overview/page.tsx
    - tests/overview-interactions.test.tsx
tech_stack:
  added: []
  patterns:
    - "SSR-safe localStorage: useState(false) default, restore in useEffect after mount — never in useState initializer"
    - "Client island wired into RSC page: uncategorizedCount + year passed as serializable primitives across server/client boundary"
    - "lastSeenCount semantics: nudge reappears when count rises above stored value"
    - "TDD RED/GREEN cycle: test committed first (6564b12), implementation committed second (0915715)"
key_files:
  created:
    - components/dashboard/overview/overview-nudge.tsx
  modified:
    - app/(app)/dashboard/overview/page.tsx
    - tests/overview-interactions.test.tsx
decisions:
  - "Nudge placed inside OverviewDataSection (not at the outer page level) because uncategorizedCount is only available after getOverview() resolves — avoids an extra data fetch"
  - "shouldShowNudge exported as a pure function (no React dependency) enabling direct unit testing without renderToStaticMarkup"
  - "count-free copy (no number interpolation) per D-10 — Italian product surface strings only"
  - "months param built with URLSearchParams using a 12-token loop for full year coverage"
metrics:
  duration: "3m 10s"
  completed: "2026-06-08T16:04:18Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 44 Plan 02: Overview Nudge Summary

Inline amber nudge on the overview title row with year-scoped localStorage dismissal (lastSeenCount semantics) and a "Categorizza ora" CTA linking to uncategorized transactions for the selected year.

## What Was Built

### Task 1: OverviewNudge client island + shouldShowNudge helper

Created `components/dashboard/overview/overview-nudge.tsx` as a `'use client'` island. Exports:

- `shouldShowNudge(count, stored)` — pure function: returns `false` when count <= 0; `true` when no stored value; `true` when count > stored.lastSeenCount; `false` otherwise. Covers NUDGE-01/03/04.
- `OverviewNudge({ uncategorizedCount, year })` — SSR-safe client island:
  - `useState(false)` as default (never reads localStorage in initializer — Pitfall 1 avoided)
  - `useEffect([uncategorizedCount, year])` reads `sparter-overview-nudge-{year}` from localStorage and calls `shouldShowNudge` to set visibility
  - Dismiss writes `{ lastSeenCount: uncategorizedCount }` to the year-scoped key, hides nudge
  - Amber styled container (`role="status"`) with invitational Italian copy, count-free
  - CTA: `Link` to `/transactions?status=uncategorized&months=YYYY-MM,...` (12 months for selected year via URLSearchParams)
  - Accessible dismiss button (`aria-label="Chiudi avviso"`, lucide `X` icon)
  - No server action, no DB write, no authorization boundary crossed

Appended to `tests/overview-interactions.test.tsx`:
- `describe('overview nudge (NUDGE-01..04, NUDGE-03)')` with 7 test cases
- `shouldShowNudge` unit cases covering all 5 branching conditions
- Static render cases: count=0 → empty string (NUDGE-04); count>0 → empty string (SSR-safe default)
- NUDGE-01 "shown when count>0 and not dismissed" covered via `shouldShowNudge(5, null) === true` (not via static markup — Pitfall 4 avoided)

### Task 2: Wire OverviewNudge into the overview page + tests verified

Updated `app/(app)/dashboard/overview/page.tsx`:
- Added `import { OverviewNudge }` from the new island
- Rendered `<OverviewNudge uncategorizedCount={overview.uncategorizedCount} year={year} />` inside `OverviewDataSection`, above `KpiRow` (title context per D-02/D-03/D-10)
- `KpiRow data={overview} year={year}` untouched — no chip/nudge state added

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 6564b12 | test (RED) | add failing nudge tests — shouldShowNudge + OverviewNudge |
| 0915715 | feat (GREEN) | add OverviewNudge client island + shouldShowNudge helper |
| b505b31 | feat | wire OverviewNudge into overview page title row |

## TDD Gate Compliance

- RED gate: `test(44-02)` commit `6564b12` — tests failed (module `overview-nudge` not found)
- GREEN gate: `feat(44-02)` commit `0915715` — all 15 tests pass (8 existing + 7 nudge)
- REFACTOR gate: not needed

## Deviations from Plan

None — plan executed exactly as written.

The tests appended in Task 1's TDD RED phase already covered all nudge describe cases required by Task 2, so Task 2 only needed to wire the page and verify test runs (no additional test writing needed).

## Language Check

`yarn check:language` reports 8 pre-existing violations in `scripts/seed-extras.ts`, `tests/subcategory-picker.test.tsx`, and `tests/suggestion-promote-form.test.tsx`. None of these files were modified by this plan. All files created/modified in this plan pass the language check with zero violations.

Pre-existing violations are logged to deferred-items for a future quick task.

## Threat Surface Scan

No new trust boundaries introduced beyond those in the plan's threat model:
- T-44-01: localStorage stores only `{ lastSeenCount: number }` — no PII, presentation-only
- T-44-01 (disclosure): count sourced from `getOverview(year)` under `verifySession()` — no new fetch path
- T-44-02: CTA href built from `APP_ROUTES.transactions` + `URLSearchParams` with canonical `status=uncategorized` and well-formed YYYY-MM tokens; destination `/transactions` re-validates params

## Known Stubs

None — all data is wired to `overview.uncategorizedCount` from the DAL.

## Self-Check

| Check | Result |
|-------|--------|
| overview-nudge.tsx created | PASS |
| page.tsx updated with OverviewNudge import + render | PASS |
| tests/overview-interactions.test.tsx updated | PASS |
| `yarn test tests/overview-interactions.test.tsx` all 15 pass | PASS |
| `yarn test -t "nudge"` passes (7 tests) | PASS |
| `yarn test -t "lastSeenCount"` passes (2 tests) | PASS |
| commit 6564b12 (RED) exists | PASS |
| commit 0915715 (GREEN) exists | PASS |
| commit b505b31 (Task 2) exists | PASS |

**Self-Check: PASSED**
