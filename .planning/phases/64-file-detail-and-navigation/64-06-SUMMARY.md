---
phase: 64-file-detail-and-navigation
plan: 06
subsystem: ui
tags: [nextjs, app-router, client-cache, navigation, vitest]

requires:
  - phase: 64-file-detail-and-navigation (plan 05)
    provides: DetailPageShell smart-back heuristic (router.back() vs router.push(backHref) fallback)
provides:
  - attachPopstateRefresh helper busting Next.js's back/forward Client Cache exactly once per router.back() call
  - Fix for the UAT-reported defect where returning from a detail page lost the origin table's active filter
affects: [file-detail-and-navigation, detail-pages-tx-expense]

tech-stack:
  added: []
  patterns:
    - "One-time popstate listener ({ once: true }) armed synchronously before router.back(), invoking router.refresh() to bust the App Router Client Cache without adding a history entry or losing scroll position"

key-files:
  created: []
  modified:
    - components/detail-pages/detail-page-shell.tsx
    - tests/detail-page-shell.test.tsx

key-decisions:
  - "Fix is scoped to the exact router.back() call site inside handleBackClick's else branch; the router.push(backHref) static-fallback branch is untouched"
  - "attachPopstateRefresh is a standalone named export (no React/hooks) so it is unit-testable with a plain mock object, no jsdom needed"

patterns-established:
  - "Client Cache busting after router.back(): arm a { once: true } popstate listener on window before calling router.back(), invoking router.refresh() when it fires — self-removing, no listener accumulation across repeated back-navigations"

requirements-completed: [DET-09]

coverage:
  - id: D1
    description: "attachPopstateRefresh helper registers a { once: true } popstate listener on a given target and invokes the callback exactly once when triggered"
    requirement: "DET-09"
    verification:
      - kind: unit
        ref: "tests/detail-page-shell.test.tsx#attachPopstateRefresh > registers a once-only popstate listener that invokes the callback"
        status: pass
    human_judgment: false
  - id: D2
    description: "router.back() from a filtered table's detail page re-fetches the destination table's fresh RSC data (last-applied filter/sort) with scroll position preserved, instead of a stale pre-filter Client Cache snapshot"
    requirement: "DET-09"
    verification: []
    human_judgment: true
    rationale: "Requires observing real browser back/forward Client Cache behavior across /transactions, /expenses, and /import/[fileId] with an active filter — not reproducible in vitest/jsdom without a real Next.js App Router runtime"
  - id: D3
    description: "The static-fallback path (router.push(backHref) for fresh-tab/no-history/external-referrer cases) is unaffected — no listener attached, no refresh, no behavior change from Plan 64-05"
    requirement: "DET-09"
    verification:
      - kind: unit
        ref: "tests/detail-page-shell.test.tsx#DetailPageShell (existing 4 tests, unmodified, all pass)"
        status: pass
    human_judgment: true
    rationale: "Existing unit tests only exercise rendered markup, not handleBackClick's branch selection at runtime; the plan's human-check explicitly asks for direct-URL-paste verification of the fallback branch"

duration: 5min
completed: 2026-07-06
status: complete
---

# Phase 64 Plan 06: Client Cache Cache-Busting on Smart-Back Summary

**DetailPageShell arms a one-time popstate listener before router.back() to force-refresh the destination table's RSC payload, closing the UAT-reported "filter lost on Indietro" defect without touching the static-fallback path.**

## Performance

- **Duration:** 5 min
- **Completed:** 2026-07-06T15:40:01+02:00
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Added `attachPopstateRefresh(target, onPopstate)` — a standalone, hook-free helper that registers a `{ once: true }` `popstate` listener, fully unit-testable with a plain mock object
- Wired it into `handleBackClick`'s `router.back()` branch: the listener is armed synchronously before `router.back()` fires, then calls `router.refresh()` on the `popstate` event to bust Next.js's back/forward Client Cache for the destination route
- Left the `router.push(backHref)` static-fallback branch (Plan 64-05's original behavior) completely untouched — no listener, no refresh, no double-fetch
- Extended the existing `next/navigation` mock in `tests/detail-page-shell.test.tsx` with `refresh: vi.fn()` and added a new `describe('attachPopstateRefresh', ...)` block covering both the registration call's arguments and the once-only callback invocation

## Task Commits

Each task was committed atomically (TDD: RED then GREEN — no REFACTOR needed, implementation was minimal):

1. **Task 1 (RED): add failing test for attachPopstateRefresh** - `1be469c` (test)
2. **Task 1 (GREEN): implement attachPopstateRefresh + wire into handleBackClick** - `ad94b3d` (feat)

**Plan metadata:** committed in this same task (docs commit below)

## Files Created/Modified
- `components/detail-pages/detail-page-shell.tsx` - Added `attachPopstateRefresh` named export; `handleBackClick`'s `else` branch now arms the listener (wired to `router.refresh()`) before calling `router.back()`
- `tests/detail-page-shell.test.tsx` - `next/navigation` mock gains `refresh: vi.fn()`; new `describe('attachPopstateRefresh', ...)` block asserts registration args and once-only firing

## Decisions Made
- Scoped the fix to the exact traced call site (`router.back()` inside `handleBackClick`'s `else` branch) rather than touching `use-table-url.ts`'s `router.replace()` writes — switching those to `push()` was explicitly rejected in the debug session as a worse tradeoff (history spam on every filter change)
- Kept `attachPopstateRefresh` as a plain function with no React import/hooks so it is directly unit-testable without jsdom, per the plan's `must_haves.artifacts` requirement

## Deviations from Plan

None — plan executed exactly as written. TDD RED phase confirmed the new test failed with `TypeError: attachPopstateRefresh is not a function` before implementation; GREEN phase made all 10 tests in the file pass; no REFACTOR commit was needed since the implementation is already minimal (a single `addEventListener` call).

## Issues Encountered

`yarn tsc --noEmit` reports pre-existing type errors in unrelated files (`tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, `tests/transactions-dal.test.ts` — a `PatternSuggestion.sampleAmounts` shape mismatch and a `SQL<string>` cast issue). Confirmed none reference `detail-page-shell.tsx`; out of scope per this plan's verification note ("no new errors attributable to this file") and per the deviation-rules scope boundary (pre-existing failures in unrelated files are out of scope). Logged here, not fixed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The automated half of this gap-closure plan is complete and verified (10/10 tests passing, `attachPopstateRefresh` directly unit-tested). The plan's `<verify><human-check>` step — manually confirming filtered-table back-preservation on `/transactions`, `/expenses`, and `/import/[fileId]`, plus confirming the static-fallback path is unaffected on direct URL load — still requires a human browser session; this is the D2/D3 `human_judgment: true` coverage entries above, to be exercised via UAT.

---
*Phase: 64-file-detail-and-navigation*
*Completed: 2026-07-06*
