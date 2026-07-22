---
quick_id: 260721-mim
description: Fix transactions free-text search to also match the Expense Group title
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/dal/transactions.ts
  - tests/transactions-dal.test.ts
autonomous: true
must_haves:
  truths:
    - "A user typing an Expense Group's name into the transactions free-text search sees the transactions belonging to expenses in that group"
  artifacts:
    - lib/dal/transactions.ts (getTransactions name filter or() includes ilike(expenseGroup.title, pattern))
  key_links:
    - "getTransactions name filter -> expenseGroup.title (already leftJoin'ed at line ~390, already selected as groupTitle at line ~106) -> transaction-table.tsx display precedence (customTitle -> groupTitle -> expenseTitle -> description)"
---

<objective>
Fix the free-text name filter in `getTransactions` (`lib/dal/transactions.ts`) so it also matches on `expenseGroup.title`. The filter currently matches `transaction.description`, `transaction.customTitle`, and `expense.title`, but omits `expenseGroup.title` even though `expenseGroup` is already `leftJoin`ed in the same query and its title is already the row's primary display label (per `transaction-table.tsx`'s precedence: `customTitle -> groupTitle -> expenseTitle -> description`). A user searching by an Expense Group's name currently gets zero results even though that name is exactly what they see in the table.

Purpose: search must match what the user sees on screen. If a transaction displays a group title, searching for that title must find it.
Output: updated `or()` clause + corrected precedence comment in `lib/dal/transactions.ts`; extended assertion in `tests/transactions-dal.test.ts` proving the new `ilike(expenseGroup.title, pattern)` branch is present in the built `WHERE` clause.
</objective>

<context>
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add expenseGroup.title to the free-text name filter and fix the stale precedence comment</name>
  <files>lib/dal/transactions.ts</files>
  <read_first>
    lib/dal/transactions.ts lines 1-28 (imports — `expenseGroup` and `ilike`/`or` are already imported, no new import needed) and lines 316-326 (the `if (filters.name)` block containing the `or(...)` to edit) and line 390 (`.leftJoin(expenseGroup, eq(expenseGroupMembership.groupId, expenseGroup.id))` — confirms the join already exists in this same query, so no join/import changes are needed, only the `or()` predicate list).
  </read_first>
  <action>
    In `getTransactions`, inside the `if (filters.name)` block (~line 316-326), add a fourth predicate to the existing `or(...)` call: `ilike(expenseGroup.title, pattern)`, alongside the existing `ilike(transaction.description, pattern)`, `ilike(transaction.customTitle, pattern)`, and `ilike(expense.title, pattern)`. Do not touch any other filter branch, do not add a new join, do not add a new import — `expenseGroup` and `ilike`/`or` are already available in this file. Update the inline comment currently reading "Matches table label: customTitle → expense title → bank description" to read "Matches table label: customTitle → group title → expense title → bank description" so it reflects the true display precedence used by `transactionRowLabel` in `components/transactions/transaction-table.tsx` (customTitle, then groupTitle, then expenseTitle, then description). This is purely additive to the existing `or()` — no other filter's behavior changes.
  </action>
  <verify>
    <automated>grep -n "expenseGroup.title" lib/dal/transactions.ts | grep -c "ilike" </automated>
  </verify>
  <acceptance_criteria>
    - `lib/dal/transactions.ts`'s `getTransactions` name-filter `or(...)` (inside `if (filters.name)`) contains `ilike(expenseGroup.title, pattern)` as a fourth branch alongside description/customTitle/expense.title
    - The comment directly above the `or(...)` predicates lists the precedence as customTitle → group title → expense title → bank description
    - No new import statement was added and no new `.leftJoin` was added (the existing `expenseGroup` join at line ~390 is reused as-is)
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: Extend the DAL test to assert the group-title branch, then run full verification</name>
  <files>tests/transactions-dal.test.ts</files>
  <read_first>
    tests/transactions-dal.test.ts lines 98-171 (the `@/lib/db/schema` mock — confirm `expenseGroup: { id: "expenseGroup.id", title: "expenseGroup.title" }` is already present, so no mock changes are needed) and lines 679-705 (the existing test `"name filter uses substring ILIKE on description, customTitle, and expense title"` — this is the test to extend, following its exact established pattern of calling `getTransactions({ name: "esselunga" })`, locating the `or` node inside `where.args` whose inner args contain an `ilike` with `right: "%esselunga%"`, then asserting `nameCondition!.args` via `expect.arrayContaining([...])`).
  </read_first>
  <action>
    In the existing test `"name filter uses substring ILIKE on description, customTitle, and expense title"` (~line 679), rename it to `"name filter uses substring ILIKE on description, customTitle, expense title, and expense group title"` and add one more entry to the `expect.arrayContaining([...])` array passed to `expect(nameCondition!.args).toEqual(...)`: `{ op: "ilike", left: "expenseGroup.title", right: "%esselunga%" }`, matching the exact shape of the three existing entries (`transaction.description`, `transaction.customTitle`, `expense.title`) already asserted there. Do not create a new mock harness or new describe block — this is the same `getTransactions({ name: "esselunga" })` call and the same `where.args`-searching pattern already established in that test; the mocked `@/lib/db/schema` module already exposes `expenseGroup.title` (line ~113) so no fixture changes are needed. This assertion proves at the query-building layer that the group title branch is present in the compiled `WHERE`, since the mocked DB chain (`makeQueryChain`) cannot execute real SQL or express the join's row-level fan-out — this is the fallback layer specified in the task brief when a real end-to-end join assertion is not achievable through the existing mock harness. After editing, run the full test suite and the language checker to confirm no regressions: `yarn vitest run` and `yarn check:language`.
  </action>
  <verify>
    <automated>yarn vitest run tests/transactions-dal.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - The renamed/extended test in `tests/transactions-dal.test.ts` asserts `{ op: "ilike", left: "expenseGroup.title", right: "%esselunga%" }` is present in the name-filter `or()` args, and passes
    - `yarn check:language` reports no violations
    - Full `yarn vitest run` is green (no regressions in any other test file)
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `yarn vitest run tests/transactions-dal.test.ts` — green, including the extended name-filter test
- `yarn vitest run` (full suite) — green, no regressions
- `yarn check:language` — clean
- Manual sanity (optional): visiting `/transactions?name=<an-existing-expense-group-title>` returns the grouped transactions instead of an empty list
</verification>

<success_criteria>
- `getTransactions`'s free-text name filter matches `expenseGroup.title` in addition to `transaction.description`, `transaction.customTitle`, and `expense.title`
- The precedence comment in the DAL accurately reflects the UI's display precedence (customTitle → groupTitle → expenseTitle → description)
- Test coverage proves the new branch is wired into the compiled `WHERE` clause
- No other filter branch or existing test is altered in behavior
</success_criteria>

<output>
Create `.planning/quick/260721-mim-fix-transactions-free-text-search-to-als/260721-mim-SUMMARY.md` when done
</output>
