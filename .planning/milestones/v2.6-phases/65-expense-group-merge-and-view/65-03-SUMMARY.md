---
phase: 65-expense-group-merge-and-view
plan: 03
subsystem: database
tags: [drizzle, postgres, decimal.js, expense-group, dal]

# Dependency graph
requires:
  - phase: 65-01
    provides: "expenseGroup/expenseGroupMembership schema"
  - phase: 65-02
    provides: "createExpenseGroup/mergeExpenses write path (groups now exist to compose)"
provides:
  - "getExpenses read-time group composition (N member rows -> 1 composed row per group, Decimal.js-summed totals, pagination-safe)"
  - "getExpenseForDetail groupId/groupTitle pass-through"
  - "getExpenseGroupForDetail / getExpenseGroupMembers (ownership-scoped group detail query)"
  - "expenseGroupDetailHref route helper"
  - "getTransactions / getTransactionForDetail groupId/groupTitle (transaction group-title display precedence)"
affects: [65-04, 65-05, 65-06, 66-expense-group-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Collapse-then-paginate: getExpenses fetches the full filtered+joined row set WITHOUT SQL .limit()/.offset(), collapses expenseGroupMembership rows into one composed ExpenseRow per group in JS, then sorts (JS mirror of buildExpenseOrderBy) and slices — guarantees a group is never split across two loadMoreExpenses pages"
    - "Group aggregate totals/counts always summed via toDecimal/toDbDecimal, never native +/-/* — same convention as lib/services/expense-group.ts (65-02)"
    - "getExpenseGroupForDetail mirrors getExpenseForDetail's two-query shape (scoped existence query returning undefined on no match, then a separate members/transactions query) — T-65-07 ownership boundary: a groupId belonging to another user resolves identically to a missing id"
    - "Transaction group-title precedence is display-only: groupId/groupTitle added via LEFT JOIN to transactionListSelect and getTransactionForDetail's select with zero impact on existing sort/filter keys (buildTransactionOrderBy untouched)"

key-files:
  created: []
  modified:
    - lib/dal/expenses.ts
    - lib/dal/transactions.ts
    - lib/routes.ts
    - tests/expense-detail-dal.test.ts
    - tests/expense-group-dal.test.ts
    - tests/expense-table-menu.test.tsx
    - tests/transactions-dal.test.ts
    - tests/transaction-detail-dal.test.ts
    - tests/transaction-table-menu.test.tsx

key-decisions:
  - "amountMin/amountMax filtering moved to the final composed array (comparing the group's aggregate total), not the raw per-member SQL rows, so range filters test what the user sees"
  - "platformName is left null on a composed group row rather than guessed, since a group's members may span multiple platforms — out of scope for GRP-03"
  - "getExpenseGroupMembers is a thin standalone helper (member expense ids only) separate from getExpenseGroupForDetail's full payload, for callers that need membership without the detail cost"

patterns-established:
  - "Any DAL type extension (ExpenseRow, TransactionListRow, etc.) that adds required fields must be swept against every test fixture literal typed as that interface, not just the fixtures in the plan's own `<files>` list — tsc catches these immediately, and fixing them is an in-scope blocking fix (Rule 3), not scope creep"

requirements-completed: [GRP-03, GRP-04, GRP-08]

coverage:
  - id: D1
    description: "getExpenses composes group rows read-time (N members -> 1 row) with Decimal.js-correct sums and pagination-safe collapsing (never split across two pages); ungrouped output is byte-for-byte unchanged"
    requirement: "GRP-03"
    verification:
      - kind: unit
        ref: "tests/expenses-dal.test.ts (composition, pagination-boundary, search-on-either-title, amount-range-on-aggregate, ungrouped-regression cases)"
        status: pass
      - kind: unit
        ref: "tests/expense-detail-dal.test.ts (getExpenseForDetail groupId/groupTitle pass-through)"
        status: pass
    human_judgment: false
  - id: D2
    description: "getExpenseGroupForDetail/getExpenseGroupMembers/expenseGroupDetailHref exist and are ownership-scoped (undefined for missing or cross-user groupId, never throws)"
    requirement: "GRP-04"
    verification:
      - kind: unit
        ref: "tests/expense-group-dal.test.ts (happy path 2+ members, missing groupId, cross-user groupId, zero-transaction member, occurredAt DESC ordering across members)"
        status: pass
    human_judgment: false
  - id: D3
    description: "transactionListSelect and getTransactionForDetail expose groupId/groupTitle with zero regression for ungrouped transactions and no change to existing sort/filter keys"
    requirement: "GRP-08"
    verification:
      - kind: unit
        ref: "tests/transactions-dal.test.ts (transactionListSelect shape, null groupId/groupTitle for ungrouped, unchanged default sort)"
        status: pass
      - kind: unit
        ref: "tests/transaction-detail-dal.test.ts (getTransactionForDetail groupId/groupTitle null-for-ungrouped and pass-through-when-grouped)"
        status: pass
    human_judgment: false

duration: ~20min (across two sessions; see Issues Encountered)
completed: 2026-07-19
status: complete
---

# Phase 65 Plan 3: expense-group-merge-and-view Summary

**Read-time DAL layer for Expense Groups: `getExpenses` composes N member rows into one Decimal.js-summed group row without ever splitting a group across pagination pages, `getExpenseGroupForDetail` powers the group detail page with an ownership-only-boundary, and both transaction query functions gain display-only group-title precedence.**

## Performance

- **Duration:** ~20 min of actual work, spread across two sessions (task 1-2 committed 2026-07-18 20:10-20:12; task 3 resumed and committed 2026-07-19, after a stream-watchdog interruption — see Issues Encountered)
- **Started:** 2026-07-18T20:10:07+02:00
- **Completed:** 2026-07-19T15:15:00+02:00
- **Tasks:** 3
- **Files modified:** 9 (0 created, 9 modified)

## Accomplishments
- `getExpenses`: full filtered+joined row set fetched without SQL `.limit()`/`.offset()`, collapsed into composed `ExpenseRow[]` via a private `composeExpenseRows` helper (groups by `groupId ?? 'own:' + id`, sums `totalAmount`/`transactionCount` with `toDecimal`/`toDbDecimal`, resolves category fields from `expenseGroup.subCategoryId`), then sorted (JS mirror of `buildExpenseOrderBy`, `id` tiebreaker) and sliced — a group can never be split across two `loadMoreExpenses` pages
- `ExpenseRow`/`ExpenseDetailRow` gain `groupId`, `groupTitle`, `firstTransactionAt`, `lastTransactionAt`; `getExpenseForDetail` passes `groupId`/`groupTitle` straight through with no composition
- `getExpenseGroupForDetail`/`getExpenseGroupMembers` added to `lib/dal/expenses.ts`, mirroring `getExpenseForDetail`'s two-query ownership-scoped shape (T-65-07: a cross-user or missing `groupId` resolves to `undefined`, identical, never leaking group data); `expenseGroupDetailHref` added to `lib/routes.ts`
- `getTransactions`/`getTransactionForDetail` gain `groupId`/`groupTitle` via the same `expenseGroupMembership -> expenseGroup` join chain, added to `transactionListSelect`, `TransactionListRow`, and `TransactionDetailRow` — display-only, zero impact on `buildTransactionOrderBy` or any filter key

## Task Commits

Each task was committed atomically:

1. **Task 1: getExpenses read-time group composition + ExpenseRow/ExpenseDetailRow extension** - `7e2aa3f` (feat)
2. **Task 2: getExpenseGroupForDetail + getExpenseGroupMembers + expenseGroupDetailHref** - `fdf5f54` (feat)
3. **Task 3: transaction group-title precedence in lib/dal/transactions.ts** - `d0cef77` (feat)

**Plan metadata:** (pending — final commit below)

_Note: this plan's tasks are not TDD-tagged in the classic RED/GREEN sense per commit, but each commit bundles its production code and its new/updated test cases together._

## Files Created/Modified
- `lib/dal/expenses.ts` - `getExpenses` composition (`composeExpenseRows`), `ExpenseRow`/`ExpenseDetailRow` extension, `getExpenseGroupForDetail`, `getExpenseGroupMembers`, `ExpenseGroupDetailRow` type
- `lib/dal/transactions.ts` - `expenseGroup`/`expenseGroupMembership` joins added to `getTransactions` and `getTransactionForDetail`; `groupId`/`groupTitle` on `transactionListSelect`, `TransactionListRow`, `TransactionDetailRow`
- `lib/routes.ts` - `expenseGroupDetailHref`
- `tests/expense-detail-dal.test.ts` - `getExpenseForDetail` groupId/groupTitle pass-through cases
- `tests/expense-group-dal.test.ts` - new file's test suite: happy path, missing/cross-user groupId, zero-transaction member, ordering
- `tests/expense-table-menu.test.tsx` - fixture fix (missing new required `ExpenseRow` fields after Task 1's type extension)
- `tests/transactions-dal.test.ts` - `transactionListSelect` shape assertion + ungrouped-null regression case
- `tests/transaction-detail-dal.test.ts` - `getTransactionForDetail` groupId/groupTitle null-for-ungrouped and pass-through cases
- `tests/transaction-table-menu.test.tsx` - fixture fix (missing new required `TransactionListRow` fields after Task 3's type extension)

## Decisions Made
- None beyond what the plan already locked — followed plan as specified (composition algorithm, ownership scoping, and display-only transaction fields were all fully specified in the plan's `<behavior>`/`<action>` blocks).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed tests/expense-table-menu.test.tsx fixture missing new required ExpenseRow fields**
- **Found during:** Task 1 (getExpenses composition + ExpenseRow extension)
- **Issue:** `ExpenseRow` gained `groupId`, `groupTitle`, `firstTransactionAt`, `lastTransactionAt`; a pre-existing test fixture building an `ExpenseRow` literal outside this plan's `<files>` list broke `tsc` as a direct, mechanical consequence of the type extension.
- **Fix:** Added the four new fields (all `null`) to the fixture default.
- **Files modified:** `tests/expense-table-menu.test.tsx`
- **Verification:** `yarn tsc --noEmit` clean for this file; `yarn test -- tests/expense-table-menu.test.tsx` passes.
- **Committed in:** `7e2aa3f` (part of Task 1 commit)

**2. [Rule 3 - Blocking] Fixed tests/transaction-table-menu.test.tsx fixture missing new required TransactionListRow fields**
- **Found during:** Task 3 (transaction group-title precedence)
- **Issue:** Same mechanical break as above — `TransactionListRow` gained `groupId`/`groupTitle`, and `makeTransaction()`'s fixture default (outside this task's `<files>` list) built a `TransactionListRow` literal without them, failing `tsc`.
- **Fix:** Added `groupId: null, groupTitle: null` to the fixture default.
- **Files modified:** `tests/transaction-table-menu.test.tsx`
- **Verification:** `yarn tsc --noEmit` clean for this file; `yarn test -- tests/transaction-table-menu.test.tsx` passes; confirmed via `git stash` A/B comparison that this error was absent before Task 3's diff and present after, isolating it as caused by this task.
- **Committed in:** `d0cef77` (part of Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both blocking — test fixtures broken by in-plan type extensions)
**Impact on plan:** Both fixes are mechanical, confined to test fixture literals, and directly required by this plan's own type changes. No scope creep — no production code outside the plan's `<files>` was touched.

## Issues Encountered

**Stream-watchdog interruption (not a plan defect):** the prior executor run completed Tasks 1-2 (`7e2aa3f`, `fdf5f54`) and had fully implemented and locally verified Task 3's diff (`lib/dal/transactions.ts` + its two test files) but stalled mid-verification before committing — the agent's last message indicated it was about to run `tsc`/full-suite checks. This resumed run:
- Read the plan's Task 3 `<behavior>`/`<action>`/`<acceptance_criteria>` and confirmed the uncommitted diff satisfied all of them exactly (schema import, both join sites, both type extensions, both select-object additions).
- Ran `yarn test -- tests/transactions-dal.test.ts tests/transaction-detail-dal.test.ts` (via the plan's task-level `<verify>` command) — pass.
- Ran the plan-level `<verification>` command (all 5 DAL test files) — pass.
- Ran `yarn tsc --noEmit`, found one NEW error (`tests/transaction-table-menu.test.tsx`, caused by Task 3's type extension — fixed, see Deviations #2) and two pre-existing, unrelated error groups (`sampleAmounts` on `PatternSuggestion`, a `SQL<string>` cast in `tests/transactions-dal.test.ts`); confirmed both pre-existing groups are identical with Task 3's diff stashed out, via A/B `git stash`/`stash pop` comparison — logged the confirmation to `deferred-items.md`, not fixed (out of scope).
- Re-ran the full test suite after the fixture fix (`yarn test`) — 120 files, 1450 passed, 1 todo, 0 failures.
- Committed Task 3 as `d0cef77`. No implementation work was redone; nothing from Tasks 1-2 was touched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `getExpenses`/`getExpenseForDetail`/`getExpenseGroupForDetail`/`getExpenseGroupMembers`/`expenseGroupDetailHref` are all live and importable — the group detail page and expenses-table UI work in the next wave (65-04+) can consume these directly.
- `getTransactions`/`getTransactionForDetail` expose `groupId`/`groupTitle` for the transaction-side "Parte di: {groupTitle}" display precedence — no further DAL work needed for that UI.
- Two pre-existing `tsc` type errors (`sampleAmounts` on `PatternSuggestion`, `SQL<string>` cast in `tests/transactions-dal.test.ts`), unrelated to this plan and confirmed unchanged by an A/B diff comparison, remain logged in `deferred-items.md` — not a blocker for subsequent 65-xx plans.

## Self-Check: PASSED

All modified files found on disk; all task commit hashes (7e2aa3f, fdf5f54, d0cef77) found in git log.

---
*Phase: 65-expense-group-merge-and-view*
*Completed: 2026-07-19*
