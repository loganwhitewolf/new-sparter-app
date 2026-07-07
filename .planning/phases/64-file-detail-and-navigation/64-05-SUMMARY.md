---
phase: 64-file-detail-and-navigation
plan: 05
subsystem: ui
tags: [next.js, react, navigation, detail-page]

# Dependency graph
requires:
  - phase: 64-file-detail-and-navigation
    provides: "FileDetailClient passing APP_ROUTES.import as backHref (Plan 64-03); DetailPageShell shared shell (Phase 63)"
provides:
  - "Smart-back navigation in DetailPageShell: router.back() when in-app history exists, static backHref fallback otherwise"
  - "Retroactively completes DET-09 consistent-back behavior for the transaction and expense pages shipped in Phase 63"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Smart-back control keeps a real <a href={backHref}> element (SSR/no-JS fallback) with an onClick handler that preventDefault()s and chooses router.back() vs router.push(backHref) based on window.history.length and document.referrer origin"
    - "Components that call useRouter and are exercised via renderToStaticMarkup in tests must mock next/navigation (established precedent: tests/transaction-table-menu.test.tsx, tests/data-table-toolbar.test.tsx)"

key-files:
  created: []
  modified:
    - components/detail-pages/detail-page-shell.tsx
    - tests/detail-page-shell.test.tsx

key-decisions:
  - "Fallback-to-backHref conditions: window.history.length <= 1 (fresh tab/direct load) OR document.referrer present and cross-origin (external link). Any other case (same-origin referrer, or no referrer with existing history — e.g. client-side in-app navigation) prefers router.back(), per the plan's 'err toward router.back() whenever any in-app history signal exists' guidance."
  - "Added vi.mock('next/navigation') to tests/detail-page-shell.test.tsx — DetailPageShell now calls useRouter() unconditionally at render time, which throws 'invariant expected app router to be mounted' under plain renderToStaticMarkup without a mount context (Rule 1 bug fix, discovered running the plan's own acceptance test)"
  - "No new exports added — decision logic lives inline in the existing onClick handler on DetailPageShell, per the plan's 'no new exports, no prop-shape change' constraint; this also means the fallback decision itself is only verified via the SSR href assertions, not a unit-tested pure function"

requirements-completed: [DET-09]

coverage:
  - id: D1
    description: "DetailPageShell's back control renders as a real <a href={backHref}> in SSR/no-JS markup for all three detail pages (transactions, expenses, import), unchanged for the two existing call sites and verified for the new file-detail fallback route"
    requirement: DET-09
    verification:
      - kind: unit
        ref: "tests/detail-page-shell.test.tsx#DetailPageShell > renders a back link to backHref"
        status: pass
      - kind: unit
        ref: "tests/detail-page-shell.test.tsx#DetailPageShell > renders a back link to backHref for the file detail page fallback route (D-08 applies to all three detail pages)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Clicking the back control with JS active calls event.preventDefault() then either router.back() (in-app history available) or router.push(backHref) (fresh tab / external referrer), never a dead click or hard reload"
    requirement: DET-09
    verification: []
    human_judgment: true
    rationale: "The project's vitest config runs in the 'node' test environment (no jsdom, no @testing-library/react); renderToStaticMarkup cannot simulate a click event or inspect window.history/document.referrer at runtime. Per the plan's own read_first note, this path requires the human-check: open a filtered table, click into a detail page, click Indietro, confirm the filter/scroll state survives; then open the same URL directly and confirm it falls back to the static route."

duration: 8min
completed: 2026-07-06
status: complete
---

# Phase 64 Plan 05: Smart Back Link in DetailPageShell Summary

**DetailPageShell's back control now tries `router.back()` first (preserving the origin table's ephemeral filters/sort/scroll) and falls back to the static `backHref` route only when there's no usable in-app history — retroactively completing "consistent back behavior" (DET-09) for all three detail pages (transaction, expense, file) from one shared implementation.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-06T13:55:00+02:00 (approx.)
- **Completed:** 2026-07-06T14:03:00+02:00
- **Tasks:** 1 completed
- **Files modified:** 2

## Accomplishments

