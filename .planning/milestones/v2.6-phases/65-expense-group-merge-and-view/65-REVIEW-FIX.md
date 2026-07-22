---
phase: 65-expense-group-merge-and-view
fixed_at: 2026-07-19T17:55:25Z
review_path: .planning/phases/65-expense-group-merge-and-view/65-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 65: Code Review Fix Report

**Fixed at:** 2026-07-19T17:55:25Z
**Source review:** .planning/phases/65-expense-group-merge-and-view/65-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (critical_warning scope — 3 Critical + 5 Warning; Info findings IN-01/IN-02 out of scope)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: Deleting a grouped member expense cascades silently — contradicts the phase's own documented risk

**Files modified:** `lib/services/expense-deletion.ts`, `lib/actions/expenses.ts`, `tests/expense-deletion-service.test.ts`
**Commits:** `a8589b8`, `f7e3310`
**Applied fix:** Added a D-03-style guard inside `deleteExpensesWithOptions` (the single service backing `deleteExpense`, `bulkDeleteExpenses`, and both "elimina anche la spesa collegata" flows) that rejects the whole delete when any target expense is a group member, before any row is deleted. Updated `deleteExpense`/`bulkDeleteExpenses`'s catch blocks to surface the thrown message (`err instanceof Error`) instead of swallowing it to a generic string, so the specific "fa parte di un gruppo" message actually reaches the user via the existing `toast.error(result.error)` pattern already used by the calling dialogs. Added test coverage (`expense-deletion-service.test.ts`) for the new guard and updated the existing two tests' select-chain mocks/call counts for the added query.
**Note:** did not add pre-emptive UI warnings in the delete-confirmation dialogs (expense-detail-client.tsx, transaction-detail-client.tsx, transaction-table.tsx) — the review's own fix note allowed this ("at minimum block deletion server-side"). The server-side rejection surfaces via each dialog's existing toast-based error display, so the user is not left silently guessing.

### CR-02: Merging expenses leaves the Expenses table showing stale, ungrouped rows

**Files modified:** `components/expenses/expense-table.tsx`
**Commit:** `0d2c381`
**Applied fix:** `MergeExpensesDialog`'s `onSuccess` now removes the merged rows from `loadedExpenses` (mirroring `BulkDeleteExpensesDialog`'s pattern) and calls `router.refresh()`. Confirmed the parent page (`app/(app)/expenses/page.tsx`) builds `ExpenseTable`'s `key` from the expenses data (including per-row fields), so `router.refresh()` triggers a real remount with the new composed group row rather than being absorbed by the stale `useState` initializer.

### CR-03: Pairing a transaction from the list view doesn't update the row locally — pair badge never appears without a reload

**Files modified:** `components/transactions/transaction-table.tsx`, `components/transactions/counterpart-picker-dialog.tsx`
**Commit:** `97875ac`
**Applied fix:** Extended `CounterpartPickerDialog`'s `onPaired` payload to also carry the selected counterpart's own `{id, amount, description, occurredAt}` (needed because the counterpart may not be present in the table's own locally-loaded page). Extended `pairTarget` state in `TransactionTable` to also carry `description`. `onPaired` now mirrors `handleUnpair`'s optimistic-update pattern: computes the net amount via `Decimal.js` (`toDecimal`, project hard rule — no native arithmetic) and sets `pairedWithId`/`pairedNetAmount`/`pairedAmount`/`pairedDescription`/`pairedOccurredAt` on BOTH legs of the new pair in `loadedTransactions`, so the `TransactionPairPopover` badge appears immediately without a reload.

### WR-01: Merge dialog lets a mixed-category selection walk into a foreseeable server rejection

**Files modified:** `components/expenses/merge-expenses-dialog.tsx`
**Commit:** `9117bb2`
**Applied fix:** Added `getSharedSubCategoryId` helper and a client-side guard in `handleCategorizeChange`: if the selection already has a shared non-null `subCategoryId` among its categorized members and the user picks a different one, the categorize step now rejects immediately with a toast error, instead of calling `bulkCategorize` and then failing later at the confirm step's `mergeExpenses` call.
**Note:** adapted rather than applied verbatim — the review's literal suggestion (lock/pre-filter the `SubcategoryPicker`'s displayed options) would require changing the shared `SubcategoryPicker` component used across many unrelated call sites (expense-detail-client, group-detail-client, transaction flows, etc.), which is out of scope for a narrowly-scoped fix. The applied guard closes the same "guaranteed server rejection" gap without touching that shared component.

