---
phase: 69-tag-dedicated-page
plan: 01
subsystem: ui
tags: [next.js, rsc, tags, idor, drizzle, decimal]

# Dependency graph
requires:
  - phase: 68-tag-dashboard-section
    provides: getTagDetail / buildTagDetailData DAL, getTag ownership helper, resolveOwnedTagId
provides:
  - "/tags/[id] authenticated RSC rendering the D4 report body (header + 3 KPI cards + count + tx list) from real getTagDetail"
  - "APP_ROUTES tagDetail(id) route helper (single source for links into the page)"
  - "TagDetailReport presentational server component (D4 presentation rules, breakdown-free)"
affects: [69-02, 69-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Next.js 16 async-params RSC with positive-int guard + getTag ownership gate -> notFound() (IDOR boundary)"
    - "Presentational server component: pure prop formatting, no 'use client', renderToStaticMarkup-testable"

key-files:
  created:
    - app/(app)/tags/[id]/page.tsx
    - components/tags/tag-detail-report.tsx
    - tests/tag-detail-report.test.tsx
  modified:
    - lib/routes.ts

key-decisions:
  - "tagDetail(id) added as a standalone exported helper matching existing dashboardCategoryDetail/transactionDetailHref convention (not a method on APP_ROUTES)"
  - "Static metadata { title: 'Tag' } kept; per-tag generateMetadata deferred (Claude discretion, not required)"
  - "KPI cards use shadcn Card (label in CardHeader/CardTitle, value in CardContent) rather than the panel's plain bordered div, per D4 'shadcn Card KPIs'"

patterns-established:
  - "TagDetailReport is the reusable D4 render surface; Plan 69-02 extends it with the per-category breakdown"

requirements-completed: [TAG-06, TAG-07, TAG-08, TAG-10, TAG-11]

coverage:
  - id: D1-route-helper
    description: "APP_ROUTES tagDetail(id) helper returning /tags/{id}"
    requirement: "TAG-06"
    verification:
      - kind: unit
        ref: "./node_modules/.bin/tsc --noEmit (touched files clean)"
        status: pass
    human_judgment: false
  - id: D1-ownership-gate
    description: "Malformed (non positive-int) or foreign tag id resolves to notFound() before any detail query — IDOR boundary (T-69-01/T-69-02)"
    verification:
      - kind: unit
        ref: "tsc + eslint clean on app/(app)/tags/[id]/page.tsx; positive-int guard + getTag null->notFound mirrors parseCategoryId"
        status: pass
    human_judgment: true
    rationale: "Runtime notFound() behaviour for a foreign/malformed id is reachability-dependent; verified by the human-verify checkpoint in Plan 69-03 once entry points are wired."
  - id: D4-report-body
    description: "3 KPI cards (Entrate/Uscite/Valore finale sign-colored) + '{n} transazioni incluse' count + date-descending tx list from real getTagDetail"
    requirement: "TAG-08"
    verification:
      - kind: unit
        ref: "tests/tag-detail-report.test.tsx#renders the three KPI labels / count line matching fixture length / each subcategory name / empty-state copy"
        status: pass
    human_judgment: false
  - id: D4-net-reconciliation
    description: "Valore finale KPI shows getTagDetail.net (signed, it-IT formatted) — the figure that reconciles with /dashboard/tags"
    requirement: "TAG-07"
    verification:
      - kind: unit
        ref: "tests/tag-detail-report.test.tsx#renders the it-IT-formatted signed net"
        status: pass
    human_judgment: true
    rationale: "Cross-query reconciliation (net vs getTagTotals total for the same tag) is a live-data assertion verified by the Plan 69-03 checkpoint, not by the static render."
  - id: D5-edit-archive
    description: "EditTagDialog + ArchiveTagDialog (Archive only when not archived) reused in the page header; Archiviato badge when archived"
    requirement: "TAG-11"
    verification:
      - kind: unit
        ref: "tsc clean — dialog prop types (TagRow) type-check end-to-end in the page header"
        status: pass
    human_judgment: true
    rationale: "Dialog open/submit interaction is client behaviour requiring a running app; verified at the Plan 69-03 human-verify checkpoint."

# Metrics
duration: 9min
completed: 2026-07-22
status: complete
---

# Phase 69 Plan 01: Tag Dedicated Page Tracer Summary

**End-to-end `/tags/[id]` authenticated RSC — route helper → positive-int guard → getTag ownership gate (notFound) → getTagDetail → presentational TagDetailReport (3 KPI cards + count + date-descending tx list) with reused Edit/Archive dialogs in the header.**

## Performance

- **Duration:** ~9 min
- **Tasks:** 1 (tracer)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- New authenticated RSC `app/(app)/tags/[id]/page.tsx` proving the full phase architecture on one committed slice: `verifySession()` → positive-int `id` guard → `getTag(userId, id)` ownership gate → `notFound()` (IDOR boundary T-69-01/02) → `getTagDetail` → render.
- `TagDetailReport` presentational server component: 3 shadcn Card KPIs (Entrate / Uscite / Valore finale, net sign-colored, tabular-nums), `{n} transazioni incluse` count line, and the scrollable date-descending transaction list — the D4 report body minus the per-category breakdown (deferred to 69-02).
- `tagDetail(id)` route helper in `lib/routes.ts` — the single link source for the entry-point wiring in 69-03.
- In-header Edit/Archive affordance via the reused `EditTagDialog` / `ArchiveTagDialog` (`ArchiveTagDialog` only when not archived), plus an "Archiviato" badge (D5).
- Static-render smoke test (`renderToStaticMarkup`, no jsdom) covering KPI labels, count == fixture length (TAG-08), each subcategory name, it-IT net (TAG-07), and the empty state.

## Task Commits

1. **Task 1: End-to-end /tags/[id] page rendering real getTagDetail** - `654389b` (feat)

## Files Created/Modified
- `app/(app)/tags/[id]/page.tsx` - Authenticated RSC: async-params parse, positive-int guard, ownership gate, header (name + date-range + Archiviato badge + Edit/Archive), renders TagDetailReport.
- `components/tags/tag-detail-report.tsx` - Presentational server component with lifted it-IT currency/date formatters, sign tone helper, count label; KPI grid + count + tx list.
- `tests/tag-detail-report.test.tsx` - Static-render smoke test (populated + empty fixtures).
- `lib/routes.ts` - Added `tagDetail(id)` helper next to `dashboardCategoryDetail`/`transactionDetailHref`.

## Decisions Made
- `tagDetail(id)` is a standalone exported function, matching the existing helper convention in `lib/routes.ts` (the plan's must_haves phrasing "APP_ROUTES.tagDetail" is satisfied by the module-level export, consistent with `dashboardCategoryDetail`).
- KPI cards use shadcn `Card` (label in `CardHeader`/`CardTitle`, value in `CardContent`) rather than the former panel's plain bordered `div`, honoring D4's explicit "shadcn Card KPIs".
- Kept static `metadata = { title: 'Tag' }`; per-tag `generateMetadata` was left out (plan flagged it as discretionary).
- `getTagDetail`/`buildTagDetailData` reused verbatim — no parallel query added (D3).

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None. The prototype `app/proto/tag-view/variant-a.tsx` referenced by the plan lives on branch `proto/tag-view` and is not present on the current branch; it was a layout reference only, and the D4 presentation rules were lifted from the existing `TagDetailView` in `tag-settings-panel.tsx` as instructed.

## Verification Results
- `./node_modules/.bin/tsc --noEmit` — clean on all touched files (pre-existing unrelated test-file errors ignored per plan).
- `./node_modules/.bin/vitest run tests/tag-detail-report.test.tsx` — 6/6 passing.
- `./node_modules/.bin/eslint` on the four touched files — clean.
- `yarn check:language` — passed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `TagDetailReport` is ready for Plan 69-02 to extend with the per-category breakdown (CSS bars).
- `tagDetail(id)` helper is ready for Plan 69-03 entry-point re-wiring (`/tags` index items + `/dashboard/tags` ranking primary link).
- Reachability and cross-query net reconciliation (net vs `getTagTotals`) remain to be confirmed at the Plan 69-03 human-verify checkpoint once entry points are wired.

## Self-Check: PASSED
- FOUND: app/(app)/tags/[id]/page.tsx
- FOUND: components/tags/tag-detail-report.tsx
- FOUND: tests/tag-detail-report.test.tsx
- FOUND: lib/routes.ts (modified)
- FOUND: commit 654389b

---
*Phase: 69-tag-dedicated-page*
*Completed: 2026-07-22*
