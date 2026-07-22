---
phase: quick-260721-o5t
plan: 01
subsystem: dashboard
tags: [drizzle, dashboard-dal, expense-group, left-join]

requires:
  - phase: 65-expense-group-merge-and-view
    provides: expenseGroup/expenseGroupMembership schema + the transactions.ts leftJoin(expenseGroup) reference pattern
provides:
  - getCategoryDetail's topTransactionRows query now resolves and displays the Expense Group title
affects: [dashboard-category-detail]

tech-stack:
  added: []
  patterns:
    - "Group-title display precedence mirrored from lib/dal/transactions.ts: leftJoin(expenseGroupMembership) -> leftJoin(expenseGroup), title = customTitle ?? groupTitle ?? description"

key-files:
  created: []
  modified:
    - lib/dal/dashboard.ts
    - tests/dashboard-dal.test.ts

key-decisions:
  - "Mirrored the exact join order/shape already shipped in lib/dal/transactions.ts rather than inventing a new pattern"
  - "Added expenseGroup/expenseGroupMembership to the dashboard-dal.test.ts schema mock (Rule 3 blocking fix) - the mock predates this plan and did not carry these tables, which the tagId-threading tests' where-call-count assertions silently depended on"

patterns-established: []

requirements-completed: [GRP-08]

coverage:
  - id: D1
    description: "topTransactionRows query leftJoins expenseGroupMembership + expenseGroup and selects groupTitle; CategoryDetailTopTransactionRow carries groupTitle: string | null"
    requirement: "GRP-08"
    verification:
      - kind: unit
        ref: "tests/dashboard-dal.test.ts#builds category detail data with zero-filled trends, summary stats, breakdown percentages, and normalized top transactions"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildCategoryDetailData composes title: row.customTitle ?? row.groupTitle ?? row.description, proving both precedence branches (customTitle wins; groupTitle wins over raw description)"
    requirement: "GRP-08"
    verification:
      - kind: unit
        ref: "tests/dashboard-dal.test.ts#builds category detail data with zero-filled trends, summary stats, breakdown percentages, and normalized top transactions"
        status: pass
    human_judgment: false
  - id: D3
    description: "Dashboard category-detail Top 5 movimenti panel shows the grouped expense's title in the live UI, not just in the DAL unit test"
    verification: []
    human_judgment: true
    rationale: "No jsdom/browser test env in this repo (node-only Vitest); requires a manual smoke check against a category containing a grouped expense, as noted in the plan's optional verification step"

duration: 12min
completed: 2026-07-21
status: complete
---

# Quick Task 260721-o5t: Show Expense Group title in dashboard category-detail Summary

**Dashboard "Top 5 movimenti" panel now resolves a grouped expense's title via the same `leftJoin(expenseGroupMembership).leftJoin(expenseGroup)` pattern already shipped in `lib/dal/transactions.ts`, closing the GRP-08 milestone-audit gap.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-21T15:18:00Z
- **Completed:** 2026-07-21T15:30:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `getCategoryDetail`'s `topTransactionRows` query now leftJoins `expenseGroupMembership` then `expenseGroup` (mirroring the shipped `lib/dal/transactions.ts` pattern) and selects `groupTitle: expenseGroup.title`
- `CategoryDetailTopTransactionRow` carries `groupTitle: string | null`
- `buildCategoryDetailData`'s title composition changed from `row.customTitle ?? row.description` to `row.customTitle ?? row.groupTitle ?? row.description`, matching the precedence used everywhere else in the app
- Test coverage extended to prove both precedence branches (customTitle still wins; groupTitle wins over raw description)

## Task Commits

Each task was committed atomically:

1. **Task 1: Join expenseGroup into topTransactionRows and fix title composition** - `7d62fe9` (fix)
2. **Task 2: Verify component, extend test coverage, run full suite + language check** - `0b473c3` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `lib/dal/dashboard.ts` - Added `expenseGroup`/`expenseGroupMembership` imports; leftJoined both into the `topTransactionRows` query chain (after `innerJoin(expense, ...)`, before `innerJoin(subCategory, ...)`); added `groupTitle: expenseGroup.title` to the select and `groupTitle: string | null` to `CategoryDetailTopTransactionRow`; fixed title composition precedence in `buildCategoryDetailData`
- `tests/dashboard-dal.test.ts` - Added `expenseGroup`/`expenseGroupMembership` to the `@/lib/db/schema` test mock (missing entries broke once dashboard.ts started importing them - see Deviations); extended the `buildCategoryDetailData` fixture with `groupTitle` on both mock rows to cover both precedence branches; added `groupTitle: null` to the empty-metadata test's fixture rows to satisfy the now-required field

## Decisions Made
- Mirrored `lib/dal/transactions.ts`'s exact join order and select shape rather than inventing a new convention - this is a pure consistency fix, not new design.
- No change made to `components/dashboard/category-top-transactions.tsx` - its `displayTitle()` reads the pre-composed `transaction.title` field directly; it never independently resolves `customTitle`/`description`, so the DAL-level fix is sufficient (confirmed via Task 2 read-first, no edit required).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing `expenseGroup`/`expenseGroupMembership` entries to the dashboard-dal.test.ts schema mock**
- **Found during:** Task 2 (running `vitest run tests/dashboard-dal.test.ts`)
- **Issue:** `tests/dashboard-dal.test.ts` mocks `@/lib/db/schema` with a plain-object stub that predates this plan and never included `expenseGroup`/`expenseGroupMembership`. Once `lib/dal/dashboard.ts` (Task 1) started importing and referencing those tables inside the query builder, `eq(expense.id, expenseGroupMembership.expenseId)` accessed `.expenseId` on an object property that resolved from `undefined`, which broke the tagId-threading tests' where-call-count assertions (2 failures: expected 4 where() calls, got 3 - the added leftJoins were silently no-op'ing against undefined schema refs).
- **Fix:** Added `expenseGroup: { id, title }` and `expenseGroupMembership: { groupId, expenseId }` to the schema mock, using the identical shape already established in `tests/transactions-dal.test.ts` for the same tables.
- **Files modified:** tests/dashboard-dal.test.ts
- **Verification:** `node_modules/.bin/vitest run tests/dashboard-dal.test.ts` - 52/52 pass; full suite (137 files / 1723 tests) green.
- **Committed in:** 0b473c3 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to unblock the test suite after Task 1's schema import addition; no scope creep - same fix pattern already established in the sibling `transactions-dal.test.ts` file.

## Issues Encountered
None beyond the deviation above.

## Known Stubs
None.

## Threat Flags
None - the plan's own threat register (T-quick260721o5t-01, disposition: accept) already covers the only new surface (leftJoin(expenseGroup) reachable only through the user's own expense chain, unchanged userId scoping).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- GRP-08 milestone-audit gap closed; no follow-on work required for this quick task.
- Manual smoke check (dashboard category-detail page, a category containing a grouped expense, confirm Top 5 movimenti shows the group title) is optional per the plan and not required for done - flagged as `human_judgment: true` coverage item D3 above for anyone who wants to close the loop visually.

---
*Phase: quick-260721-o5t*
*Completed: 2026-07-21*

## Self-Check: PASSED

- FOUND: lib/dal/dashboard.ts
- FOUND: tests/dashboard-dal.test.ts
- FOUND: .planning/quick/260721-o5t-show-expense-group-title-in-dashboard-ca/SUMMARY.md
- FOUND commit: 7d62fe9
- FOUND commit: 0b473c3
