---
phase: 68-tags-dashboard-and-navigation
plan: 07
subsystem: ui
tags: [next-link, react, dashboard, overview, navigation]

# Dependency graph
requires:
  - phase: 68-tags-dashboard-and-navigation (Plan 03)
    provides: "MonthOverMonthChange.categorySlug (non-null for in/out-grain rows, null for allocation-grain rows)"
provides:
  - "OverviewMoversPanel's three category-keyed MoverList columns (Variazioni di entrate, Dove hai risparmiato, Dove hai speso di più) now click through to /transactions pre-filtered by month + category slug (NAV-01, fully satisfied)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MoverList row rendered as Link (categorySlug present) or plain div (categorySlug null) directly as the <ul>'s mapped child — no intermediate <li> wrapper, matching the row markup 1:1 between the clickable and non-clickable branches"
    - "Component-level render test via renderToStaticMarkup + a vi.mock('next/link', ...) stub rendering a plain <a>, mirroring tests/category-ranking-list.test.tsx's pattern — used because this repo has no jsdom/RTL setup for interaction tests, only SSR-markup assertions"

key-files:
  created: []
  modified:
    - components/dashboard/overview/overview-movers-panel.tsx
    - tests/overview-movers.test.tsx

key-decisions:
  - "Followed 68-PATTERNS.md's exact code shape literally: Link/div render as direct children of the <ul> (no <li> wrapper), each carrying the full row className including the base py-1.5/odd:bg-muted/30/rounded-sm/px-1 classes plus (Link only) hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring."
  - "href built strictly from m.categorySlug, never m.categoryId (Pitfall 2) — this plan's PLAN.md/PATTERNS.md both explicitly override the phase's 68-UI-SPEC.md §3, which still shows a stale category={m.categoryId} snippet predating Plan 68-03's slug fix."

requirements-completed: [NAV-01]

coverage:
  - id: D1
    description: "Each row in the three category-keyed movers columns (Variazioni di entrate, Dove hai risparmiato, Dove hai speso di più) is wrapped in a Link whose href is built from categorySlug (never categoryId), targeting /transactions?months={year}-{MM}&category={slug} with a zero-padded month"
    requirement: "NAV-01"
    verification:
      - kind: unit
        ref: "tests/overview-movers.test.tsx#OverviewMoversPanel (NAV-01 movers-row click-through) > wraps a category-keyed row in a Link built from categorySlug (never categoryId), with a zero-padded month"
        status: pass
      - kind: unit
        ref: "tests/overview-movers.test.tsx#OverviewMoversPanel (NAV-01 movers-row click-through) > does not leak the numeric categoryId into any generated href"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Accantonamenti (allocation) column stays a plain, non-clickable list, unchanged — explicitly out of NAV-01's literal scope"
    requirement: "NAV-01"
    verification:
      - kind: unit
        ref: "tests/overview-movers.test.tsx#OverviewMoversPanel (NAV-01 movers-row click-through) > renders the Accantonamenti (allocation) column as plain non-clickable text, unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "A row with a null categorySlug in a category-keyed column (defensive fallback, should not occur in practice) renders its content without a Link wrapper"
    requirement: "NAV-01"
    verification:
      - kind: unit
        ref: "tests/overview-movers.test.tsx#OverviewMoversPanel (NAV-01 movers-row click-through) > renders a defensive non-linked row when categorySlug is null/undefined in a category-keyed column"
        status: pass
    human_judgment: false

# Metrics
duration: ~15min
completed: 2026-07-21
status: complete
---

# Phase 68 Plan 07: MoverList Row Click-Through Summary

**Wrapped `OverviewMoversPanel`'s three category-keyed `MoverList` rows in a `next/link` `Link` built from `categorySlug`, closing out NAV-01 with zero backend changes.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-21T14:42:33+02:00
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `MoverListProps` extended with `year`/`selectedMonth`, threaded from the parent `OverviewMoversPanel` into all three category-keyed `MoverList` call sites (Column 1/2/3)
- Each row in those three columns is now a `next/link` `Link` (when `m.categorySlug` is present) targeting `/transactions?months={year}-{MM}&category={categorySlug}` — `MM` zero-padded (e.g. `2026-03`, not `2026-3`) — using the existing row classes plus additive `hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring` affordance classes
- Rows with a null/undefined `categorySlug` (defensive fallback — should not occur in these three columns) render as a plain non-linked `div` with unchanged row classes
- Column 4 (Accantonamenti) left completely untouched — still a plain `<li>` list grouped by `natureCode`, out of NAV-01's scope
- Added 4 new render tests to `tests/overview-movers.test.tsx` (via `renderToStaticMarkup` + a `next/link` stub, mirroring `tests/category-ranking-list.test.tsx`'s pattern) covering: slug-based href construction, zero-padded month format, no `categoryId` leakage into any href, the unchanged non-clickable Accantonamenti column, and the null-`categorySlug` fallback
- Full test suite green (137 files, 1723 passed, 1 pre-existing todo) and `yarn check:language` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap MoverList rows in a Link built from categorySlug (never categoryId)** - `aca7c8b` (feat)

## Files Created/Modified
- `components/dashboard/overview/overview-movers-panel.tsx` - Added `next/link` import; extended `MoverListProps`/`MoverList` with `year`/`selectedMonth`; each row now conditionally renders as `Link` (categorySlug present) or plain `div` (fallback), both as direct `<ul>` children with identical inner content; threaded `year={year} selectedMonth={selectedMonth}` into the three category-keyed `MoverList` call sites; Column 4 (Accantonamenti) untouched
- `tests/overview-movers.test.tsx` - Added a `vi.mock('next/link', ...)` stub and a new `OverviewMoversPanel (NAV-01 movers-row click-through)` describe block (4 tests) using `renderToStaticMarkup`

## Decisions Made
- Followed `68-PATTERNS.md`'s exact code shape: `Link`/`div` render as the `<ul>`'s direct mapped children (no `<li>` wrapper) — this matches the plan's `<action>` text literally and keeps the clickable/non-clickable branches byte-for-byte identical apart from the wrapping element.
- Built the href strictly from `m.categorySlug`, never `m.categoryId`, per the plan's explicit Pitfall 2 callout and `68-03-SUMMARY.md`'s confirmation that `categorySlug` was added specifically for this purpose — this deviates from the phase's `68-UI-SPEC.md` §3 snippet (which still shows the stale `category={m.categoryId}` from before Plan 68-03 fixed the slug/id mismatch); the PLAN.md and PATTERNS.md for this specific plan are authoritative and explicit about the correction.
- Used `renderToStaticMarkup` + a `next/link` mock stub for the new component tests (no jsdom/RTL harness exists in this repo) — same pattern as `tests/category-ranking-list.test.tsx`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Two initial test assertions failed on the first run because `renderToStaticMarkup` HTML-escapes `&` to `&amp;` in query strings — fixed by asserting `&amp;category=` instead of a raw `&`, no production code change involved.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

NAV-01 is fully satisfied: with a month selected, every row in the three category-keyed movers columns is clickable and navigates to the correctly pre-filtered transactions list; the allocation column is untouched. No further plans depend on this one's output within this phase.

---
*Phase: 68-tags-dashboard-and-navigation*
*Completed: 2026-07-21*

## Self-Check: PASSED

`components/dashboard/overview/overview-movers-panel.tsx`, `tests/overview-movers.test.tsx`, and this SUMMARY.md all found on disk; task commit `aca7c8b` verified present in git log.
