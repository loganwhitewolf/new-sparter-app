---
phase: quick-260707-fy4
plan: 01
subsystem: ui
tags: [nextjs, react, sessionStorage, table-filters, url-state]

requires: []
provides:
  - Per-tab persistence of table filters/sort across bare navigation (transactions, expenses, files)
affects: [table-filter-sort, detail-pages]

tech-stack:
  added: []
  patterns:
    - "sessionStorage as a restore-only layer behind a URL-source-of-truth hook (URL always wins when params are present)"

key-files:
  created:
    - tests/use-table-url-persistence.test.ts
  modified:
    - components/data-table/use-table-url.ts
    - .planning/table-filter-sort-DECISIONS.md

key-decisions:
  - "URL stays the single source of truth; sessionStorage only restores state on a bare mount with an empty query string — never overrides a URL that already carries params (shared link, refresh, back/forward, v2.5 smart-back)."
  - "Save happens inside replaceWith (the single funnel for updateParam/updateParams/useToolbarSort), including the empty-string case, so 'Cancella tutto' persists as cleared rather than falling back to a stale prior save."
  - "Restore calls router.replace directly (not through replaceWith) to keep 'save' semantics strictly on user-initiated writes."

patterns-established:
  - "Pure, storage-agnostic helpers (tableUrlStorageKey/safeSessionStorage/saveTableQuery/readRestorableQuery) unit-tested without jsdom, mirroring the attachPopstateRefresh/hasInAppHistory precedent in detail-page-shell.tsx."

requirements-completed: [QUICK-FY4]

coverage:
  - id: D1
    description: "useTableUrl saves every filter/sort write (including cleared state) to a per-route sessionStorage key and restores it via router.replace only on a bare mount with no URL params"
    requirement: "QUICK-FY4"
    verification:
      - kind: unit
        ref: "tests/use-table-url-persistence.test.ts (13 tests: tableUrlStorageKey, saveTableQuery, readRestorableQuery)"
        status: pass
      - kind: unit
        ref: "tests/data-table-toolbar.test.tsx (14 tests — SSR/render regression guard, unchanged)"
        status: pass
    human_judgment: true
    rationale: "Cross-tab-navigation restore behavior (leave /transactions, visit /expenses via nav, return via nav) and the v2.5 smart-back non-interference claim are runtime browser behaviors not exercised by the unit/SSR test suite — the plan's own verification section calls for manual post-execute checks."

duration: 3min
completed: 2026-07-07
status: complete
---

# Quick Task 260707-fy4: Persistent Table Filters via sessionStorage Summary

**Added a per-tab sessionStorage restore layer to the shared `useTableUrl` hook so bare re-entry into /transactions, /expenses, or /import restores the last filters/sort, while a URL that already carries params (shared link, refresh, back/forward, smart-back) always wins.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-07T15:08:00+02:00
- **Completed:** 2026-07-07T15:12:12+02:00
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `useTableUrl` now exports four pure helpers (`tableUrlStorageKey`, `safeSessionStorage`, `saveTableQuery`, `readRestorableQuery`) that are unit-tested independently of React/jsdom.
- `replaceWith` — the single funnel for `updateParam`, `updateParams`, and `useToolbarSort` — saves every write to a per-route sessionStorage key, including the empty-string "cleared" case.
- A mount-only effect restores the saved query via `router.replace` exactly when the current URL has no search params; it never fires when params are already present, preserving shared links, refresh, browser back/forward, and the v2.5 smart-back history-entry path.
- `.planning/table-filter-sort-DECISIONS.md` Architecture bullet amended (locked decision 5) to describe the new sessionStorage restore layer while keeping URL-as-source-of-truth and the localStorage rejection intact.

## Task Commits

Each task was committed atomically (TDD: RED → GREEN):

1. **Task 1 RED: add failing tests for useTableUrl sessionStorage helpers** - `a344159` (test)
2. **Task 1 GREEN: persist table filters via sessionStorage restore layer** - `def3f4b` (feat)
3. **Task 2: amend table-filter-sort-DECISIONS.md URL-source-of-truth line** - `72d06b8` (docs)

_TDD gate sequence verified in git log: test(...) before feat(...), both before the docs commit._

## Files Created/Modified
- `tests/use-table-url-persistence.test.ts` - New unit test file; 13 tests covering key derivation, save (including cleared/no-op-on-error), and restore (URL-wins, cleared-state, absent-key, storage-null, throwing-getItem) cases.
- `components/data-table/use-table-url.ts` - Adds the four exported pure helpers plus hook wiring: save in `replaceWith`, restore in a mount-only `useEffect` (empty deps, eslint-disable comment per plan).
- `.planning/table-filter-sort-DECISIONS.md` - One-bullet amendment to the Architecture section; rest of the file byte-identical (verified via `git diff --stat`, 1 insertion/1 deletion).

## Decisions Made
See key-decisions in frontmatter. No deviations from the plan's stated architecture.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Pre-existing, out-of-scope test/lint failures observed during full-suite verification (not caused by this task, not touched):**
- `yarn test` full run: 8 pre-existing failures in `tests/expense-actions.test.ts`, `tests/import-table-actions.test.tsx`, `tests/overview-interactions.test.tsx` (EDU-01/EDU-02 education tooltips), and `lib/validations/__tests__/expense.test.ts` (120-char title validation). None of these files were touched by this task; the targeted verification command from the plan (`tests/use-table-url-persistence.test.ts tests/data-table-toolbar.test.tsx`) passes 100% (27/27).
- `yarn check:language`: 5 pre-existing developer-comment-language violations in `components/expenses/bulk-categorize-dialog.tsx`, `components/expenses/expense-uncategorized-cta.tsx`, `lib/dal/expenses.ts`, `lib/dal/transactions.ts`, `lib/services/transaction-edit.ts` — none in files this task modified.

Per the executor's scope-boundary rule, these are logged here for visibility but were not auto-fixed (out of scope for this quick task).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Feature is code-complete and unit-tested. Three manual checks remain for the developer per the plan's `<verification>` section (browser-only, cannot be automated in this session):
1. Filter `/transactions`, navigate to `/expenses` via nav, return to `/transactions` via nav → filters should restore.
2. Press "Cancella tutto", leave, return → should show unfiltered (not stale).
3. Open a detail page and use "Indietro" (smart back) → filters should stay intact via the history entry (v2.5 smart-back unaffected).

No blockers for closing this quick task once the manual checks are confirmed.

---
*Quick task: 260707-fy4*
*Completed: 2026-07-07*

## Self-Check: PASSED

All created/modified files found on disk; all three task commits (a344159, def3f4b, 72d06b8) verified present in git log.
