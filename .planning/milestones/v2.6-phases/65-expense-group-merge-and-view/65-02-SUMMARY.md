---
phase: 65-expense-group-merge-and-view
plan: 02
subsystem: api
tags: [drizzle, postgres, server-actions, zod, expense-group]

# Dependency graph
requires:
  - phase: 65-01
    provides: "expenseGroup/expenseGroupMembership schema + MergeExpensesSchema/RenameExpenseGroupSchema validators"
provides:
  - "createExpenseGroup / renameExpenseGroup service (lib/services/expense-group.ts)"
  - "mergeExpenses / renameExpenseGroupAction server actions (lib/actions/expenses.ts)"
  - "categorizeExpense D-03 guard against recategorizing grouped members"
affects: [65-03, 65-04, 65-05, 65-06, 66-expense-group-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "createExpenseGroup/renameExpenseGroup accept DbOrTx (never call dbOrTx.transaction themselves) — caller (mergeExpenses) owns the transaction boundary, matching lib/services/expense-deletion.ts's convention"
    - "23505 unique-violation on the membership insert caught via the errorCauseCode(error) helper (mirrors lib/services/transaction-pairs.ts) and re-thrown as the same Italian message as the pre-check, closing the pre-check/insert race"
    - "Server actions surface service-thrown Error messages verbatim via catch (err) { if (err instanceof Error) return { error: err.message } }, not a generic fallback — required because createExpenseGroup/renameExpenseGroup throw message-carrying errors meant for the client"

key-files:
  created:
    - lib/services/expense-group.ts
    - tests/expense-group-service.test.ts
  modified:
    - lib/actions/expenses.ts
    - tests/expense-actions.test.ts
    - tests/categorization-revalidation-actions.test.ts

key-decisions:
  - "mergeExpenses never calls updateExpense/bulkCategorize or writes expense.subCategoryId/status — it only reads (to validate the shared-category gate) and delegates to createExpenseGroup, which only inserts expenseGroup/expenseGroupMembership rows (D-02 structural guarantee, verified: grep -c 'update(expense)' lib/services/expense-group.ts == 0)"
  - "categorizeExpense's new expenseGroupMembership pre-check runs before db.transaction and returns early without starting a transaction when the target is already a group member (D-03 defense-in-depth)"

patterns-established:
  - "One-group-per-expense enforcement is two-layered: an ownership-scoped pre-check SELECT (covers the common case) plus a 23505 catch on the membership INSERT (covers the pre-check/insert race) — both throw the identical Italian message so the caller can't distinguish which layer caught it"

requirements-completed: [GRP-01, GRP-02]

coverage:
  - id: D1
    description: "createExpenseGroup/renameExpenseGroup service: ownership-scoped, one-group-per-expense enforced (pre-check + 23505 race-catch), never writes to the expense table"
    requirement: "GRP-01"
    verification:
      - kind: unit
        ref: "tests/expense-group-service.test.ts (6 tests: happy path, IDOR rejection, already-grouped rejection, 23505 race-catch, rename happy path, rename-not-owned)"
        status: pass
      - kind: other
        ref: "grep -c 'update(expense)' lib/services/expense-group.ts == 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "mergeExpenses/renameExpenseGroupAction server actions: parse -> verifySession -> shared-category gate (read-only) -> delegate to service; surface service Error messages verbatim"
    requirement: "GRP-02"
    verification:
      - kind: unit
        ref: "tests/expense-actions.test.ts describe('mergeExpenses') + describe('renameExpenseGroupAction') (8 tests: happy path, missing/unowned id, uncategorized rejection, disagreeing-category rejection, already-grouped error surfaced verbatim, parse-failure short-circuit, rename happy path, rename not-found surfaced verbatim)"
        status: pass
    human_judgment: false
  - id: D3
    description: "categorizeExpense rejects recategorizing a grouped member before starting its db.transaction (D-03 defense-in-depth, closes the bypass on the pre-existing single-expense action)"
    verification:
      - kind: unit
        ref: "tests/expense-actions.test.ts describe('categorizeExpense — grouped member guard (D-03)') — asserts error returned and db.transaction never invoked"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-18
status: complete
---

# Phase 65 Plan 2: expense-group-merge-and-view Summary

**Write side of the Expense Group model: `createExpenseGroup`/`renameExpenseGroup` service with ownership + one-group-per-expense enforcement, `mergeExpenses`/`renameExpenseGroupAction` server actions that gate on a shared non-null subcategory without ever assigning one, and a `categorizeExpense` guard closing the D-03 direct-recategorize bypass on grouped members.**

## Performance

- **Duration:** ~12 min (task commits span 19:32:04–19:42:23)
- **Started:** 2026-07-18T19:32:04+02:00
- **Completed:** 2026-07-18T19:42:23+02:00
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- `lib/services/expense-group.ts`: `createExpenseGroup` (ownership-scoped select-then-act, already-grouped pre-check, 23505 race-catch translated to the same Italian message, no special-casing for Standalone Expenses per D-05) and `renameExpenseGroup` (scoped UPDATE, throws `'Gruppo non trovato.'` on zero rows) — never writes to the `expense` table (D-02 structural guarantee)
- `lib/actions/expenses.ts`: `mergeExpenses` (parse → verifySession → dedupe ids → single `db.transaction` validating ownership + shared non-null subcategory → `createExpenseGroup(tx, ...)`) and `renameExpenseGroupAction`, both surfacing service-thrown Error messages verbatim (transaction-pairs.ts precedent) rather than a generic fallback
- `categorizeExpense` guarded against grouped members: a scoped `expenseGroupMembership` select runs after the subcategory-visibility check and before `db.transaction`, returning `'Questa spesa fa parte di un gruppo: categorizza dal gruppo.'` and touching nothing when the target is already a member (D-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/services/expense-group.ts (createExpenseGroup, renameExpenseGroup)** - `f9c61a4` (feat)
2. **Task 2: Add mergeExpenses and renameExpenseGroupAction to lib/actions/expenses.ts** - `bf45228` (feat)
3. **Task 3: Guard categorizeExpense against grouped members (D-03 defense-in-depth)** - `e4e3693` (fix)

**Plan metadata:** (pending — final commit below)

## Files Created/Modified
- `lib/services/expense-group.ts` - `createExpenseGroup`/`renameExpenseGroup`, `errorCauseCode` 23505-detection helper (mirrors transaction-pairs.ts)
- `lib/actions/expenses.ts` - added `mergeExpenses`, `renameExpenseGroupAction`; guarded `categorizeExpense` with a pre-transaction `expenseGroupMembership` check; imports `expenseGroupMembership` from `@/lib/db/schema`
- `tests/expense-group-service.test.ts` - 6 tests covering happy path, IDOR rejection, already-grouped rejection, 23505 race-catch, rename happy path, rename-not-owned
- `tests/expense-actions.test.ts` - added `mergeExpenses`/`renameExpenseGroupAction`/D-03 guard test suites (14 new tests total across the three)
- `tests/categorization-revalidation-actions.test.ts` - table-differentiated `db.select` mock (see Deviations)

## Decisions Made
- None beyond what the plan already locked (ADR 0017 D-01/D-02/D-03/D-05) — followed plan as specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Differentiated `db.select` mock by table identity in tests/categorization-revalidation-actions.test.ts**
- **Found during:** Task 3 (guarding `categorizeExpense`)
- **Issue:** That pre-existing test file's `db.select` mock was table-agnostic (returned the same chain regardless of which table was queried), so once `categorizeExpense` added its new `expenseGroupMembership` lookup, the existing tests' `isSubCategoryVisibleToUser`-adjacent mock chain was reused for the new guard and unconditionally tripped it, breaking those tests.
- **Fix:** Made the mock differentiate by table identity so the `expenseGroupMembership` lookup and the pre-existing lookups each resolve independently.
- **Files modified:** `tests/categorization-revalidation-actions.test.ts`
- **Verification:** `yarn test -- tests/categorization-revalidation-actions.test.ts` (and the full suite) passes.
- **Committed in:** `e4e3693` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — test infrastructure fix required by the new guard)
**Impact on plan:** Necessary to keep the pre-existing test suite green after adding the D-03 guard. No scope creep — the fix is confined to a shared test mock, not production code.

## Issues Encountered

**Session/quota interruption (not a plan failure):** the prior executor run for this plan was terminated mid-flight by a provider quota/session limit after all 3 tasks were committed but before `65-02-SUMMARY.md` was written. This run (a resumed executor) re-verified all 3 commits against the plan's task-level acceptance criteria and behavior spec by reading the actual diffs (not just commit messages), re-ran the plan's verification suite, and confirmed nothing was missing or broken before writing this SUMMARY. No implementation work was redone.

**Verification performed in this resumed run:**
- `git show` on all 3 commits (`f9c61a4`, `bf45228`, `e4e3693`) — confirmed each task's `<behavior>`/`<action>`/`<acceptance_criteria>` are satisfied by the actual code, not just the commit message.
- `grep -c 'update(expense)' lib/services/expense-group.ts` → `0` (D-02 structural guarantee).
- `npx vitest run tests/expense-group-service.test.ts tests/expense-actions.test.ts` → 24 tests, 0 failures.
- `yarn test` (full suite) → 119 files, 1434 passed, 1 todo, 0 failures.
- `yarn tsc --noEmit` → 6 pre-existing type errors in unrelated test files (`tests/cascade-options.test.ts`, `tests/category-combobox.test.tsx`, `tests/file-download-api.test.ts`, `tests/suggestion-card.test.tsx`, `tests/suggestion-promote-form.test.tsx`, `tests/transactions-dal.test.ts`); none touch `lib/services/expense-group.ts` or `lib/actions/expenses.ts`, and none of the 3 commits in this plan modified those files. Logged to `.planning/phases/65-expense-group-merge-and-view/deferred-items.md` per the scope-boundary rule — not fixed, out of scope for this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `createExpenseGroup`/`renameExpenseGroup`/`mergeExpenses`/`renameExpenseGroupAction` are live and importable — Plan 65-03+ (UI: merge dialog, group view/detail) can wire these actions directly.
- `categorizeExpense`'s D-03 guard is in place; per the threat model's T-65-06 disposition, `bulkCategorize` remains intentionally unguarded this phase (grouped members aren't reachable through the UI selection surface until Plan 65-04 hides them from the table).
- Pre-existing `tsc` type errors (6 files, test-fixture-only, unrelated to this plan) logged in `deferred-items.md` for future cleanup — not a blocker for subsequent 65-xx plans.

## Self-Check: PASSED

All created/modified files found on disk; all task commit hashes (f9c61a4, bf45228, e4e3693) found in git log.

---
*Phase: 65-expense-group-merge-and-view*
*Completed: 2026-07-18*