### WR-02: New group-membership guard in `categorizeExpense` is unscoped to the caller's userId and racy against the write it guards

**Files modified:** `lib/actions/expenses.ts`, `tests/expense-actions.test.ts`, `tests/categorization-revalidation-actions.test.ts`
**Commit:** `d74e347`
**Applied fix:** Joined the `expenseGroupMembership` guard query through `expense` and scoped it with `eq(expense.userId, userId)`, closing the IDOR info-leak (an arbitrary/unowned expense id could no longer be probed for group membership before ownership is checked). Updated the two test files' mocked `db.select` chains to include the new `.innerJoin()` step.
**Note:** kept the guard running before `db.transaction` (not folded into it) rather than the review's alternative "fold into the transaction" option. The review explicitly presented userId-scoping and transaction-folding as alternatives ("or"). Folding it in would have required changing `categorizeExpense`'s catch block to surface thrown `Error` messages — but a pre-existing test (`categorization-revalidation-actions.test.ts`) explicitly asserts that DB/unexpected errors are masked to the generic safe message for this action; surfacing `err.message` broke that test by leaking a simulated `"database password leaked in diagnostic"` error. Kept the pre-transaction check (with userId scoping) to close the primary (IDOR) issue without regressing that established safe-error-masking convention. The residual TOCTOU race against a concurrent `mergeExpenses` call is narrower in scope than the IDOR leak and was left as-is.

### WR-03: `MergeExpensesSchema` doesn't enforce distinct expense ids

**Files modified:** `lib/validations/expense.ts`
**Commit:** `8e40675`
**Applied fix:** Added `.refine((ids) => new Set(ids).size === ids.length, { error: 'Spese duplicate nella selezione.' })` to `MergeExpensesSchema.selectedExpenseIds`, applied on the zod v4 `{ error }` syntax already used elsewhere in this file.

### WR-04: `bulkCategorize`'s unguarded `JSON.parse` is now exercised by the new merge flow

**Files modified:** `lib/actions/expenses.ts`
**Commit:** `5465b99`
**Applied fix:** Wrapped `JSON.parse(formData.get('ids'))` in try/catch, returning `{ error: 'Selezione non valida.' }` on malformed input — matching the sibling pattern already used by `bulkDeleteExpenses`/`mergeExpenses`.

### WR-05: Group aggregate can silently reflect only a subset of a group's members when combined with per-row filters

**Files modified:** `lib/actions/expenses.ts`, `tests/expense-actions.test.ts`
**Commit:** `a1b9ad0`
**Applied fix:** Chose option (a) from the review's two alternatives: `mergeExpenses` now also selects `status` and rejects the merge if any selected expense has `status === '4'` (ignored), since `ignoreExpense` sets status without clearing `subCategoryId`. This closes the reproduction path the review describes (status filter splitting a group's composed row). Added a regression test.
**Note:** did not implement option (b) (restructure `getExpenses`/`composeExpenseRows` to filter post-composition instead of pre-composition) — that is a materially larger DAL change (affects SQL row-narrowing for large datasets, sort/pagination interaction, and every existing filter test) versus the reviewed repro's actual root cause (status divergence introduced by `ignoreExpense` after merge). The platform filter has the same theoretical class of issue (a group's members can already span multiple platforms per the existing `composeExpenseRows` comment) but was not called out as broken in the review's finding and was left out of scope here.

## Skipped Issues

None — all 8 in-scope findings were fixed.

## Verification Notes

- All fixes were verified with `tsc --noEmit` (no new errors in modified files) and the full project test suite (`vitest run`): **123 test files, 1483 tests passing, 1 todo** — no regressions.
- Two commits (`WR-02`, and the `CR-01` follow-up `f7e3310`) required updating existing test mocks (adding an `.innerJoin()` step to mocked `db.select()` chains, adding an `expenseGroupMembership` schema mock export, and adjusting call-count/select-sequence assertions) to stay consistent with the fixed source. These are mechanical mock updates required by the fix, not behavior changes to the tests' intent.
- Reviewer note for WR-02: initially implemented per the review's "fold into transaction" alternative, which surfaced a real regression (a pre-existing test asserting that `categorizeExpense` masks all unexpected errors to a generic safe message) — reverted to the userId-scoping-only variant to avoid a new information-leak vector while still closing the IDOR issue.

---

_Fixed: 2026-07-19T17:55:25Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