- `DetailPageShell`'s back affordance changed from a plain `next/link` `<Link href={backHref}>` to an `<a href={backHref}>` with an `onClick` handler: `event.preventDefault()`, then a same-tick decision between `router.back()` (imported via `useRouter` from `next/navigation`) and `router.push(backHref)`.
- Fallback-to-static-route decision: `window.history.length <= 1` (fresh tab / direct load) or a cross-origin `document.referrer` (external link) triggers `router.push(backHref)`; otherwise `router.back()` is used, preserving the origin table's URL-encoded filters/sort/scroll position via Next.js's existing history-based navigation.
- No changes required to any of the three call sites (`transaction-detail-client.tsx`, `expense-detail-client.tsx`, `file-detail-client.tsx`) — all three continue to pass `APP_ROUTES.transactions` / `APP_ROUTES.expenses` / `APP_ROUTES.import` unchanged, confirming the `backHref` prop's shape and call-site contract are untouched.
- No new npm dependency added.

## Task Commits

Each task was committed atomically:

1. **Task 1: Smart-back control in DetailPageShell (history-first, static-fallback)** - `b829208` (feat, TDD-style: ran the existing test first, hit a blocking failure, fixed, then green)

## Files Created/Modified

- `components/detail-pages/detail-page-shell.tsx` - back link is now an `<a>` with a `useRouter`-driven `onClick` handler implementing the history-first/static-fallback decision
- `tests/detail-page-shell.test.tsx` - added `vi.mock('next/navigation')` (required once `useRouter` is called at render time) and one new test asserting the file detail page's `backHref="/import"` still renders in static markup

## Decisions Made

- Fallback decision uses `window.history.length <= 1 || isExternalReferrer` as the sole "no usable in-app history" signal, matching the plan's explicit guidance to err toward `router.back()` whenever any in-app history signal exists.
- Kept the underlying element a real anchor (`<a href={backHref}>`, not a `<button>`) so SSR output, no-JS clients, and a missed/failed JS path all still degrade to a normal navigable link — this directly satisfies the plan's `threat_model` mitigation for T-64-10 (dead-click DoS-UX risk).
- No new exports from `detail-page-shell.tsx` — the fallback decision logic is inline in the component's `onClick` handler, per the plan's explicit "no new exports, no prop-shape change" constraint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mocked `next/navigation` in `tests/detail-page-shell.test.tsx`**
- **Found during:** Task 1, first test run after adding `useRouter()` to the component
- **Issue:** `DetailPageShell` now calls `useRouter()` unconditionally during render. The existing test file renders via `renderToStaticMarkup` with no Next.js app-router mount context, so all three pre-existing tests and the new test failed immediately with `Error: invariant expected app router to be mounted`.
- **Fix:** Added `vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }))` at the top of the test file, matching the established project pattern already used in `tests/transaction-table-menu.test.tsx` and `tests/data-table-toolbar.test.tsx` for components that call `next/navigation` hooks during render.
- **Files modified:** `tests/detail-page-shell.test.tsx`
- **Verification:** All 9 tests in `tests/detail-page-shell.test.tsx` pass; `tests/expense-detail-page.test.tsx` and `tests/transaction-detail-page.test.tsx` (which already mock `next/navigation` for their own `useRouter` usage) continue to pass unchanged, confirming their existing mocks are unaffected by this shell-level change.
- **Committed in:** `b829208` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking test breakage caused directly by this task's own change)
**Impact on plan:** Necessary to keep the plan's own acceptance test (`yarn vitest run tests/detail-page-shell.test.tsx`) green. No scope creep — fix is confined to the test file this plan already lists as modified.

## Issues Encountered

None beyond the auto-fixed test-mocking issue above. `yarn tsc --noEmit` and `yarn lint` show no errors attributable to `detail-page-shell.tsx` or its test file; the pre-existing unrelated failures already logged in Plan 64-01/64-03/64-04 summaries (`tests/overview-interactions.test.tsx`, `tests/expense-actions.test.ts`, `tests/import-table-actions.test.tsx`, `lib/validations/__tests__/expense.test.ts`, seven pre-existing `tsc` errors) were confirmed present before this plan's changes and are out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

This was the final plan of Phase 64. All three detail pages (`/transactions/[id]`, `/expenses/[id]`, `/import/[fileId]`) now share one smart-back implementation via `DetailPageShell`. DET-08 and DET-09 are both fully implemented across Phases 63-64. The plan's `<verify>` section calls for a manual dual-path check (filtered-table back-preservation, and direct-URL back-fallback) on all three pages before `/gsd-verify-work` — flagged here as a human-judgment coverage item (D2) since the project's test environment (vitest, node, no jsdom) cannot simulate `window.history`/`document.referrer`-driven click behavior.

---
*Phase: 64-file-detail-and-navigation*
*Completed: 2026-07-06*

## Self-Check: PASSED
